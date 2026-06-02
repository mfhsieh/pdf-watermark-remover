// ==========================================
// [PDF Processor Engine] 核心清除與置換引擎
// ==========================================

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
 */
function safeRemoveFromDictionary(pdfDoc, resources, dictKey, targetDict, targetRef, keysToRemove) {
    if (keysToRemove.length === 0) return;

    let dictToModify = targetDict;
    if (dictToModify.clone) {
        dictToModify = dictToModify.clone(pdfDoc.context);
        if (targetRef && typeof targetRef.clone === 'function' && !resources.has(dictKey)) {
            resources.set(dictKey, dictToModify);
        } else {
            resources.set(dictKey, pdfDoc.context.register(dictToModify));
        }
    }
    for (const key of keysToRemove) {
        dictToModify.delete(key);
    }
}

/**
 * 共用的字串置換輔助函式，用於從 Content Stream 中移除對已刪除資源的參照 (如 Do, gs, OCG)
 * @param {string} text - 原始內容流文字
 * @param {string[]} deletedXObjKeys - 被刪除的 XObject 鍵名清單
 * @param {string[]} deletedExtGStateKeys - 被刪除的 ExtGState 鍵名清單
 * @param {string[]} deletedOcgKeys - 被刪除的 OCG 鍵名清單
 * @returns {{text: string, modified: boolean}} 置換後的文字與是否被修改的布林值
 */
function removeDeletedReferencesFromText(text, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys) {
    let modified = false;
    let newText = text;

    for (const key of deletedXObjKeys || []) {
        const cleanKey = key.startsWith('/') ? key.substring(1) : key;
        if (newText.includes('/' + cleanKey)) {
            const regex = new RegExp('/' + escapeRegex(cleanKey) + '\\s+Do\\b', 'g');
            const replaced = newText.replace(regex, '');
            if (replaced !== newText) {
                newText = replaced;
                modified = true;
            }
        }
    }
    for (const key of deletedExtGStateKeys || []) {
        const cleanKey = key.startsWith('/') ? key.substring(1) : key;
        if (newText.includes('/' + cleanKey)) {
            const regex = new RegExp('/' + escapeRegex(cleanKey) + '\\s+gs\\b', 'g');
            const replaced = newText.replace(regex, '');
            if (replaced !== newText) {
                newText = replaced;
                modified = true;
            }
        }
    }
    for (const key of deletedOcgKeys || []) {
        const cleanKey = key.startsWith('/') ? key.substring(1) : key;
        if (newText.includes('/' + cleanKey)) {
            const regex = new RegExp('/OC\\s+/' + escapeRegex(cleanKey) + '\\s+BDC[\\s\\S]*?EMC', 'g');
            const replaced = newText.replace(regex, '');
            if (replaced !== newText) {
                newText = replaced;
                modified = true;
            }
        }
    }
    return { text: newText, modified };
}

/**
 * 清理 content stream 中對已刪除資源的參考，防止 Acrobat Reader 報錯
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @param {PDFPage} page - 頁面物件
 * @param {string[]} deletedXObjKeys - 被刪除的 XObject 鍵名清單
 * @param {string[]} deletedExtGStateKeys - 被刪除的 ExtGState 鍵名清單
 * @param {string[]} deletedOcgKeys - 被刪除的 OCG 鍵名清單
 */
