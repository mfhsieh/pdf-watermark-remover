// ==========================================
// [Preview Engine] PDF 即時預覽生成器
// ==========================================

/**
 * 輔助函數：將 Uint8Array 以 zlib/deflate 解壓縮
 * PDF 的 FlateDecode 為標準 zlib 格式，瀏覽器對應的 DecompressionStream 格式為 "deflate"。
 * 若失敗則嘗試 "deflate-raw"（無 zlib header 的 raw deflate）。
 * @param {Uint8Array} data - 壓縮後的原始位元組
 * @returns {Promise<Uint8Array>} 解壓縮後的位元組
 */
async function decompressFlateDecode(data) {
    /**
     * 使用指定格式進行解壓縮的內部實作
     * @param {string} format - 'deflate' 或 'deflate-raw'
     */
    async function tryDecompress(format) {
        const ds = new DecompressionStream(format);
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        writer.write(data);
        writer.close();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const total = chunks.reduce((a, c) => a + c.length, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
        return merged;
    }

    try {
        return await tryDecompress("deflate");
    } catch (e) {
        console.warn("deflate 解壓縮失敗，嘗試 deflate-raw", e);
        try {
            return await tryDecompress("deflate-raw");
        } catch (e2) {
            console.warn("deflate-raw 也失敗，使用原始未壓縮資料", e2);
            return data;
        }
    }
}

/**
 * 從頁面的 Contents Stream 中，提取呼叫指定 XObject 前完整的繪圖指令區塊（含 cm 矩陣）
 * @param {PDFDocument} srcDoc - 原始 PDF 文件物件
 * @param {number} pageIndex - 頁面索引 (0-indexed)
 * @param {string} cleanKeyName - 資源鍵名 (不含前綴斜線)
 * @returns {Promise<string|null>} 提取出的繪圖指令字串，若找不到則回傳 null
 */
async function extractXObjectDrawBlock(srcDoc, pageIndex, cleanKeyName) {
    const page = srcDoc.getPage(pageIndex);
    const contentsRef = page.node.get(PDFName.of("Contents"));
    const contents = srcDoc.context.lookup(contentsRef);

    const streams = [];
    if (contents instanceof PDFArray) {
        for (let i = 0; i < contents.size(); i++) {
            streams.push(srcDoc.context.lookup(contents.get(i)));
        }
    } else if (contents) {
        streams.push(contents);
    }

    const doToken = `/${cleanKeyName} Do`;

    for (const stream of streams) {
        if (!(stream instanceof PDFRawStream)) continue;

        let data = stream.contents;
        // 嘗試解壓縮（FlateDecode），統一由輔助函數處理
        const filter = stream.dict.get(PDFName.of("Filter"));
        if (filter && filter.toString() === "/FlateDecode") {
            data = await decompressFlateDecode(stream.contents);
        }

        // 轉為字串搜尋
        const text = new TextDecoder("latin1").decode(data);
        const doIdx = text.indexOf(doToken);
        if (doIdx === -1) continue;

        // 向前搜尋最近的 'q' 指令（儲存 graphics state）
        const before = text.slice(0, doIdx);
        let qIdx = before.lastIndexOf("\nq\n");
        if (qIdx === -1) qIdx = before.lastIndexOf(" q\n");
        if (qIdx === -1) qIdx = before.lastIndexOf("\nq ");
        if (qIdx === -1) qIdx = before.lastIndexOf("\nq");

        const block = qIdx !== -1 ? before.slice(qIdx).trim() : "";

        // 確認 block 中有 cm 矩陣
        const hasCM = /[-\d.eE]+\s+[-\d.eE]+\s+[-\d.eE]+\s+[-\d.eE]+\s+[-\d.eE]+\s+[-\d.eE]+\s+cm/.test(block);
        if (hasCM) {
            // 移除開頭的 'q'（後面我們自己加），回傳純淨的繪圖指令（cm + 顏色等）
            return block.replace(/^q\s*/, "");
        }
    }
    return null;
}

/**
 * 生成 Form XObject 的即時預覽 URL
 * @param {string} keyName - 資源鍵名
 * @param {number} pageIndex - 頁面索引 (0-indexed)
 * @returns {Promise<string>} Blob URL
 */
async function generateFormXObjectPreviewUrl(keyName, pageIndex) {
    const srcDoc = await PDFDocument.load(cachedDecryptedBytes);
    const previewDoc = await PDFDocument.create();

    const srcPage = srcDoc.getPage(pageIndex);
    const originalResources = srcPage.node.lookup(PDFName.of("Resources"));

    // 安全清除可能重複的前綴斜線，防止產出 //Fm0 破壞 PDF 資源定址
    const cleanKeyName = keyName.replace(/^\//, "");

    // 1. 深入尋找該 Form XObject 的物件參照
    let fmObj = null;

    if (originalResources instanceof PDFDict) {
        const xObjects = srcDoc.context.lookup(originalResources.get(PDFName.of("XObject")));
        if (xObjects instanceof PDFDict && xObjects.has(PDFName.of(cleanKeyName))) {
            fmObj = srcDoc.context.lookup(xObjects.get(PDFName.of(cleanKeyName)));
        }
    }

    if (!fmObj) {
        throw new Error("找不到該 Form 物件，無法產生預覽。");
    }

    // 2. 直接「拷貝原頁面」，從而完美繼承原頁面中所有的字型資源、編碼、CMap 與環境上下文！
    const [copiedPage] = await previewDoc.copyPages(srcDoc, [pageIndex]);
    const page = previewDoc.addPage(copiedPage);
    // 保留原頁面尺寸，讓浮水印顯示在原始位置（含旋轉角度）

    // 3. 解決 OCG 圖層遮罩導致預覽空白的致命 Bug：
    // 在拷貝出來的頁面中，直接找到 /XObject 中的該 Form 物件，將其 /OC 屬性刪除，強制讓它 100% 渲染！
    const pageResources = page.node.lookup(PDFName.of("Resources"));
    if (pageResources instanceof PDFDict) {
        const xObjects = previewDoc.context.lookup(pageResources.get(PDFName.of("XObject")));
        if (xObjects instanceof PDFDict && xObjects.has(PDFName.of(cleanKeyName))) {
            const clonedFm = previewDoc.context.lookup(xObjects.get(PDFName.of(cleanKeyName)));
            if (clonedFm instanceof PDFRawStream) {
                clonedFm.dict.delete(PDFName.of("OC"));
            }
        }
    }

    // 4. 嘗試從原頁面 Contents Stream 中提取原始的 cm 變換矩陣（含旋轉角度）
    // 若找得到，就用原始矩陣還原浮水印的真實角度；找不到則退回 BBox 平移模式
    let drawBlock = await extractXObjectDrawBlock(srcDoc, pageIndex, cleanKeyName);

    let drawCommand;
    if (drawBlock) {
        // 用原始的完整繪圖區塊（cm 矩陣 + 顏色 + Do），完美還原旋轉！
        drawCommand = `q\n${drawBlock}\n/${cleanKeyName} Do\nQ`;
    } else {
        // Fallback：不再強制平移至 (0,0)，讓 XObject 保持在自己 BBox 的原始座標上
        // 這樣在預覽時才不會覺得物件明顯跑到左下角（偏移）
        drawCommand = `q /${cleanKeyName} Do Q`;
    }

    const contentStream = previewDoc.context.stream(drawCommand);
    const contentStreamRef = previewDoc.context.register(contentStream);
    page.node.set(PDFName.of("Contents"), contentStreamRef);

    const pdfBytes = await previewDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    previewUrlCache.push(url);
    return url;
}

/**
 * 生成 Image XObject 的即時預覽 URL
 * @param {string} keyName - 資源鍵名
 * @param {PDFRawStream} rawStream - 原始影像串流
 * @param {number} pageIndex - 頁面索引 (0-indexed)
 * @returns {Promise<string>} Blob URL
 */
async function generateImageXObjectPreviewUrl(keyName, rawStream, pageIndex) {
    const srcDoc = await PDFDocument.load(cachedDecryptedBytes);
    const previewDoc = await PDFDocument.create();
    const [copiedPage] = await previewDoc.copyPages(srcDoc, [pageIndex]);
    const page = previewDoc.addPage(copiedPage);

    let imgWidth = 500;
    let imgHeight = 500;
    if (rawStream instanceof PDFRawStream) {
        const w = rawStream.dict.get(PDFName.of("Width"));
        const h = rawStream.dict.get(PDFName.of("Height"));
        if (w && typeof w.value === "function") imgWidth = w.value();
        if (h && typeof h.value === "function") imgHeight = h.value();
    }

    // 將圖片置中於原頁面大小
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const scale = Math.min((pageWidth * 0.8) / imgWidth, (pageHeight * 0.8) / imgHeight, 1);
    const finalW = imgWidth * scale;
    const finalH = imgHeight * scale;
    const xOffset = (pageWidth - finalW) / 2;
    const yOffset = (pageHeight - finalH) / 2;

    // 由於複製頁面已經連帶複製了 Resources 字典，該圖片物件依然以原 keyName 存在於該頁面的 XObject 中
    const cleanKeyName = keyName.replace(/^\//, "");
    const drawCommand = `q ${finalW} 0 0 ${finalH} ${xOffset} ${yOffset} cm /${cleanKeyName} Do Q`;
    const contentStream = previewDoc.context.stream(drawCommand);
    const contentStreamRef = previewDoc.context.register(contentStream);
    page.node.set(PDFName.of("Contents"), contentStreamRef);

    const pdfBytes = await previewDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    previewUrlCache.push(url);
    return url;
}

/**
 * 生成 OCG (圖層) 隱藏效果的即時預覽 URL
 * @param {string} ocgRefStr - OCG 物件參照字串
 * @returns {Promise<string>} Blob URL
 */
async function generateOCGPreviewUrl(ocgRefStr) {
    const srcDoc = await PDFDocument.load(cachedDecryptedBytes);
    // srcDoc.catalog 直接回傳 PDFDict，不需再 context.lookup()
    const catalog = srcDoc.catalog;
    const ocProperties = srcDoc.context.lookup(catalog.get(PDFName.of("OCProperties")));

    if (ocProperties instanceof PDFDict) {
        const dDict = srcDoc.context.lookup(ocProperties.get(PDFName.of("D")));
        if (dDict instanceof PDFDict) {
            // 尋找目標 OCG 的 Reference
            const ocgsArray = srcDoc.context.lookup(ocProperties.get(PDFName.of("OCGs")));
            let targetRef = null;
            if (ocgsArray instanceof PDFArray) {
                for (let i = 0; i < ocgsArray.size(); i++) {
                    const ref = ocgsArray.get(i);
                    if (ref.toString() === ocgRefStr) {
                        targetRef = ref;
                        break;
                    }
                }
            }

            if (targetRef) {
                // 加入 OFF 陣列
                const offArray = srcDoc.context.lookup(dDict.get(PDFName.of("OFF")));
                const newOffArray = srcDoc.context.obj([]);
                if (offArray instanceof PDFArray) {
                    for (let i = 0; i < offArray.size(); i++) {
                        newOffArray.push(offArray.get(i));
                    }
                }
                newOffArray.push(targetRef);
                dDict.set(PDFName.of("OFF"), newOffArray);

                // 從 ON 陣列中移除
                const onArray = srcDoc.context.lookup(dDict.get(PDFName.of("ON")));
                if (onArray instanceof PDFArray) {
                    const newOnArray = srcDoc.context.obj([]);
                    for (let i = 0; i < onArray.size(); i++) {
                        const ref = onArray.get(i);
                        if (ref.toString() !== ocgRefStr) {
                            newOnArray.push(ref);
                        }
                    }
                    dDict.set(PDFName.of("ON"), newOnArray);
                }
            }
        }
    }

    const pdfBytes = await srcDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    previewUrlCache.push(url);
    return url;
}

/**
 * 生成 Annotation (註解) 的即時預覽 URL (高亮顯示所在位置)
 * @param {string} annotRefStr - 註解物件參照字串
 * @param {number} pageIndex - 頁面索引 (0-indexed)
 * @param {number} annotIndex - 註解在陣列中的索引
 * @returns {Promise<string>} Blob URL
 */
async function generateAnnotationPreviewUrl(annotRefStr, pageIndex, annotIndex) {
    try {
        const srcDoc = await PDFDocument.load(cachedDecryptedBytes);
        const previewDoc = await PDFDocument.create();
        const [copiedPage] = await previewDoc.copyPages(srcDoc, [pageIndex]);
        const page = previewDoc.addPage(copiedPage);

        const pageNode = page.node;

        // 使用者要求：不展示原本頁面（清空背景），僅以紅框表示相對位置
        pageNode.delete(PDFName.of("Contents"));

        const annots = pageNode.lookup(PDFName.of("Annots"));
        let targetRect = null;
        if (annots instanceof PDFArray) {
            const newAnnots = previewDoc.context.obj([]);
            for (let idx = 0; idx < annots.size(); idx++) {
                const ref = annots.get(idx);
                if (idx === annotIndex) {
                    newAnnots.push(ref);
                    // 取得這個註解的 Rect 以便後續高亮標示
                    const annotDict = previewDoc.context.lookup(ref);
                    if (annotDict instanceof PDFDict) {
                        const rect = annotDict.lookup(PDFName.of("Rect"));
                        if (rect instanceof PDFArray && rect.size() === 4) {
                            targetRect = [
                                rect.get(0).value(),
                                rect.get(1).value(),
                                rect.get(2).value(),
                                rect.get(3).value()
                            ];
                        }
                    }
                }
            }
            if (newAnnots.size() > 0) {
                pageNode.set(PDFName.of("Annots"), newAnnots);
            } else {
                pageNode.delete(PDFName.of("Annots"));
            }
        }

        // 由於很多註解（如 Link）沒有視覺外觀，我們在它所在的 Rect 位置畫一個半透明的紅色框來突顯它！
        if (targetRect) {
            const x0 = Math.min(targetRect[0], targetRect[2]);
            const y0 = Math.min(targetRect[1], targetRect[3]);
            const w = Math.abs(targetRect[2] - targetRect[0]);
            const h = Math.abs(targetRect[3] - targetRect[1]);

            page.drawRectangle({
                x: x0,
                y: y0,
                width: w,
                height: h,
                borderWidth: 3,
                borderColor: PDFLib.rgb(1, 0.2, 0.2),
                color: PDFLib.rgb(1, 0.2, 0.2),
                opacity: 0.25,
                borderOpacity: 0.8
            });
        }


        const pdfBytes = await previewDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        previewUrlCache.push(url);
        return url;
    } catch (error) {
        console.error("生成註解預覽時發生錯誤:", error);
        throw error;
    }
}


/**
 * 生成 Direct Content (頁面直接內容) 的即時預覽 URL
 * @param {string} streamRefStr - 串流參照字串
 * @param {number} pageIndex - 頁面索引 (0-indexed)
 * @param {number} streamIndex - 串流在 Contents 陣列中的索引
 * @returns {Promise<string>} Blob URL
 */
async function generateDirectContentPreviewUrl(streamRefStr, pageIndex, streamIndex) {
    const srcDoc = await PDFDocument.load(cachedDecryptedBytes);
    const previewDoc = await PDFDocument.create();
    const [copiedPage] = await previewDoc.copyPages(srcDoc, [pageIndex]);
    const page = previewDoc.addPage(copiedPage);

    // 【隔離策略】清空原本 Resources 裡面的 XObject，確保不會畫出圖片或 Form，只留純粹的 Direct Content
    const resources = page.node.lookup(page.node.get(PDFName.of("Resources")));
    if (resources instanceof PDFDict) {
        resources.delete(PDFName.of("XObject"));
    }

    const contentsKey = PDFName.of("Contents");
    const contents = previewDoc.context.lookup(page.node.get(contentsKey));
    if (contents instanceof PDFArray) {
        const newContents = previewDoc.context.obj([]);
        for (let idx = 0; idx < contents.size(); idx++) {
            const ref = contents.get(idx);
            if (idx === streamIndex) {
                newContents.push(ref);
            }
        }
        page.node.set(contentsKey, newContents);
    }

    const pdfBytes = await previewDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    previewUrlCache.push(url);
    return url;
}

/**
 * 掃描完成後更新 UI：根據偵測結果顯示/隱藏策略列、自動勾選疑似浮水印策略，並給出掃描摘要提示。
 * @param {HTMLElement} optionsContainer - 策略選項容器 DOM 元素
 */
function updateScanResultUI(optionsContainer) {
    // 策略列 ID → 對應偵測 Map 的對應關係
    const strategyRows = [
        { rowId: 'optionRowFormXObject', map: detectedFormXObjects, destroyList: formXObjectsToDestroy, checkboxId: 'removeFormXObject' },
        { rowId: 'optionRowAnnotations', map: detectedAnnotations, destroyList: annotsToDestroy, checkboxId: 'removeAnnotations' },
        { rowId: 'optionRowDirectContent', map: detectedDirectContents, destroyList: directContentsToDestroy, checkboxId: 'removeDirectContent' },
        { rowId: 'optionRowImageXObject', map: detectedImages, destroyList: imagesToDestroy, checkboxId: 'removeImageXObject' },
        { rowId: 'optionRowExtGState', map: detectedExtGStates, destroyList: extGStatesToDestroy, checkboxId: 'removeExtGState' },
        { rowId: 'optionRowOCG', map: detectedOCGs, destroyList: ocgsToDestroy, checkboxId: 'removeOCG' },
    ];

    let anySuspected = false;

    strategyRows.forEach(({ rowId, map, destroyList, checkboxId }) => {
        // 根據偵測結果動態顯示或隱藏策略選項列
        document.getElementById(rowId).classList.toggle('hidden', map.size === 0);
        // 自動勾選：若有偵測到疑似浮水印的物件
        const checked = destroyList.length > 0;
        document.getElementById(checkboxId).checked = checked;
        if (checked) anySuspected = true;
    });

    // 顯示策略選項區塊
    optionsContainer.classList.remove('hidden');

    // 給出掃描結果摘要訊息
    if (!anySuspected) {
        addStatusMessage("掃描完成：未自動偵測到明顯的浮水印物件，您可以手動勾選合適的策略來嘗試清除。", "info");
    } else {
        addStatusMessage("掃描完成：已自動勾選偵測到疑似浮水印的清除策略，您也可以手動調整。", "success");
    }
}

/**
 * 載入新 PDF 後立即偵測加密狀態，若需要開啟密碼則向使用者詢問，
 * 並將解密後的位元組與密碼快取，最後顯示預覽。
 * @param {File} file - 使用者上傳的原始 PDF 檔案
 */
async function showOriginalPreview(file) {
    // 0. 主動清空並重置所有舊狀態（含密碼快取）
    resetAllState();

    // 1. 讀取原始位元組，嘗試偵測是否有開啟密碼
    const rawBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);

    let previewBytes = rawBytes; // 預設使用原始位元組作為預覽來源
    let needsPassword = false;
    let decryptedSuccessfully = false; // 用於在 showOriginalPreview 函式末端判斷是否成功解密，以決定是否顯示按鈕

    try {
        const testDoc = await PDFDocument.load(rawBytes, { updateMetadata: false });
        testDoc.getPageCount(); // 觸發 lazy-parsing
        // 正常無加密 PDF，直接快取解密後的原始位元組
        cachedDecryptedBytes = rawBytes;
    } catch (e) {
        // 進一步確認：嘗試以空密碼解密（空密碼可解開「僅有編輯權限限制」的 PDF）
        try {
            const decrypted = await decryptWithQpdfWasm(rawBytes, "");
            // 空密碼成功→僅有權限限制，直接快取解密後的位元組
            cachedDecryptedBytes = decrypted;
            previewBytes = decrypted;
            addStatusMessage("⚠️ 偵測到編輯權限限制，已自動解除。", "info");
        } catch {
            // 空密碼失敗→需要開啟密碼
            needsPassword = true;
        }
    }

    if (needsPassword) {

        // 優先在記憶體中嘗試上一次成功解密的密碼 (lastSuccessPassword)
        if (lastSuccessPassword) {
            try {
                addStatusMessage("🔒 偵測到開啟密碼保護，嘗試套用前次成功解密的記憶體密碼...", "info");
                const decrypted = await decryptWithQpdfWasm(rawBytes, lastSuccessPassword);
                // 驗證解密成功
                const testDoc = await PDFDocument.load(decrypted, { updateMetadata: false });
                testDoc.getPageCount();

                // 成功！
                cachedPassword = lastSuccessPassword;
                cachedDecryptedBytes = decrypted;
                previewBytes = decrypted;
                decryptedSuccessfully = true;
                addStatusMessage("🔓 已自動套用前次使用的密碼並解密成功！", "success");
            } catch (e) {
                // 嘗試失敗，提示使用者需要重新輸入
                addStatusMessage("⚠️ 前次密碼不適用於此檔案，請重新輸入密碼。", "info");
            }
        }

        // 若未成功（無前次密碼，或前次密碼錯誤），則詢問使用者
        if (!decryptedSuccessfully) {
            addStatusMessage("🔒 此 PDF 設有開啟密碼，請輸入密碼以繼續。", "info");
            let attempts = 0;
            while (true) {
                const pwd = await promptForPassword(attempts > 0);
                if (pwd === null) {
                    // 使用者取消：仍以原始未解密的 PDF 顯示預覽（瀏覽器內建會彈窗詢問密碼）
                    addStatusMessage("已取消密碼輸入。如需繼續處理，請重新選擇 PDF 並輸入密碼。", "info");
                    break;
                }
                attempts++;
                try {
                    const decrypted = await decryptWithQpdfWasm(rawBytes, pwd);
                    // 驗證解密成功
                    const testDoc = await PDFDocument.load(decrypted, { updateMetadata: false });
                    testDoc.getPageCount();

                    // 成功：快取密碼與解密後的位元組，並儲存為 lastSuccessPassword 以供下次使用
                    cachedPassword = pwd;
                    lastSuccessPassword = pwd; // 更新跨檔案記憶體暫存密碼
                    cachedDecryptedBytes = decrypted;
                    previewBytes = decrypted;
                    decryptedSuccessfully = true;
                    addStatusMessage("🔓 密碼驗證成功，已解除開啟密碼保護。", "success");
                    break;
                } catch {
                    // 密碼錯誤，繼續迴圈
                }
            }
        }
    }

    // 進行背景高速掃描以找出 PDF 中可能包含浮水印的物件 (Annots, XObject, ExtGState, OCG, Contents)

    if (!needsPassword || decryptedSuccessfully) {
        try {
            const scanDoc = await PDFDocument.load(previewBytes, { updateMetadata: false });
            // 重置全部 6 個偵測 Map，確保與 resetAllState 行為一致
            detectedFormXObjects.clear();
            detectedDirectContents.clear();
            detectedAnnotations.clear();
            detectedExtGStates.clear();
            detectedOCGs.clear();
            detectedImages.clear();

            // Check OCG
            const catalogDict = scanDoc.catalog;
            if (catalogDict.has(PDFName.of("OCProperties"))) {
                const ocPropertiesRef = catalogDict.get(PDFName.of("OCProperties"));
                const ocProperties = scanDoc.context.lookup(ocPropertiesRef);
                if (ocProperties instanceof PDFDict) {
                    const ocgsRef = ocProperties.get(PDFName.of("OCGs"));
                    if (ocgsRef) {
                        const ocgs = scanDoc.context.lookup(ocgsRef);
                        if (ocgs instanceof PDFArray) {
                            for (let idx = 0; idx < ocgs.size(); idx += 1) {
                                const ocgRef = ocgs.get(idx);
                                const ocgRefStr = ocgRef.toString();
                                const ocg = scanDoc.context.lookup(ocgRef);
                                if (ocg instanceof PDFDict) {
                                    const nameObject = ocg.lookup(PDFName.of("Name"));
                                    if (nameObject instanceof PDFString || nameObject instanceof PDFHexString) {
                                        const name = nameObject.decodeText();
                                        const entry = {
                                            name: name,
                                            ref: ocgRef
                                        };
                                        detectedOCGs.set(ocgRefStr, entry);

                                        // 預設勾選：使用統一的 OCG 判定函數
                                        if (isSuspectOCG(entry)) {
                                            if (!ocgsToDestroy.includes(ocgRefStr)) {
                                                ocgsToDestroy.push(ocgRefStr);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            const pageCount = scanDoc.getPageCount();
            for (let i = 0; i < pageCount; i++) {
                const page = scanDoc.getPage(i);

                // Check Annots
                const annots = page.node.lookup(PDFName.of("Annots"));
                if (annots instanceof PDFArray) {
                    for (let idx = 0; idx < annots.size(); idx++) {
                        const annotRef = annots.get(idx);
                        const annot = scanDoc.context.lookup(annotRef);
                        if (annot instanceof PDFDict) {
                            const subtype = scanDoc.context.lookup(annot.get(PDFName.of("Subtype")));
                            if (subtype instanceof PDFName) {
                                const subtypeStr = subtype.toString().replace(/^\//, "");
                                const annotRefStr = annotRef.toString();

                                const entry = {
                                    subtype: subtypeStr,
                                    page: i + 1,
                                    ref: annotRef,
                                    annotIndex: idx
                                };
                                detectedAnnotations.set(annotRefStr, entry);

                                // 預設勾選：使用統一的 Annotation 判定函數
                                if (isSuspectAnnotation(entry)) {
                                    if (!annotsToDestroy.includes(annotRefStr)) {
                                        annotsToDestroy.push(annotRefStr);
                                    }
                                }
                            }
                        }
                    }
                }

                // Check Resources
                const resourcesNode = page.node.lookup(PDFName.of("Resources"));
                if (resourcesNode) {
                    const resources = scanDoc.context.lookup(resourcesNode);
                    if (resources instanceof PDFDict) {
                        const xObjectsNode = resources.get(PDFName.of("XObject"));
                        if (xObjectsNode) {
                            const xObjects = scanDoc.context.lookup(xObjectsNode);
                            if (xObjects instanceof PDFDict) {
                                for (const key of xObjects.keys()) {
                                    const xObj = scanDoc.context.lookup(xObjects.get(key));
                                    const subtype = xObj instanceof PDFRawStream ? scanDoc.context.lookup(xObj.dict.get(PDFName.of("Subtype"))) : null;
                                    if (subtype instanceof PDFName) {
                                        if (subtype.toString() === "/Form") {
                                            if (xObj instanceof PDFRawStream) {
                                                try {
                                                    const data = getDecodedStreamContents(xObj);
                                                    const rawStr = decodeBinaryToText(data);
                                                    const xObjRef = xObjects.get(key);
                                                    const refStr = xObjRef.toString();
                                                    if (!detectedFormXObjects.has(refStr)) {
                                                        const keyName = key.value();
                                                        const entry = {
                                                            keyName: keyName,
                                                            pages: [i + 1],
                                                            rawStr: rawStr,
                                                            ref: xObjRef
                                                        };
                                                        detectedFormXObjects.set(refStr, entry);
                                                        if (isSuspectFormXObject(entry, rawStr)) {
                                                            if (!formXObjectsToDestroy.includes(refStr)) {
                                                                formXObjectsToDestroy.push(refStr);
                                                            }
                                                        }
                                                    } else {
                                                        const entry = detectedFormXObjects.get(refStr);
                                                        if (entry && !entry.pages.includes(i + 1)) {
                                                            entry.pages.push(i + 1);
                                                        }
                                                    }
                                                } catch (e) { }
                                            }
                                        }
                                        if (subtype.toString() === "/Image") {
                                            if (xObj instanceof PDFRawStream) {
                                                const keyName = key.value();
                                                const uniqueKey = `${i}:${keyName}`;

                                                // 獲取寬、高、Filter 等特徵
                                                const width = xObj.dict.get(PDFName.of("Width"));
                                                const height = xObj.dict.get(PDFName.of("Height"));
                                                const filter = xObj.dict.get(PDFName.of("Filter"));

                                                const filterStr = filter ? filter.toString() : "RAW";

                                                detectedImages.set(uniqueKey, {
                                                    keyName: keyName,
                                                    width: width,
                                                    height: height,
                                                    filterStr: filterStr,
                                                    page: i + 1,
                                                    ref: xObjects.get(key),
                                                    rawStream: xObj
                                                });

                                                // 預設勾選：若名稱疑似浮水印，則預先打勾
                                                if (isSuspectKeyName(keyName)) {
                                                    if (!imagesToDestroy.includes(uniqueKey)) {
                                                        imagesToDestroy.push(uniqueKey);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        const extGStateNode = resources.get(PDFName.of("ExtGState"));
                        if (extGStateNode) {
                            const extGState = scanDoc.context.lookup(extGStateNode);
                            if (extGState instanceof PDFDict) {
                                for (const key of extGState.keys()) {
                                    const keyName = key.value();
                                    const gsObj = scanDoc.context.lookup(extGState.get(key));

                                    // 萃取特徵，例如透明度 ca/CA 與混合模式 BM
                                    let details = [];
                                    let caVal = 1.0;
                                    let CAVal = 1.0;
                                    if (gsObj instanceof PDFDict) {
                                        const ca = gsObj.get(PDFName.of("ca"));
                                        const CA = gsObj.get(PDFName.of("CA"));
                                        const BM = gsObj.get(PDFName.of("BM"));
                                        if (ca !== undefined) {
                                            details.push(`ca: ${ca.toString()}`);
                                            if (typeof ca.value === "function") caVal = ca.value();
                                        }
                                        if (CA !== undefined) {
                                            details.push(`CA: ${CA.toString()}`);
                                            if (typeof CA.value === "function") CAVal = CA.value();
                                        }
                                        if (BM !== undefined) details.push(`BM: ${BM.toString()}`);
                                    }
                                    const detailText = details.length > 0 ? details.join(", ") : "無透明度細節設定";
                                    const uniqueKey = `${i}:${keyName}`;

                                    detectedExtGStates.set(uniqueKey, {
                                        keyName: keyName,
                                        detailText: detailText,
                                        page: i + 1,
                                        ref: gsObj,
                                        caVal: caVal,
                                        CAVal: CAVal
                                    });

                                    // 預設勾選：使用統一的 ExtGState 判定函數
                                    if (isSuspectExtGState(detectedExtGStates.get(uniqueKey))) {
                                        if (!extGStatesToDestroy.includes(uniqueKey)) {
                                            extGStatesToDestroy.push(uniqueKey);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Check Direct Content
                const contents = scanDoc.context.lookup(page.node.lookup(PDFName.of("Contents")));
                if (contents) {
                    const streams = [];
                    if (contents instanceof PDFArray) {
                        for (let idx = 0; idx < contents.size(); idx++) {
                            streams.push({ item: scanDoc.context.lookup(contents.get(idx)), index: idx });
                        }
                    } else {
                        streams.push({ item: contents, index: null });
                    }

                    streams.forEach(entry => {
                        const stream = entry.item;
                        if (stream instanceof PDFRawStream) {
                            let streamRef = null;
                            if (contents instanceof PDFArray) {
                                streamRef = contents.get(entry.index);
                            } else {
                                streamRef = page.node.get(PDFName.of("Contents"));
                            }

                            if (streamRef) {
                                const refStr = streamRef.toString();
                                try {
                                    const data = getDecodedStreamContents(stream);
                                    const rawStr = decodeBinaryToText(data);

                                    detectedDirectContents.set(refStr, {
                                        page: i + 1,
                                        ref: streamRef,
                                        rawText: rawStr,
                                        streamIndex: entry.index
                                    });

                                    // 預設勾選：如果 rawText 中符合 suspect keywords，則預先標記
                                    if (isSuspectContentText(rawStr)) {
                                        if (!directContentsToDestroy.includes(refStr)) {
                                            directContentsToDestroy.push(refStr);
                                        }
                                    }
                                } catch (e) {
                                    console.error("Direct content parse error", e);
                                }
                            }
                        }
                    });
                }
            }
            console.log("[Scanner] 背景掃描完成 — 註解:", detectedAnnotations.size, "，直接內容:", detectedDirectContents.size, "，FormXObj:", detectedFormXObjects.size, "，Image:", detectedImages.size, "，ExtGState:", detectedExtGStates.size, "，OCG:", detectedOCGs.size);
        } catch (scanErr) {
            console.error("背景掃描類型失敗", scanErr);
        }
    }

    // 更新 UI 選項顯示狀態
    if (!needsPassword || decryptedSuccessfully) {
        updateScanResultUI(optionsContainer);
    } else {
        if (optionsContainer) optionsContainer.classList.add('hidden');
    }

    // 3. 建立 Blob URL 並顯示預覽
    const blob = new Blob([previewBytes], { type: "application/pdf" });
    originalUrl = URL.createObjectURL(blob);
    originalPreview.src = originalUrl;

    // 4. 顯示預覽容器，並隱藏上一次的「處理後」預覽窗格
    previewContainer.classList.remove("hidden");
    processedPreviewBox.classList.add("hidden");

    // 5. 只有在無加密，或已成功解密的情況下，才顯示「開始清除浮水印」按鈕
    if (!needsPassword || decryptedSuccessfully) {
        processButton.classList.remove("hidden");
    }
}
