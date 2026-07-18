/**
 * @fileoverview 核心清除與置換引擎。
 * 負責在瀏覽器端直接操作 PDF 結構，運用「無損置換」與「空串流替換」技術，安全剝離各類浮水印物件，
 * 並主動清理殘留的參照指令，防止產出的 PDF 損毀。
 */

// ==========================================
// [PDF Processor Engine] 核心清除與置換引擎
// ==========================================

let currentRebuildErrors = 0;

/**
 * 安全地從 PDFDict 資源字典中移除指定鍵值
 * 若原字典已被多頁共用，會先進行 clone 以隔離修改。
 *
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @param {PDFDict} resources - 頁面的 Resources 字典
 * @param {PDFName} dictKey - 目標字典在 Resources 中的鍵名 (如 PDFName.of('XObject'))
 * @param {PDFDict} targetDict - 目標字典
 * @param {PDFRef|null} targetRef - 目標字典的參照物件 (如果有)
 * @param {PDFName[]} keysToRemove - 準備移除的鍵名陣列
 * @returns {void}
 */
function safeRemoveFromDictionary(pdfDoc, resources, dictKey, targetDict, targetRef, keysToRemove) {
    if (keysToRemove.length === 0) return;

    // 複製以確保安全修改 (單頁隔離)，避免破壞跨頁共用資源
    const dictToModify = targetDict.clone(pdfDoc.context);

    // 如果原先已經是個參照 (ref)，我們註冊一個新的參照以維持結構；反之則直接寫入字典
    if (targetRef) {
        resources.set(dictKey, pdfDoc.context.register(dictToModify));
    } else {
        resources.set(dictKey, dictToModify);
    }
    for (const key of keysToRemove) {
        dictToModify.delete(key);
    }
}

/**
 * 共用的字串置換輔助函式，用於從 Content Stream 中移除對已刪除資源的參照 (如 Do, gs, OCG)
 * @param {string} text - 原始內容串流文字
 * @param {string[]} deletedXObjKeys - 被刪除的 XObject 鍵名清單
 * @param {string[]} deletedExtGStateKeys - 被刪除的 ExtGState 鍵名清單
 * @param {string[]} deletedOcgKeys - 被刪除的 OCG 鍵名清單
 * @param {boolean} [removeLargeTextBlocks=false] - 是否清除巨型文字區塊
 * @returns {{text: string, modified: boolean}} 置換後的文字與是否被修改的布林值
 */
