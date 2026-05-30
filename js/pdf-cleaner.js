// ==========================================
// [PDF Processor Engine] 核心清除與置換引擎
// ==========================================


/**
 * 清理 content stream 中對已刪除資源的參考，防止 Acrobat Reader 報錯
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @param {PDFPage} page - 頁面物件
 * @param {string[]} deletedXObjKeys - 被刪除的 XObject 鍵名清單
 * @param {string[]} deletedExtGStateKeys - 被刪除的 ExtGState 鍵名清單
 * @param {string[]} deletedOcgKeys - 被刪除的 OCG 鍵名清單
 */
function cleanContentStreams(pdfDoc, page, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys) {
    const contentsKey = PDFName.of("Contents");
    const contentsRef = page.node.get(contentsKey);
    if (!contentsRef) return;

    const processStream = (streamRef, idxOrKey, contentsArray) => {
        const stream = pdfDoc.context.lookup(streamRef);
        if (stream instanceof PDFRawStream) {
            try {
                const decoded = PDFLib.decodePDFRawStream(stream);
                decoded.reset();
                const bytes = decoded.getBytes();
                let text = "";
                const chunkSize = 16384;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    text += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
                }

                let modified = false;
                for (const key of (deletedXObjKeys || [])) {
                    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
                    const regex = new RegExp('/' + cleanKey + '\\s+Do\\b', 'g');
                    const newText = text.replace(regex, '');
                    if (newText !== text) {
                        text = newText;
                        modified = true;
                    }
                }
                for (const key of (deletedExtGStateKeys || [])) {
                    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
                    const regex = new RegExp('/' + cleanKey + '\\s+gs\\b', 'g');
                    const newText = text.replace(regex, '');
                    if (newText !== text) {
                        text = newText;
                        modified = true;
                    }
                }
                for (const key of (deletedOcgKeys || [])) {
                    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
                    const regex = new RegExp('/OC\\s+/' + cleanKey + '\\s+BDC[\\s\\S]*?EMC', 'g');
                    const newText = text.replace(regex, '');
                    if (newText !== text) {
                        text = newText;
                        modified = true;
                    }
                }
                if (modified) {
                    const arr = new Uint8Array(text.length);
                    for (let i = 0; i < text.length; i++) {
                        arr[i] = text.charCodeAt(i) & 0xff;
                    }
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
        const contentsKey = PDFName.of("Contents");
        const contents = page.node.lookup(contentsKey);
        if (contents instanceof PDFArray) {
            page.node.set(contentsKey, contents.clone(pdfDoc.context));
        }

        // 取得當前頁面的 Resources 資源字典以分析 XObject 等子物件
        let resources = page.node.lookup(PDFName.of("Resources"));
        if (!(resources instanceof PDFDict)) {
            continue;
        }

        // 複製 Resources 字典以進行單頁隔離，避免共用資源導致修改影響其他頁面
        if (resources.clone) {
            resources = resources.clone(pdfDoc.context);
            page.node.set(PDFName.of("Resources"), resources);
        }

        // 策略一：清除 Form XObject 浮水印
        if (options.removeFormXObject) {
            const res = removeFormXObjects(pdfDoc, resources);
            modifiedObjects += res.count;
            if (res.deletedKeys) allDeletedXObjectKeys.push(...res.deletedKeys);
        }

        // 策略二：清除註解 (Annotation)
        if (options.removeAnnotations) {
            modifiedObjects += removeAnnotations(page);
        }

        // 策略三：清除頁面直接內容 (Direct Content)
        if (options.removeDirectContent) {
            modifiedObjects += removeDirectContent(pdfDoc, page);
        }

        // 策略四：清除影像外部物件 (Image XObject)
        if (options.removeImageXObject) {
            const res = removeImageXObjects(pdfDoc, resources, pageIndex);
            modifiedObjects += res.count;
            if (res.deletedKeys) allDeletedXObjectKeys.push(...res.deletedKeys);
        }

        // 策略五：清除延伸圖形狀態 (ExtGState)
        let allDeletedExtGStateKeys = [];
        if (options.removeExtGState) {
            const resExt = removeExtGState(pdfDoc, resources, pageIndex);
            modifiedObjects += resExt.count;
            if (resExt.deletedKeys) allDeletedExtGStateKeys.push(...resExt.deletedKeys);
        }

        // 策略六：清除 OCG 圖層
        let allDeletedOcgKeys = [];
        if (options.removeOCG) {
            const resOcg = removeOCGs(pdfDoc, resources);
            modifiedObjects += resOcg.count;
            if (resOcg.deletedPropertiesKeys) allDeletedOcgKeys.push(...resOcg.deletedPropertiesKeys);
            if (resOcg.deletedXObjectKeys) allDeletedXObjectKeys.push(...resOcg.deletedXObjectKeys);
        }

        // 清理 content stream 中對已刪除資源的參考，防止 Acrobat Reader 報錯
        if (allDeletedXObjectKeys.length > 0 || allDeletedExtGStateKeys.length > 0 || allDeletedOcgKeys.length > 0) {
            cleanContentStreams(pdfDoc, page, allDeletedXObjectKeys, allDeletedExtGStateKeys, allDeletedOcgKeys);
        }
    }


    return { modifiedObjects };
}

/**
 * 策略一：清除 Form XObject 浮水印
 * Form XObject 是 PDF 用來儲存可重複使用之圖形或背景向量文字的獨立封裝物件。
 * 大部分的文字浮水印和灰色對角斜線浮水印都屬於此類別。
 * 逐一檢視 Resources 下的所有 XObject，若符合條件則將其從資源字典中移除。
 * 
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @param {PDFDict} resources - 頁面資源字典
 * @returns {number} 清除的 Form XObject 數量
 */
function removeFormXObjects(pdfDoc, resources) {
    const xObjectsKey = PDFName.of("XObject");
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
        // 直接從已查詢好的 xObject 取 Subtype，不重複呼叫 context.lookup
        const subtype = xObject instanceof PDFRawStream ? xObject.dict.get(PDFName.of("Subtype")) : null;

        if (subtype instanceof PDFName && subtype.toString() === "/Form") {
            // 檢查冪等狀態：若該物件已完成清除，則跳過以避免重複處理
            if (xObject instanceof PDFRawStream && xObject.dict.has(PDFName.of("IsWatermarkRemoved"))) {
                continue;
            }

            let shouldRemove = false;
            if (formXObjectsToDestroy.includes(refStr)) {
                shouldRemove = true;
            }

            if (shouldRemove) {
                deletedKeys.push(key);
            }
        }
    }

    if (deletedKeys.length > 0) {
        // 若有需要刪除的，將 XObject 字典拷貝一份，避免影響其他頁面
        if (xObjects.clone) {
            xObjects = xObjects.clone(pdfDoc.context);
            if (xObjectsRef && typeof xObjectsRef.clone === 'function' && !resources.has(xObjectsKey)) {
                resources.set(xObjectsKey, xObjects);
            } else {
                resources.set(xObjectsKey, pdfDoc.context.register(xObjects));
            }
        }
        for (const key of deletedKeys) {
            xObjects.delete(key);
        }
        count = deletedKeys.length;
    }
    return { count, deletedKeys: deletedKeys.map(k => k.value()) };
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
    const annotsKey = PDFName.of("Annots");
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
    const contentsKey = PDFName.of("Contents");
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
 * 策略四：清理 ExtGState 半透明狀態
 * ExtGState 用於綁定半透明效果的透明度設定。某些浮水印會在這裡綁定名稱含 watermark 的透明組態。
 * 遍歷 Resources 中的 ExtGState 資源，若命名相符，則以空的 ExtGState 物件重置之。
 * 
 * @param {PDFDocument} pdfDoc - 文件物件
 * @param {PDFDict} resources - 資源字典
 * @returns {number} 處理掉的 ExtGState 數量
 */
function removeExtGState(pdfDoc, resources, pageIndex) {
    const extGStateKey = PDFName.of("ExtGState");
    const extGStateRef = resources.get(extGStateKey);
    let extGState = pdfDoc.context.lookup(extGStateRef);
    if (!(extGState instanceof PDFDict)) return 0;

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
        if (extGState.clone) {
            extGState = extGState.clone(pdfDoc.context);
            if (extGStateRef && typeof extGStateRef.clone === 'function' && !resources.has(extGStateKey)) {
                resources.set(extGStateKey, extGState);
            } else {
                resources.set(extGStateKey, pdfDoc.context.register(extGState));
            }
        }
        for (const key of deletedKeys) {
            extGState.delete(key);
        }
        count = deletedKeys.length;
    }
    return { count, deletedKeys: deletedKeys.map(k => k.value()) };
}

/**
 * 策略五：隱藏 OCG 圖層浮水印 (Optional Content Group)
 * OCG 圖層控制的浮水印定義在 PDF Document Catalog 的 /OCProperties 中。
 * 找到所有的圖層清單 (/OCGs Array)，比對圖層的 indirect reference 是否在 ocgsToDestroy 中。
 * 若符合，則將該 OCG 圖層的 Reference 加入到 /D (Default View) 字典的 /OFF 陣列中，以達到隱藏的效果。
 * 
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @returns {number} 隱藏 of OCG 圖層數量
 */

function removeOCGs(pdfDoc, resources) {
    let count = 0;
    const deletedPropertiesKeys = [];
    const deletedXObjectKeys = [];

    // 1. 清理 Properties 字典中的 OCG 參照
    const propertiesKey = PDFName.of("Properties");
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
                if (properties.clone) {
                    properties = properties.clone(pdfDoc.context);
                    if (typeof propertiesRef.clone === 'function' && !resources.has(propertiesKey)) {
                        resources.set(propertiesKey, properties);
                    } else {
                        resources.set(propertiesKey, pdfDoc.context.register(properties));
                    }
                }
                for (const key of deletedPropertiesKeys) {
                    properties.delete(key);
                }
                count += deletedPropertiesKeys.length;
            }
        }
    }

    // 2. 清理 XObject 中帶有 /OC 且關聯到待刪除 OCG 的物件
    const xobjKey = PDFName.of("XObject");
    const xobjRef = resources.get(xobjKey);
    if (xobjRef) {
        let xobjects = pdfDoc.context.lookup(xobjRef);
        if (xobjects instanceof PDFDict) {
            const keysToDelete = [];
            for (const key of xobjects.keys()) {
                const xobj = pdfDoc.context.lookup(xobjects.get(key));
                if (xobj instanceof PDFRawStream && xobj.dict.has(PDFName.of("OC"))) {
                    const ocRef = xobj.dict.get(PDFName.of("OC"));
                    const ocStr = ocRef.toString();
                    let shouldDelete = false;

                    // 直接關聯到 OCG
                    if (ocgsToDestroy.includes(ocStr)) {
                        shouldDelete = true;
                    } else {
                        // 可能是 OCMD (Optional Content Membership Dictionary)
                        const ocObj = pdfDoc.context.lookup(ocRef);
                        if (ocObj instanceof PDFDict && ocObj.has(PDFName.of("OCGs"))) {
                            const ocgsInMD = ocObj.get(PDFName.of("OCGs"));
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
                if (xobjects.clone) {
                    xobjects = xobjects.clone(pdfDoc.context);
                    if (typeof xobjRef.clone === 'function' && !resources.has(xobjKey)) {
                        resources.set(xobjKey, xobjects);
                    } else {
                        resources.set(xobjKey, pdfDoc.context.register(xobjects));
                    }
                }
                for (const key of keysToDelete) {
                    xobjects.delete(key);
                    deletedXObjectKeys.push(key.value());
                }
                count += keysToDelete.length;
            }
        }
    }

    return { count, deletedPropertiesKeys: deletedPropertiesKeys.map(k => k.value()), deletedXObjectKeys };
}
/**
 * 針對全域 OCG (圖層) 進行徹底刪除（從 Catalog 中移除）
 * @param {PDFDocument} pdfDoc - PDF 文件物件
 * @returns {number} 清除的 OCG 圖層數量
 */
function removeOCG(pdfDoc) {
    const catalogDict = pdfDoc.catalog;
    const ocPropertiesRef = catalogDict.get(PDFName.of("OCProperties"));
    if (!ocPropertiesRef) return 0;

    const ocProperties = pdfDoc.context.lookup(ocPropertiesRef);
    if (!(ocProperties instanceof PDFDict)) return 0;

    const ocgsRef = ocProperties.get(PDFName.of("OCGs"));
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
    const dDictRef = ocProperties.get(PDFName.of("D"));
    const dDict = pdfDoc.context.lookup(dDictRef);
    if (dDict instanceof PDFDict) {
        const offArray = pdfDoc.context.lookup(dDict.get(PDFName.of("OFF")));
        if (offArray instanceof PDFArray) {
            for (let idx = offArray.size() - 1; idx >= 0; idx -= 1) {
                if (ocgsToDestroy.includes(offArray.get(idx).toString())) {
                    offArray.remove(idx);
                }
            }
        }
        const onArray = pdfDoc.context.lookup(dDict.get(PDFName.of("ON")));
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
        catalogDict.delete(PDFName.of("OCProperties"));
    }

    return count;
}

/**
 * 策略六：清除圖片型浮水印 (Image XObject)
 * 當浮水印是由圖片（如公司 LOGO、透明圖片章）組成時，其在資源樹中為 /Image。
 * 我們會檢查圖片元件的命名與頁面索引的結合鍵是否在 imagesToDestroy 中。
 * 若符合，則將其從資源字典中移除。
 * 
 * @param {PDFDocument} pdfDoc - 文件物件
 * @param {PDFDict} resources - 頁面資源字典
 * @param {number} pageIndex - 當前處理頁面的 0-indexed 索引
 * @returns {number} 處理掉的 Image 數量
 */
function removeImageXObjects(pdfDoc, resources, pageIndex) {
    const xObjects = pdfDoc.context.lookup(resources.get(PDFName.of("XObject")));
    if (!(xObjects instanceof PDFDict)) return { count: 0, deletedKeys: [] };

    let count = 0;
    const deletedKeys = [];
    for (const key of xObjects.keys()) {
        const xObject = pdfDoc.context.lookup(xObjects.get(key));
        const subtype = xObject instanceof PDFRawStream ? pdfDoc.context.lookup(xObject.dict.get(PDFName.of("Subtype"))) : null;

        if (subtype instanceof PDFName && subtype.toString() === "/Image") {
            const name = key.value();
            const uniqueKey = `${pageIndex}:${name}`;
            // 比對被選定要清除的影像
            if (imagesToDestroy.includes(uniqueKey)) {
                xObjects.delete(key);
                deletedKeys.push(key.value());
                count += 1;
            }
        }
    }
    return { count, deletedKeys };
}