function cleanContentStreams(pdfDoc, page, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys) {
    const contentsKey = PDFName.of('Contents');
    const contentsRef = page.node.get(contentsKey);
    if (!contentsRef) return;

    const processStream = (streamRef, idxOrKey, contentsArray) => {
        const stream = pdfDoc.context.lookup(streamRef);
        if (stream instanceof PDFRawStream) {
            try {
                const bytes = getDecodedStreamContents(stream);
                let text = decodeBinaryToText(bytes);

                const result = removeDeletedReferencesFromText(
                    text,
                    deletedXObjKeys,
                    deletedExtGStateKeys,
                    deletedOcgKeys
                );

                if (result.modified) {
                    const arr = encodeTextToBinary(result.text);
                    // Trade-off: 此處以空字典建立新串流，捨棄了原有的壓縮 (如 FlateDecode Filter)。
                    // 雖然會使處理後的 PDF 體積微幅增加，但能確保修改後內容流的結構穩定性，避免 Acrobat 報錯。
                    const emptyDict = pdfDoc.context.obj({});
                    const newStream = pdfDoc.context.stream(arr, emptyDict);
                    const newRef = pdfDoc.context.register(newStream);
                    if (contentsArray) {
                        contentsArray.set(idxOrKey, newRef);
                    } else {
                        page.node.set(contentsKey, newRef);
                    }
                }
            } catch (e) {
                console.error('Failed to clean stream', e);
            }
        }
    };

    const contentsObj = pdfDoc.context.lookup(contentsRef);
    if (contentsObj instanceof PDFArray) {
        for (let idx = 0; idx < contentsObj.size(); idx += 1) {
            processStream(contentsObj.get(idx), idx, contentsObj);
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
 * @param {Object} options - 包含 6 大清理策略勾選狀態的布林值物件
 * @returns {Object} 包含 modifiedObjects (已被修改/置換的物件總數) 的統計物件
 */
function processPdf(pdfDoc, options) {
    let modifiedObjects = 0;

    // 針對全域 OCG (圖層) 進行徹底刪除（從 Catalog 中移除）
    if (options.removeOCG) {
        modifiedObjects += removeOCG(pdfDoc);
    }

    // 循序遍歷處理每一頁，確保修改的隔離性
    for (let pageIndex = 0; pageIndex < pdfDoc.getPageCount(); pageIndex += 1) {
        const page = pdfDoc.getPage(pageIndex);
        let allDeletedXObjectKeys = [];

        // 複製 Contents 陣列以進行單頁隔離，避免多頁共享時的修改互相干擾
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

        // 複製 Resources 字典以進行單頁隔離，避免共用資源導致修改影響其他頁面
        if (resources.clone) {
            resources = resources.clone(pdfDoc.context);
            page.node.set(PDFName.of('Resources'), resources);
        }

        // 策略二：清除註解 (Annotation)
        if (options.removeAnnotations) {
            modifiedObjects += removeAnnotations(page);
        }

        // 策略三：清除頁面直接內容 (Direct Content)
        if (options.removeDirectContent) {
            modifiedObjects += removeDirectContent(pdfDoc, page);
        }

        let allDeletedExtGStateKeys = [];
        let allDeletedOcgKeys = [];

        // 遞迴清理 Resources (含 XObject, Image, ExtGState, OCG)
        modifiedObjects += cleanResourcesRecursively(
            pdfDoc,
            resources,
            pageIndex,
            options,
            allDeletedXObjectKeys,
            allDeletedExtGStateKeys,
            allDeletedOcgKeys
        );

        // 清理 content stream 中對已刪除資源的參考，防止 Acrobat Reader 報錯
        if (allDeletedXObjectKeys.length > 0 || allDeletedExtGStateKeys.length > 0 || allDeletedOcgKeys.length > 0) {
            cleanContentStreams(pdfDoc, page, allDeletedXObjectKeys, allDeletedExtGStateKeys, allDeletedOcgKeys);
        }
    }

    return { modifiedObjects };
}

/**
 * 遞迴清理 Resources (支援巢狀 Form XObject)
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @param {PDFDict} resources - 資源字典物件
 * @param {number} pageIndex - 當前處理頁面的 0-indexed 索引
 * @param {Object} options - 包含清理策略的選項物件
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
    allDeletedXObjectKeys,
    allDeletedExtGStateKeys,
    allDeletedOcgKeys
) {
    let count = 0;

    if (options.removeFormXObject) {
        const res = removeXObjects(pdfDoc, resources, '/Form', formXObjectsToDestroy);
        count += res.count;
        if (res.deletedKeys) allDeletedXObjectKeys.push(...res.deletedKeys);
    }
    if (options.removeImageXObject) {
        const res = removeXObjects(pdfDoc, resources, '/Image', imagesToDestroy);
        count += res.count;
        if (res.deletedKeys) allDeletedXObjectKeys.push(...res.deletedKeys);
    }
    if (options.removeExtGState) {
        const resExt = removeExtGState(pdfDoc, resources, pageIndex);
        count += resExt.count;
        if (resExt.deletedKeys) allDeletedExtGStateKeys.push(...resExt.deletedKeys);
    }
    if (options.removeOCG) {
        const resOcg = removeOCGs(pdfDoc, resources);
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
 */
function cleanFormXObjectStream(pdfDoc, xObjRef, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys) {
    const stream = pdfDoc.context.lookup(xObjRef);
    if (!(stream instanceof PDFRawStream)) return;
    try {
        const bytes = getDecodedStreamContents(stream);
        let text = decodeBinaryToText(bytes);

        const result = removeDeletedReferencesFromText(text, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys);

        if (result.modified) {
            const arr = encodeTextToBinary(result.text);
            const newDict = stream.dict.clone(pdfDoc.context);
            // Trade-off: 移除原本的 Filter 與 Length，讓 pdf-lib 重新儲存時能正確處理內容長度。
            // 捨棄原本的壓縮演算法以換取修改後的結構穩定性，避免 Acrobat 報錯損毀。
            newDict.delete(PDFLib.PDFName.of('Filter'));
            newDict.delete(PDFLib.PDFName.of('Length'));

            const newStream = pdfDoc.context.stream(arr, newDict);
            pdfDoc.context.assign(xObjRef, newStream); // 替換原始參照
        }
    } catch (e) {
        console.error('Failed to clean Form XObject stream', e);
    }
}

/**
 *  共用清除邏輯：清除指定的 XObject (支援 Form 與 Image)
 *  根據提供的 Subtype 與欲刪除的參照清單，逐一檢視 Resources 下的 XObject，
 *  若符合條件則將其從資源字典中無損移除。
 *
 *  @param {PDFDocument} pdfDoc - PDF 文件物件
 *  @param {PDFDict} resources - 頁面資源字典
 *  @param {string} targetSubtype - 目標 XObject 的子類型 (如 '/Form' 或 '/Image')
 *  @param {string[]} targetDestroyList - 待刪除的目標物件參照字串陣列
 *  @returns {{count: number, deletedKeys: string[]}} 清除統計與被刪除的鍵名清單
 */
function removeXObjects(pdfDoc, resources, targetSubtype, targetDestroyList) {
    const xObjectsKey = PDFName.of('XObject');
    const xObjectsRef = resources.get(xObjectsKey);
    let xObjects = pdfDoc.context.lookup(xObjectsRef);
    if (!(xObjects instanceof PDFDict)) return { count: 0, deletedKeys: [] };

    let count = 0;
    const deletedKeys = [];
    for (const key of xObjects.keys()) {
        const xObjRef = xObjects.get(key);
        if (!xObjRef) continue;
        const refStr = xObjRef.toString();
        const xObject = pdfDoc.context.lookup(xObjRef);
        const subtype = xObject instanceof PDFRawStream ? pdfDoc.context.lookup(xObject.dict.get(PDFName.of('Subtype'))) : null;

        if (subtype instanceof PDFName && subtype.toString() === targetSubtype) {
            if (targetDestroyList.includes(refStr)) {
                deletedKeys.push(key);
            }
        }
    }

    if (deletedKeys.length > 0) {
        safeRemoveFromDictionary(pdfDoc, resources, xObjectsKey, xObjects, xObjectsRef, deletedKeys);
        count = deletedKeys.length;
    }
    return { count, deletedKeys: deletedKeys.map((k) => k.value()) };
}

/**
 * 策略二：清除註解 (Annotation)
 * Annots 是蓋在 PDF 正文上方的附加元件（包括電子簽章、印章、批註等）。
 * 直接在 page.node 中將 /Annots 字典鍵值物理刪除即可，此操作不會損害 PDF 頁面結構。
 *
 * @param {PDFPage} page - 目標頁面物件
 * @returns {number} 實際清除的註解數量
 */
function removeAnnotations(page) {
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

    const context = page.node.context;
    const newAnnots = context.obj([]);
    let removedCount = 0;

    for (let idx = 0; idx < annots.size(); idx += 1) {
        const annotRef = annots.get(idx);
        const annotRefStr = annotRef.toString();

        if (annotsToDestroy.includes(annotRefStr)) {
            removedCount += 1;
        } else {
            newAnnots.push(annotRef);
        }
    }

    // 更新頁面的註解欄位
    if (newAnnots.size() === 0) {
        page.node.delete(annotsKey);
    } else {
        page.node.set(annotsKey, newAnnots);
    }

    return removedCount;
}

/**
 * 策略三：檢查並清空可疑內容流
 * 某些 PDF 會直接在 Contents 內容流中以明文字串寫出浮水印文字（例如：/Tj "CONFIDENTIAL"）。
 * 由於 PDF 串流通常已被壓縮（FlateDecode），此處透過 getDecodedStreamContents() 在記憶體中解壓縮，
 * 轉為 UTF-8 明文字串比對特徵關鍵字。若命中，則清空該內容流。
 *
 * @param {PDFDocument} pdfDoc - 文件物件
 * @param {PDFPage} page - 頁面物件
 * @returns {number} 處理掉的頁面直接內容 (Direct Content) 數量
 */
function removeDirectContent(pdfDoc, page) {
    const contentsKey = PDFName.of('Contents');
    const contents = pdfDoc.context.lookup(page.node.get(contentsKey));
    if (!contents) return 0;

    let count = 0;
    if (contents instanceof PDFArray) {
        for (let idx = contents.size() - 1; idx >= 0; idx -= 1) {
            const streamRef = contents.get(idx);
            const streamRefStr = streamRef.toString();

            if (directContentsToDestroy.includes(streamRefStr)) {
                contents.remove(idx);
                count += 1;
            }
        }

        // 若陣列清空，可以考慮移除整個 Contents 鍵，但保留空陣列也符合規範
        if (contents.size() === 0) {
            page.node.delete(contentsKey);
        }
    } else {
        const streamRef = page.node.get(contentsKey);
        if (streamRef) {
            const streamRefStr = streamRef.toString();
            if (directContentsToDestroy.includes(streamRefStr)) {
                page.node.delete(contentsKey);
                count += 1;
            }
        }
    }
    return count;
}

/**
 *  策略五：清理 ExtGState 半透明狀態
 *  ExtGState 用於綁定半透明效果的透明度設定。某些浮水印會在這裡綁定名稱含 watermark 的透明組態。
 *  遍歷 Resources 中的 ExtGState 資源，若命名相符，則以空的 ExtGState 物件重置之。
 *
 *  @param {PDFDocument} pdfDoc - 文件物件
 *  @param {PDFDict} resources - 資源字典
 *  @param {number} pageIndex - 當前處理頁面的 0-indexed 索引
 *  @returns {{count: number, deletedKeys: string[]}} 清除統計與被刪除的鍵名清單
 */
function removeExtGState(pdfDoc, resources, pageIndex) {
    const extGStateKey = PDFName.of('ExtGState');
    const extGStateRef = resources.get(extGStateKey);
    let extGState = pdfDoc.context.lookup(extGStateRef);
    if (!(extGState instanceof PDFDict)) return { count: 0, deletedKeys: [] };

    let count = 0;
    const deletedKeys = [];
    for (const key of extGState.keys()) {
        const keyName = key.value();
        const uniqueKey = `${pageIndex}:${keyName}`;
        if (extGStatesToDestroy.includes(uniqueKey)) {
            deletedKeys.push(key);
        }
    }

    if (deletedKeys.length > 0) {
        safeRemoveFromDictionary(pdfDoc, resources, extGStateKey, extGState, extGStateRef, deletedKeys);
        count = deletedKeys.length;
    }
    return { count, deletedKeys: deletedKeys.map((k) => k.value()) };
}

/**
 *  策略六（頁面層級）：清理 OCG 圖層浮水印相關的 Properties 與 XObject 資源
 *  針對頁面 Resources 中帶有 /OC 屬性且關聯到待刪除 OCG 的 Properties 與 XObject 進行移除。
 *
 *  @param {PDFDocument} pdfDoc - PDF 文件物件
 *  @param {PDFDict} resources - 頁面資源字典
 *  @returns {{count: number, deletedPropertiesKeys: string[], deletedXObjectKeys: string[]}} 清除統計
 */

function removeOCGs(pdfDoc, resources) {
    let count = 0;
    const deletedPropertiesKeys = [];
    const deletedXObjectKeys = [];

    // 1. 清理 Properties 字典中的 OCG 參照
    const propertiesKey = PDFName.of('Properties');
    const propertiesRef = resources.get(propertiesKey);
    if (propertiesRef) {
        let properties = pdfDoc.context.lookup(propertiesRef);
        if (properties instanceof PDFDict) {
            for (const key of properties.keys()) {
                const ocgRef = properties.get(key);
                if (!ocgRef) continue;
                if (ocgsToDestroy.includes(ocgRef.toString())) {
                    deletedPropertiesKeys.push(key);
                }
            }

            if (deletedPropertiesKeys.length > 0) {
                safeRemoveFromDictionary(
                    pdfDoc,
                    resources,
                    propertiesKey,
                    properties,
                    propertiesRef,
                    deletedPropertiesKeys
                );
                count += deletedPropertiesKeys.length;
            }
        }
    }

    // 2. 清理 XObject 中帶有 /OC 且關聯到待刪除 OCG 的物件
    const xobjKey = PDFName.of('XObject');
    const xobjRef = resources.get(xobjKey);
    if (xobjRef) {
        let xobjects = pdfDoc.context.lookup(xobjRef);
        if (xobjects instanceof PDFDict) {
            const keysToDelete = [];
            for (const key of xobjects.keys()) {
                const xobj = pdfDoc.context.lookup(xobjects.get(key));
                if (xobj instanceof PDFRawStream && xobj.dict.has(PDFName.of('OC'))) {
                    const ocRef = xobj.dict.get(PDFName.of('OC'));
                    const ocStr = ocRef.toString();
                    let shouldDelete = false;

                    // 直接關聯到 OCG
                    if (ocgsToDestroy.includes(ocStr)) {
                        shouldDelete = true;
                    } else {
                        // 可能是 OCMD (Optional Content Membership Dictionary)
                        const ocObj = pdfDoc.context.lookup(ocRef);
                        if (ocObj instanceof PDFDict && ocObj.has(PDFName.of('OCGs'))) {
                            const ocgsInMD = ocObj.get(PDFName.of('OCGs'));
                            if (ocgsInMD instanceof PDFArray) {
                                for (let i = 0; i < ocgsInMD.size(); i++) {
                                    if (ocgsToDestroy.includes(ocgsInMD.get(i).toString())) {
                                        shouldDelete = true;
                                        break;
                                    }
                                }
                            } else if (ocgsInMD && ocgsToDestroy.includes(ocgsInMD.toString())) {
                                shouldDelete = true;
                            }
                        }
                    }

                    if (shouldDelete) {
                        keysToDelete.push(key);
                    }
                }
            }

            if (keysToDelete.length > 0) {
                safeRemoveFromDictionary(pdfDoc, resources, xobjKey, xobjects, xobjRef, keysToDelete);
                for (const key of keysToDelete) {
                    deletedXObjectKeys.push(key.value());
                }
                count += keysToDelete.length;
            }
        }
    }

    return { count, deletedPropertiesKeys: deletedPropertiesKeys.map((k) => k.value()), deletedXObjectKeys };
}
/**
 *  策略六（全域層級）：針對全域 OCG (圖層) 進行徹底刪除（從 Catalog 中移除）
 *  @param {PDFDocument} pdfDoc - PDF 文件物件
 *  @returns {number} 清除的 OCG 圖層數量
 */
function removeOCG(pdfDoc) {
    const catalogDict = pdfDoc.catalog;
    const ocPropertiesRef = catalogDict.get(PDFName.of('OCProperties'));
    if (!ocPropertiesRef) return 0;

    const ocProperties = pdfDoc.context.lookup(ocPropertiesRef);
    if (!(ocProperties instanceof PDFDict)) return 0;

    const ocgsRef = ocProperties.get(PDFName.of('OCGs'));
    if (!ocgsRef) return 0;

    const ocgs = pdfDoc.context.lookup(ocgsRef);
    if (!(ocgs instanceof PDFArray)) return 0;

    let count = 0;

    // 1. 從 OCGs 陣列中徹底移除
    for (let idx = ocgs.size() - 1; idx >= 0; idx -= 1) {
        const ocgRef = ocgs.get(idx);
        if (ocgsToDestroy.includes(ocgRef.toString())) {
            ocgs.remove(idx);
            count += 1;
        }
    }

    // 2. 從 D (Default View) 字典的 OFF 與 ON 陣列中移除
    const dDictRef = ocProperties.get(PDFName.of('D'));
    const dDict = pdfDoc.context.lookup(dDictRef);
    if (dDict instanceof PDFDict) {
        const offArray = pdfDoc.context.lookup(dDict.get(PDFName.of('OFF')));
        if (offArray instanceof PDFArray) {
            for (let idx = offArray.size() - 1; idx >= 0; idx -= 1) {
                if (ocgsToDestroy.includes(offArray.get(idx).toString())) {
                    offArray.remove(idx);
                }
            }
        }
        const onArray = pdfDoc.context.lookup(dDict.get(PDFName.of('ON')));
        if (onArray instanceof PDFArray) {
            for (let idx = onArray.size() - 1; idx >= 0; idx -= 1) {
                if (ocgsToDestroy.includes(onArray.get(idx).toString())) {
                    onArray.remove(idx);
                }
            }
        }
    }

    // 如果 OCGs 空了，也可以考慮移除 OCProperties，但保持空陣列也符合標準
    if (ocgs.size() === 0) {
        catalogDict.delete(PDFName.of('OCProperties'));
    }
}