function removeDeletedReferencesFromText(
    text,
    deletedXObjKeys,
    deletedExtGStateKeys,
    deletedOcgKeys,
    removeLargeTextBlocks = false
) {
    let modified = false;
    let newText = text;

    const replacers = [
        { keys: deletedXObjKeys, getRegex: (k) => new RegExp('/' + escapeRegex(k) + '\\s+Do\\b', 'g') },
        { keys: deletedExtGStateKeys, getRegex: (k) => new RegExp('/' + escapeRegex(k) + '\\s+gs\\b', 'g') },
        {
            keys: deletedOcgKeys,
            getRegex: (k) => new RegExp('/OC\\s+/' + escapeRegex(k) + '\\s+BDC[\\s\\S]*?EMC', 'g'),
        },
    ];

    replacers.forEach(({ keys, getRegex }) => {
        for (const key of keys || []) {
            const cleanKey = key.startsWith('/') ? key.substring(1) : key;
            if (newText.includes('/' + cleanKey)) {
                const replaced = newText.replace(getRegex(cleanKey), '');
                if (replaced !== newText) {
                    newText = replaced;
                    modified = true;
                }
            }
        }
    });

    if (removeLargeTextBlocks) {
        let currentCm = [1, 0, 0, 1, 0, 0];
        let cmStack = [];

        // 掃描串流，建立 Graphics State 與 BT...ET 區塊的對應關係
        const gsRegex =
            /([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+cm\b|\bq\b|\bQ\b|\bBT\b|\bET\b/g;

        let match;
        let blocksToProcess = [];
        let inBT = false;
        let btStart = -1;
        let activeCm = [...currentCm];

        while ((match = gsRegex.exec(newText)) !== null) {
            const token = match[0];
            if (token === 'q') {
                cmStack.push([...currentCm]);
            } else if (token === 'Q') {
                if (cmStack.length > 0) currentCm = cmStack.pop();
            } else if (token.endsWith('cm')) {
                const a1 = currentCm[0],
                    b1 = currentCm[1],
                    c1 = currentCm[2],
                    d1 = currentCm[3],
                    e1 = currentCm[4],
                    f1 = currentCm[5];
                const a2 = parseFloat(match[1]),
                    b2 = parseFloat(match[2]),
                    c2 = parseFloat(match[3]),
                    d2 = parseFloat(match[4]),
                    e2 = parseFloat(match[5]),
                    f2 = parseFloat(match[6]);
                // CTM_new = CTM_current * M_operand (Row vector multiplication)
                currentCm = [
                    a1 * a2 + b1 * c2,
                    a1 * b2 + b1 * d2,
                    c1 * a2 + d1 * c2,
                    c1 * b2 + d1 * d2,
                    e1 * a2 + f1 * c2 + e2,
                    e1 * b2 + f1 * d2 + f2,
                ];
            } else if (token === 'BT') {
                inBT = true;
                btStart = match.index;
                activeCm = [...currentCm];
            } else if (token === 'ET') {
                if (inBT) {
                    blocksToProcess.push({
                        start: btStart,
                        end: match.index + 2,
                        cm: activeCm,
                    });
                    inBT = false;
                }
            }
        }

        // 倒序處理區塊，避免修改字串後導致後續索引偏移
        for (let i = blocksToProcess.length - 1; i >= 0; i--) {
            const blockInfo = blocksToProcess[i];
            let blockStr = newText.substring(blockInfo.start, blockInfo.end);

            let currentTm = [1, 0, 0, 1, 0, 0];
            let currentTf = 0;

            const blockOpRegex =
                /([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+Tm\b|\/([A-Za-z0-9_+-]+)\s+([0-9.]+)\s+Tf\b|(\([^)]*\))\s*(?:Tj\b|')|(\[[\s\S]*?\])\s*TJ\b|[0-9.+-]+\s+[0-9.+-]+\s+(\([^)]*\))\s*"\b/g;

            const newBlockStr = blockStr.replace(
                blockOpRegex,
                (m, tma, tmb, tmc, tmd, tme, tmf, fontName, fontSize) => {
                    if (m.endsWith('Tm')) {
                        currentTm = [
                            parseFloat(tma),
                            parseFloat(tmb),
                            parseFloat(tmc),
                            parseFloat(tmd),
                            parseFloat(tme),
                            parseFloat(tmf),
                        ];
                        return m;
                    } else if (m.endsWith('Tf')) {
                        currentTf = parseFloat(fontSize);
                        return m;
                    } else {
                        // 計算 Trm = Tm * cm 的垂直縮放比例
                        const a1 = blockInfo.cm[0],
                            b1 = blockInfo.cm[1],
                            c1 = blockInfo.cm[2],
                            d1 = blockInfo.cm[3];
                        const c2 = currentTm[2],
                            d2 = currentTm[3];

                        const trm_c = c2 * a1 + d2 * c1;
                        const trm_d = c2 * b1 + d2 * d1;
                        const verticalScale = Math.sqrt(trm_c * trm_c + trm_d * trm_d);
                        const effectiveSize = currentTf * verticalScale;

                        if (effectiveSize >= LARGE_TEXT_SIZE_THRESHOLD) {
                            modified = true;
                            return '';
                        }
                        return m;
                    }
                }
            );

            if (newBlockStr !== blockStr) {
                newText = newText.substring(0, blockInfo.start) + newBlockStr + newText.substring(blockInfo.end);
            }
        }
    }

    return { text: newText, modified };
}

/**
 * 共用串流重構邏輯：解碼二進位串流，抹除已刪除資源的參照指令，並重構為新的 PDFRawStream。
 * 若內容有被修改，則回傳重構後的新串流，否則回傳 null。
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @param {PDFRawStream} stream - 原始二進位串流
 * @param {string[]} deletedXObjKeys - 被刪除的 XObject 鍵名清單
 * @param {string[]} deletedExtGStateKeys - 被刪除的 ExtGState 鍵名清單
 * @param {string[]} deletedOcgKeys - 被刪除的 OCG 鍵名清單
 * @param {boolean} [removeLargeTextBlocks=false] - 是否清除巨型文字區塊
 * @returns {PDFRawStream|null} 重構後的新串流物件
 */
function rebuildStreamWithoutReferences(
    pdfDoc,
    stream,
    deletedXObjKeys,
    deletedExtGStateKeys,
    deletedOcgKeys,
    removeLargeTextBlocks = false
) {
    try {
        const bytes = getDecodedStreamContents(stream);
        const text = decodeBinaryToText(bytes);
        const result = removeDeletedReferencesFromText(
            text,
            deletedXObjKeys,
            deletedExtGStateKeys,
            deletedOcgKeys,
            removeLargeTextBlocks
        );

        if (result.modified) {
            const arr = encodeTextToBinary(result.text);

            // 如果環境有提供 pako，則重新對資料進行 zlib deflate 壓縮
            let finalData = arr;
            const newDict = stream.dict.clone(pdfDoc.context);
            if (typeof pako !== 'undefined') {
                try {
                    finalData = pako.deflate(arr);
                    newDict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
                } catch (e) {
                    console.warn('pako compression failed, falling back to uncompressed stream', e);
                    newDict.delete(PDFName.of('Filter'));
                }
            } else {
                newDict.delete(PDFName.of('Filter'));
            }

            // 重新由 pdfDoc.context.stream 打包時，pdf-lib 會自行處理長度，或者依賴無 Length
            newDict.delete(PDFName.of('Length'));
            return pdfDoc.context.stream(finalData, newDict);
        }
    } catch (e) {
        console.error('Failed to rebuild stream', e);
        currentRebuildErrors++;
    }
    return null;
}

/**
 * 清理 content stream 中對已刪除資源的參考，防止 Acrobat Reader 報錯
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @param {PDFPage} page - 頁面物件
 * @param {string[]} deletedXObjKeys - 被刪除的 XObject 鍵名清單
 * @param {string[]} deletedExtGStateKeys - 被刪除的 ExtGState 鍵名清單
 * @param {string[]} deletedOcgKeys - 被刪除的 OCG 鍵名清單
 * @param {boolean} [removeLargeTextBlocks=false] - 是否清除巨型文字區塊
 * @returns {void}
 */
function cleanContentStreams(
    pdfDoc,
    page,
    deletedXObjKeys,
    deletedExtGStateKeys,
    deletedOcgKeys,
    removeLargeTextBlocks = false
) {
    const contentsKey = PDFName.of('Contents');
    const contentsRef = page.node.get(contentsKey);
    if (!contentsRef) return;

    /**
     * 內部輔助函式：處理單一內容串流，進行參照指令抹除與重新打包
     * @param {PDFRef} streamRef - 串流參照
     * @param {number|null} idxOrKey - 在陣列中的索引，或單一參照的 null
     * @param {PDFArray|null} contentsArray - 若有多個內容串流，此為父陣列
     * @returns {void}
     */
    const processStream = (streamRef, idxOrKey, contentsArray) => {
        const stream = pdfDoc.context.lookup(streamRef);
        if (stream instanceof PDFRawStream) {
            const newStream = rebuildStreamWithoutReferences(
                pdfDoc,
                stream,
                deletedXObjKeys,
                deletedExtGStateKeys,
                deletedOcgKeys,
                removeLargeTextBlocks
            );
            if (newStream) {
                const newRef = pdfDoc.context.register(newStream);
                if (contentsArray) {
                    contentsArray.set(idxOrKey, newRef);
                } else {
                    page.node.set(contentsKey, newRef);
                }
            }
        }
    };

    const contentsObj = pdfDoc.context.lookup(contentsRef);
    if (contentsObj instanceof PDFArray) {
        for (let i = 0; i < contentsObj.size(); i += 1) {
            processStream(contentsObj.get(i), i, contentsObj);
        }
    } else {
        processStream(contentsRef, null, null);
    }
}

/**
 * 核心重構清除引擎：遍歷 PDF 物件樹並執行浮水印置換
 *
 * 為了防止直接刪除 PDF 字典物件導致內部資源樹引用斷裂（引發 PDF 檔損毀打不開），
 * 本清除引擎採用「無損清除技術」—— 將需要清除的物件從資源字典中移除，
 * 並主動清理 Content Stream 中的參照 (如 `Do`, `gs`)，確保 PDF 結構完整，防止 Acrobat Reader 報錯。
 * 同時執行單頁資源隔離複製，確保頁面間的修改不互相干擾。
 *
 * @param {PDFDocument} pdfDoc - pdf-lib 的 PDF 文件物件
 * @param {Object} options - 包含 7 大清理策略勾選狀態的布林值物件
 * @returns {Object} 包含 modifiedObjects (已被修改/置換的物件總數) 的統計物件
 */
async function processPdf(pdfDoc, options) {
    let modifiedObjects = 0;
    currentRebuildErrors = 0;

    const destroySets = {
        formXObjects: new Set(formXObjectsToDestroy),
        images: new Set(imagesToDestroy),
        extGStates: new Set(extGStatesToDestroy),
        ocgs: new Set(ocgsToDestroy),
        annots: new Set(annotsToDestroy),
        directContents: new Set(directContentsToDestroy),
        textBlocks: new Set(textBlocksToDestroy),
    };

    // 針對全域 OCG (圖層) 進行徹底刪除（從 Catalog 中移除）
    if (options.removeOCG) {
        modifiedObjects += removeOCG(pdfDoc, destroySets.ocgs);
    }

    // 循序遍歷處理每一頁，確保修改的隔離性
    for (let pageIndex = 0; pageIndex < pdfDoc.getPageCount(); pageIndex += 1) {
        // 每處理 10 頁讓出一次主執行緒 (Time Slicing)，避免大檔處理時瀏覽器畫面凍結
        if (pageIndex > 0 && pageIndex % 10 === 0) {
            await new Promise((r) => setTimeout(r, 0));
        }

        const page = pdfDoc.getPage(pageIndex);
        let allDeletedXObjectKeys = [];

        // 1. 複製 Contents 陣列以進行單頁隔離，確保當前頁的修改（如刪除 Do 指令）不會意外影響其他共用此內容串流的頁面
        const contentsKey = PDFName.of('Contents');
        const contents = page.node.lookup(contentsKey);
        if (contents instanceof PDFArray) {
            page.node.set(contentsKey, contents.clone(pdfDoc.context));
        }

        // 取得當前頁面的 Resources 資源字典以分析 XObject 等子物件
        let resources = page.node.lookup(PDFName.of('Resources'));
        if (!(resources instanceof PDFDict)) {
            continue;
        }

        // 2. 複製 Resources 字典以進行單頁隔離，確保將物件從此頁移除時，不影響其他頁面所需的共用資源
        if (resources.clone) {
            resources = resources.clone(pdfDoc.context);
            page.node.set(PDFName.of('Resources'), resources);
        }

        // 策略三：清除註解 (Annotation)
        if (options.removeAnnotations) {
            modifiedObjects += removeAnnotations(page, destroySets.annots);
        }

        // 策略四：清除頁面直接內容 (Direct Content)
        if (options.removeDirectContent) {
            modifiedObjects += removeDirectContent(pdfDoc, page, destroySets.directContents);
        }

        let allDeletedExtGStateKeys = [];
        let allDeletedOcgKeys = [];

        // 遞迴清理 Resources (含 XObject, Image, ExtGState, OCG)
        modifiedObjects += cleanResourcesRecursively(
            pdfDoc,
            resources,
            pageIndex,
            options,
            destroySets,
            allDeletedXObjectKeys,
            allDeletedExtGStateKeys,
            allDeletedOcgKeys
        );

        // 策略五：清除巨型文字區塊 (TextBlocks)
        const shouldCleanTextBlocks =
            options.removeTextBlocks && destroySets.textBlocks && destroySets.textBlocks.has(`page_${pageIndex}`);

        // 清理 content stream 中對已刪除資源的參考，防止 Acrobat Reader 報錯
        if (
            allDeletedXObjectKeys.length > 0 ||
            allDeletedExtGStateKeys.length > 0 ||
            allDeletedOcgKeys.length > 0 ||
            shouldCleanTextBlocks
        ) {
            cleanContentStreams(
                pdfDoc,
                page,
                allDeletedXObjectKeys,
                allDeletedExtGStateKeys,
                allDeletedOcgKeys,
                shouldCleanTextBlocks
            );
        }
    }

    return { modifiedObjects, rebuildErrors: currentRebuildErrors };
}

/**
 * 遞迴清理 Resources (支援巢狀 Form XObject)
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @param {PDFDict} resources - 資源字典物件
 * @param {number} pageIndex - 當前處理頁面的 0-indexed 索引
 * @param {Object} options - 包含清理策略的選項物件
 * @param {Object} destroySets - 轉換為 Set 的清理目標名單
 * @param {string[]} allDeletedXObjectKeys - 收集被刪除的 XObject 鍵名
 * @param {string[]} allDeletedExtGStateKeys - 收集被刪除的 ExtGState 鍵名
 * @param {string[]} allDeletedOcgKeys - 收集被刪除的 OCG 鍵名
 * @returns {number} 實際清理的物件總數
 */
function cleanResourcesRecursively(
    pdfDoc,
    resources,
    pageIndex,
    options,
    destroySets,
    allDeletedXObjectKeys,
    allDeletedExtGStateKeys,
    allDeletedOcgKeys
) {
    let count = 0;

    if (options.removeFormXObject) {
        const res = removeXObjects(pdfDoc, resources, '/Form', destroySets.formXObjects);
        count += res.count;
        if (res.deletedKeys) allDeletedXObjectKeys.push(...res.deletedKeys);
    }
    if (options.removeImageXObject) {
        const res = removeXObjects(pdfDoc, resources, '/Image', destroySets.images);
        count += res.count;
        if (res.deletedKeys) allDeletedXObjectKeys.push(...res.deletedKeys);
    }
    if (options.removeExtGState) {
        const resExt = removeExtGState(pdfDoc, resources, pageIndex, destroySets.extGStates);
        count += resExt.count;
        if (resExt.deletedKeys) allDeletedExtGStateKeys.push(...resExt.deletedKeys);
    }
    if (options.removeOCG) {
        const resOcg = removeOCGs(pdfDoc, resources, destroySets.ocgs);
        count += resOcg.count;
        if (resOcg.deletedPropertiesKeys) allDeletedOcgKeys.push(...resOcg.deletedPropertiesKeys);
        if (resOcg.deletedXObjectKeys) allDeletedXObjectKeys.push(...resOcg.deletedXObjectKeys);
    }

    // 遞迴進入殘留的 Form XObject 內部 Resources
    const xObjectsRef = resources.get(PDFName.of('XObject'));
    if (xObjectsRef) {
        const xObjects = pdfDoc.context.lookup(xObjectsRef);
        if (xObjects instanceof PDFDict) {
            for (const key of xObjects.keys()) {
                const xObjRef = xObjects.get(key);
                const xObj = pdfDoc.context.lookup(xObjRef);
                if (xObj instanceof PDFRawStream) {
                    const subtype = pdfDoc.context.lookup(xObj.dict.get(PDFName.of('Subtype')));
                    if (subtype instanceof PDFName && subtype.toString() === '/Form') {
                        const nestedResNode = xObj.dict.get(PDFName.of('Resources'));
                        if (nestedResNode) {
                            const nestedRes = pdfDoc.context.lookup(nestedResNode);
                            if (nestedRes instanceof PDFDict) {
                                // 準備獨立的刪除清單，給這個 Form 的串流使用
                                const nestedDeletedXObj = [];
                                const nestedDeletedExtGState = [];
                                const nestedDeletedOcg = [];

                                count += cleanResourcesRecursively(
                                    pdfDoc,
                                    nestedRes,
                                    pageIndex,
                                    options,
                                    destroySets,
                                    nestedDeletedXObj,
                                    nestedDeletedExtGState,
                                    nestedDeletedOcg
                                );

                                // 若內部有刪除，必須清理這個 Form XObject 的 Content Stream
                                if (
                                    nestedDeletedXObj.length > 0 ||
                                    nestedDeletedExtGState.length > 0 ||
                                    nestedDeletedOcg.length > 0
                                ) {
                                    cleanFormXObjectStream(
                                        pdfDoc,
                                        xObjRef,
                                        nestedDeletedXObj,
                                        nestedDeletedExtGState,
                                        nestedDeletedOcg
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return count;
}

/**
 * 專門用於清理 Form XObject 內部 Content Stream 的函式
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @param {PDFRef} xObjRef - Form XObject 的參照物件
 * @param {string[]} deletedXObjKeys - 被刪除的 XObject 鍵名清單
 * @param {string[]} deletedExtGStateKeys - 被刪除的 ExtGState 鍵名清單
 * @param {string[]} deletedOcgKeys - 被刪除的 OCG 鍵名清單
 * @returns {void}
 */
function cleanFormXObjectStream(pdfDoc, xObjRef, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys) {
    const stream = pdfDoc.context.lookup(xObjRef);
    if (!(stream instanceof PDFRawStream)) return;

    const newStream = rebuildStreamWithoutReferences(
        pdfDoc,
        stream,
        deletedXObjKeys,
        deletedExtGStateKeys,
        deletedOcgKeys
    );
    if (newStream) {
        pdfDoc.context.assign(xObjRef, newStream); // 替換原始參照
    }
}

/**
 * 共用清除邏輯：依據條件動態移除 Resources 字典下的特定項目
 * 適用於 XObject, ExtGState, Properties 等資源字典。
 *
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @param {PDFDict} resources - 頁面資源字典
 * @param {string} dictKeyName - 目標字典的鍵名 (如 'XObject')
 * @param {Function} shouldDeleteFn - 判斷是否應刪除的回呼函式 (key: PDFName, objRef: PDFRef) => boolean
 * @returns {{count: number, deletedKeys: string[]}} 清除統計與被刪除的鍵名清單
 */
function removeDictEntries(pdfDoc, resources, dictKeyName, shouldDeleteFn) {
    const dictKey = PDFName.of(dictKeyName);
    const dictRef = resources.get(dictKey);
    const dict = pdfDoc.context.lookup(dictRef);
    if (!(dict instanceof PDFDict)) return { count: 0, deletedKeys: [] };

    const deletedKeys = [];
    for (const key of dict.keys()) {
        const objRef = dict.get(key);
        if (shouldDeleteFn(key, objRef)) {
            deletedKeys.push(key);
        }
    }

    if (deletedKeys.length > 0) {
        safeRemoveFromDictionary(pdfDoc, resources, dictKey, dict, dictRef, deletedKeys);
    }
    return { count: deletedKeys.length, deletedKeys: deletedKeys.map((k) => k.value()) };
}

/**
 * 共用清除邏輯：依據條件動態移除 PDF 陣列中的特定項目
 * 採用反向迴圈確保安全移除元素而不影響未處理的索引。
 *
 * @param {PDFArray} pdfArray - 目標 PDF 陣列物件
 * @param {Function} shouldDeleteFn - 判斷是否應刪除的回呼函式 (item: any) => boolean
 * @returns {number} 實際刪除的數量
 */
function removeArrayItems(pdfArray, shouldDeleteFn) {
    let count = 0;
    for (let i = pdfArray.size() - 1; i >= 0; i -= 1) {
        if (shouldDeleteFn(pdfArray.get(i))) {
            pdfArray.remove(i);
            count += 1;
        }
    }
    return count;
}

/**
 *  共用清除邏輯：清除指定的 XObject (支援 Form 與 Image)
 *  根據提供的 Subtype 與欲刪除的參照清單，逐一檢視 Resources 下的 XObject，
 *  若符合條件則將其從資源字典中無損移除。
 *
 *  @param {PDFDocument} pdfDoc - PDF 文件物件
 *  @param {PDFDict} resources - 頁面資源字典
 *  @param {string} targetSubtype - 目標 XObject 的子類型 (如 '/Form' 或 '/Image')
 *  @param {Set<string>} targetDestroySet - 待刪除的目標物件參照字串 Set
 *  @returns {{count: number, deletedKeys: string[]}} 清除統計與被刪除的鍵名清單
 */
function removeXObjects(pdfDoc, resources, targetSubtype, targetDestroySet) {
    return removeDictEntries(pdfDoc, resources, 'XObject', (key, objRef) => {
        if (!objRef) return false;
        const xObject = pdfDoc.context.lookup(objRef);
        const subtype =
            xObject instanceof PDFRawStream ? pdfDoc.context.lookup(xObject.dict.get(PDFName.of('Subtype'))) : null;
        return (
            subtype instanceof PDFName &&
            subtype.toString() === targetSubtype &&
            targetDestroySet.has(objRef.toString())
        );
    });
}

/**
 * 策略三：清除註解 (Annotation)
 * Annots 是蓋在 PDF 正文上方的附加元件（包括電子簽章、印章、批註等）。
 * 直接在 page.node 中將 /Annots 字典鍵值物理刪除即可，此操作不會損害 PDF 頁面結構。
 *
 * @param {PDFPage} page - 目標頁面物件
 * @param {Set<string>} annotsSet - 待刪除的註解參照 Set
 * @returns {number} 實際清除的註解數量
 */
function removeAnnotations(page, annotsSet) {
    const annotsKey = PDFName.of('Annots');
    const annots = page.node.lookup(annotsKey);
    if (!(annots instanceof PDFArray)) {
        if (page.node.has(annotsKey)) {
            // 若存在但不是 Array，保險起見物理刪除
            page.node.delete(annotsKey);
            return 1;
        }
        return 0;
    }

    const removedCount = removeArrayItems(annots, (ref) => annotsSet.has(ref.toString()));

    // 更新頁面的註解欄位
    if (annots.size() === 0) {
        page.node.delete(annotsKey);
    }

    return removedCount;
}

/**
 * 策略四：檢查並清空可疑內容串流 (頁面直接內容)
 * 某些 PDF 會直接在 Contents 內容串流中以明文字串寫出浮水印文字（例如：/Tj "CONFIDENTIAL"）。
 * 由於 PDF 串流通常已被壓縮（FlateDecode），此處透過 getDecodedStreamContents() 在記憶體中解壓縮，
 * 轉為 UTF-8 明文字串比對特徵關鍵字。若命中，則清空該內容串流。
 *
 * @param {PDFDocument} pdfDoc - 文件物件
 * @param {PDFPage} page - 頁面物件
 * @param {Set<string>} directContentsSet - 待刪除的直接內容參照 Set
 * @returns {number} 處理掉的頁面直接內容 (Direct Content) 數量
 */
function removeDirectContent(pdfDoc, page, directContentsSet) {
    const contentsKey = PDFName.of('Contents');
    const contents = pdfDoc.context.lookup(page.node.get(contentsKey));
    if (!contents) return 0;

    let count = 0;
    if (contents instanceof PDFArray) {
        count = removeArrayItems(contents, (ref) => directContentsSet.has(ref.toString()));

        // 若陣列清空，可以考慮移除整個 Contents 鍵，但保留空陣列也符合規範
        if (contents.size() === 0) {
            page.node.delete(contentsKey);
        }
    } else {
        const streamRef = page.node.get(contentsKey);
        if (streamRef) {
            const streamRefStr = streamRef.toString();
            if (directContentsSet.has(streamRefStr)) {
                page.node.delete(contentsKey);
                count += 1;
            }
        }
    }
    return count;
}

/**
 *  策略七：清理 ExtGState 半透明狀態
 *  ExtGState 用於綁定半透明效果的透明度設定。某些浮水印會在這裡綁定名稱含 watermark 的透明組態。
 *  遍歷 Resources 中的 ExtGState 資源，若命名相符，則以空的 ExtGState 物件重置之。
 *
 *  @param {PDFDocument} pdfDoc - 文件物件
 *  @param {PDFDict} resources - 資源字典
 *  @param {number} pageIndex - 當前處理頁面的 0-indexed 索引
 *  @param {Set<string>} extGStatesSet - 待刪除的 ExtGState 參照 Set
 *  @returns {{count: number, deletedKeys: string[]}} 清除統計與被刪除的鍵名清單
 */
function removeExtGState(pdfDoc, resources, pageIndex, extGStatesSet) {
    return removeDictEntries(pdfDoc, resources, 'ExtGState', (key) => {
        const uniqueKey = `${pageIndex}:${key.value()}`;
        return extGStatesSet.has(uniqueKey);
    });
}

/**
 *  策略六（頁面層級）：清理 OCG 圖層浮水印相關的 Properties 與 XObject 資源
 *  針對頁面 Resources 中帶有 /OC 屬性且關聯到待刪除 OCG 的 Properties 與 XObject 進行移除。
 *
 *  @param {PDFDocument} pdfDoc - PDF 文件物件
 *  @param {PDFDict} resources - 頁面資源字典
 *  @param {Set<string>} ocgsSet - 待刪除的 OCG 參照 Set
 *  @returns {{count: number, deletedPropertiesKeys: string[], deletedXObjectKeys: string[]}} 清除統計
 */

function removeOCGs(pdfDoc, resources, ocgsSet) {
    // 1. 清理 Properties 字典中的 OCG 參照
    const propRes = removeDictEntries(pdfDoc, resources, 'Properties', (key, objRef) => {
        return objRef && ocgsSet.has(objRef.toString());
    });

    // 2. 清理 XObject 中帶有 /OC 且關聯到待刪除 OCG 的物件
    const xobjRes = removeDictEntries(pdfDoc, resources, 'XObject', (key, objRef) => {
        if (!objRef) return false;
        const xobj = pdfDoc.context.lookup(objRef);
        if (xobj instanceof PDFRawStream && xobj.dict.has(PDFName.of('OC'))) {
            const ocRef = xobj.dict.get(PDFName.of('OC'));
            const ocStr = ocRef.toString();

            // 直接關聯到 OCG
            if (ocgsSet.has(ocStr)) return true;

            // 可能是 OCMD (Optional Content Membership Dictionary)
            const ocObj = pdfDoc.context.lookup(ocRef);
            if (ocObj instanceof PDFDict && ocObj.has(PDFName.of('OCGs'))) {
                const ocgsInMD = ocObj.get(PDFName.of('OCGs'));
                if (ocgsInMD instanceof PDFArray) {
                    for (let i = 0; i < ocgsInMD.size(); i++) {
                        if (ocgsSet.has(ocgsInMD.get(i).toString())) return true;
                    }
                } else if (ocgsInMD && ocgsSet.has(ocgsInMD.toString())) {
                    return true;
                }
            }
        }
        return false;
    });

    return {
        count: propRes.count + xobjRes.count,
        deletedPropertiesKeys: propRes.deletedKeys,
        deletedXObjectKeys: xobjRes.deletedKeys,
    };
}
/**
 *  策略六（全域層級）：針對全域 OCG (圖層) 進行徹底刪除（從 Catalog 中移除）
 *  @param {PDFDocument} pdfDoc - PDF 文件物件
 *  @param {Set<string>} ocgsSet - 待刪除的 OCG 參照 Set
 *  @returns {number} 清除的 OCG 圖層數量
 */
function removeOCG(pdfDoc, ocgsSet) {
    const catalogDict = pdfDoc.catalog;
    const ocPropertiesRef = catalogDict.get(PDFName.of('OCProperties'));
    if (!ocPropertiesRef) return 0;

    const ocProperties = pdfDoc.context.lookup(ocPropertiesRef);
    if (!(ocProperties instanceof PDFDict)) return 0;

    const ocgsRef = ocProperties.get(PDFName.of('OCGs'));
    if (!ocgsRef) return 0;

    const ocgs = pdfDoc.context.lookup(ocgsRef);
    if (!(ocgs instanceof PDFArray)) return 0;

    // 1. 從 OCGs 陣列中徹底移除
    let count = removeArrayItems(ocgs, (ref) => ocgsSet.has(ref.toString()));

    // 2. 從 D (Default View) 字典的 OFF 與 ON 陣列中移除
    const dDictRef = ocProperties.get(PDFName.of('D'));
    const dDict = pdfDoc.context.lookup(dDictRef);
    if (dDict instanceof PDFDict) {
        const offArray = pdfDoc.context.lookup(dDict.get(PDFName.of('OFF')));
        if (offArray instanceof PDFArray) {
            removeArrayItems(offArray, (ref) => ocgsSet.has(ref.toString()));
        }
        const onArray = pdfDoc.context.lookup(dDict.get(PDFName.of('ON')));
        if (onArray instanceof PDFArray) {
            removeArrayItems(onArray, (ref) => ocgsSet.has(ref.toString()));
        }
    }

    // 如果 OCGs 空了，也可以考慮移除 OCProperties，但保持空陣列也符合標準
    if (ocgs.size() === 0) {
        catalogDict.delete(PDFName.of('OCProperties'));
    }
    return count;
}
