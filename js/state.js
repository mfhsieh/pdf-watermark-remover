// [State Management] 全域狀態與記憶體暫存
// ==========================================

// Form XObject 表單外部物件處理模式設定
let detectedFormXObjects = new Map(); // key = raw stream text, value = extracted display string
let formXObjectsToDestroy = []; // 儲存使用者勾選要刪除的 raw stream text

// 要刪除的特定註解參照 (annotRefStr) 清單
let detectedAnnotations = new Map(); // 當前 PDF 檔案中偵測到的所有註解實例（key = annotRefStr）
let annotsToDestroy = [];

// 頁面直接內容 (Direct Content) 處理模式設定
let detectedDirectContents = new Map(); // key = streamRefStr, value = { page, ref, rawText, streamIndex }
let directContentsToDestroy = []; // 儲存選定要清空的頁面直接內容參照字串

// 影像外部物件 (Image XObject) 狀態管理變數
let detectedImages = new Map(); // key = `${page}:${name}`, value = { keyName, page, ref, rawStream, width, height, filterStr }
let imagesToDestroy = []; // 儲存選定要清除的影像外部物件鍵值

// 延伸圖形狀態 (ExtGState) 狀態管理變數
let detectedExtGStates = new Map(); // key = `${page}:${name}`, value = { keyName, page, ref, detailText, caVal, CAVal }
let extGStatesToDestroy = []; // 儲存選定要清除的延伸圖形狀態鍵值

// 選擇性內容群組 (OCG) 狀態管理變數
let detectedOCGs = new Map(); // key = ocgRefStr, value = { name, ref }
let ocgsToDestroy = []; // 儲存選定要隱藏的 OCG 參照字串

/**
 * 追加一條狀態日誌到控制台面板中，並自動滾動到最下方
 * @param {string} text - 日誌文字內容
 * @param {string} type - 日誌類型 ('info', 'success', 'error')
 */
function addStatusMessage(text, type = 'info') {
    if (!statusEl) return;
    const line = document.createElement("div");
    line.className = `status-line ${type}`;
    line.textContent = text;
    statusEl.appendChild(line);
    // 自動平滑滾動到最底端，確保使用者能看到最新日誌
    statusEl.scrollTop = statusEl.scrollHeight;
}

/**
 * 清空控制台面板的所有日誌
 */
function clearStatusMessages() {
    if (statusEl) {
        statusEl.replaceChildren();
    }
}


/**
 * 使用 qpdf-wasm 引擎解密加密的 PDF 文件
 * 
 * 此函數採用「延遲載入 (Lazy Load)」策略，僅在遇到有開啟密碼或編輯限制的 PDF 時，
 * 才會從高速 CDN 載入約 1.8MB 的 QPDF WebAssembly 模組，節省初始頁面加載頻寬。
 * 支援所有標準的 PDF 加密演算法（AES-256、AES-128、RC4 等），並能正確修復損壞的 XRef 與 Object Stream。
 *
 * @param {Uint8Array} pdfBytes - 原始加密 PDF 的二進位位元組陣列
 * @param {string} password - 使用者輸入的解密密碼（若僅有編輯限制則傳入空字串 ""）
 * @returns {Promise<Uint8Array>} - 解密完成後乾淨的 PDF 二進位位元組陣列
 */
async function decryptWithQpdfWasm(pdfBytes, password = '') {
    // 檢查是否為首次執行，若是則動態 import 並初始化 WebAssembly 引擎
    if (!window._qpdfWasmModule) {
        addStatusMessage('⏳ 首次使用加密 PDF 解密功能，正在載入 QPDF 引擎（約 1.8MB）...', 'info');
        try {
            const { default: QPDF } = await import('https://cdn.jsdelivr.net/npm/qpdf-wasm-esm-embedded@1.1.1/qpdf.mjs');
            window._qpdfWasmModule = await QPDF();
            addStatusMessage('✅ QPDF 引擎載入完成！正在解密 PDF...', 'success');
        } catch (loadErr) {
            throw new Error(`無法載入 QPDF 引擎: ${loadErr.message}`);
        }
    }

    const qpdf = window._qpdfWasmModule;

    // 定義虛擬檔案系統中的虛擬輸入與輸出路徑
    const inputPath = '/decrypt_input.pdf';
    const outputPath = '/decrypt_output.pdf';

    // 將 PDF 二進位位元組寫入 WebAssembly 虛擬檔案系統中
    qpdf.FS.writeFile(inputPath, pdfBytes);

    try {
        // 建構解密參數：如果提供密碼則傳入密碼參數，否則執行無密碼直接解密（解除僅有編輯限制的權限 PDF）
        const args = password
            ? ['--decrypt', `--password=${password}`, inputPath, '--', outputPath]
            : ['--decrypt', inputPath, '--', outputPath];

        // 呼叫 QPDF WASM 核心進入點
        const exitCode = qpdf.callMain(args);

        // QPDF 回傳 0 代表成功，3 代表有警告但成功解密（例如非標準字型結構，此為安全警告，亦屬成功）
        if (exitCode !== 0 && exitCode !== 3) {
            throw new Error(`QPDF 解密失敗（exit code: ${exitCode}）`);
        }

        // 從虛擬檔案系統中讀取解密成功後的文件二進位位元組
        const decryptedBytes = qpdf.FS.readFile(outputPath);

        // 主動清理 WebAssembly 虛擬記憶體檔案，防止長期使用引發瀏覽器 Memory Leak
        try { qpdf.FS.unlink(inputPath); } catch { }
        try { qpdf.FS.unlink(outputPath); } catch { }

        return new Uint8Array(decryptedBytes);

    } catch (err) {
        // 發生任何異常時，亦必須在 catch 中進行檔案釋放與記憶體垃圾回收
        try { qpdf.FS.unlink(inputPath); } catch { }
        try { qpdf.FS.unlink(outputPath); } catch { }
        throw err;
    }
}


/**
 * 顯示密碼彈窗並等待使用者輸入，回傳 Promise 解決為密碼字串或 null (取消)
 */
function promptForPassword(isRetry = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById("passwordModal");
        const input = document.getElementById("pdfPasswordInput");
        const errorEl = document.getElementById("modalError");
        const submitBtn = document.getElementById("modalSubmitButton");
        const cancelBtn = document.getElementById("modalCancelButton");

        // 重置輸入與錯誤提示
        input.value = "";
        if (isRetry) {
            errorEl.classList.remove("hidden");
        } else {
            errorEl.classList.add("hidden");
        }

        // 顯示 Modal
        modal.classList.add("active");
        input.focus();

        function cleanup() {
            modal.classList.remove("active");
            submitBtn.removeEventListener("click", onSubmit);
            cancelBtn.removeEventListener("click", onCancel);
            input.removeEventListener("keydown", onKeyDown);
        }

        function onSubmit() {
            const password = input.value;
            cleanup();
            resolve(password);
        }

        function onCancel() {
            cleanup();
            resolve(null);
        }

        function onKeyDown(e) {
            if (e.key === "Enter") {
                onSubmit();
            } else if (e.key === "Escape") {
                onCancel();
            }
        }

        submitBtn.addEventListener("click", onSubmit);
        cancelBtn.addEventListener("click", onCancel);
        input.addEventListener("keydown", onKeyDown);
    });
}

// ==========================================
// 全域狀態變數與暫存快取
// ==========================================
let selectedFile = null;    // 目前使用者選取上傳的 PDF 檔案實體 (File)
let originalUrl = null;     // 原始 PDF 於瀏覽器端動態建立的 Blob URL
let processedUrl = null;    // 處理後 PDF 於瀏覽器端動態建立的 Blob URL
let cachedPassword = null;  // 本次選檔後使用者輸入的開啟密碼快取（換檔時清除）
let cachedDecryptedBytes = null; // 使用密碼解密後的 PDF 位元組快取（換檔時清除）
let previewUrlCache = []; // 預覽 Blob URL 快取（換檔時清除）
let lastSuccessPassword = null;  // 跨檔案成功解密的開啟密碼暫存（執行期記憶體快取，不落地儲存）

/**
 * 重置所有狀態與暫存，確保新檔案載入時不殘留舊狀態
 */
function resetAllState() {
    // 1. 釋放處理後的舊 Blob URL 記憶體，防止洩漏
    if (processedUrl) {
        URL.revokeObjectURL(processedUrl);
        processedUrl = null;
    }
    if (originalUrl) {
        URL.revokeObjectURL(originalUrl);
        originalUrl = null;
    }
    clearPreviewUrlCache(); // 釋放項目預覽 Blob URL 快取

    // 2. 隱藏下載按鈕並重置連結
    downloadArea.classList.add("hidden");
    downloadLink.href = "#";
    downloadLink.download = "";

    // 3. 隱藏並清空處理後的預覽視窗
    processedPreviewBox.classList.add("hidden");
    processedPreview.src = "";

    // 4. 清除密碼快取與解密後的位元組快取
    cachedPassword = null;
    cachedDecryptedBytes = null;

    // 5. 隱藏開始處理按鈕
    processButton.classList.add("hidden");

    // 6. 重置偵測到的註解類型與刪除清單
    detectedFormXObjects.clear();
    formXObjectsToDestroy = [];
    detectedAnnotations.clear();
    annotsToDestroy = [];
    detectedDirectContents.clear();
    directContentsToDestroy = [];
    detectedImages.clear();
    imagesToDestroy = [];
    detectedExtGStates.clear();
    extGStatesToDestroy = [];
    detectedOCGs.clear();
    ocgsToDestroy = [];

    // 7. 隱藏清理策略選項區塊
    if (optionsContainer) {
        optionsContainer.classList.add("hidden");
    }

    // 8. 重置所有清理策略為預設不勾選
    [chkRemoveFormXObject, chkRemoveAnnotations, chkRemoveDirectContent,
        chkRemoveImageXObject, chkRemoveExtGState, chkRemoveOCG].forEach(el => {
            if (el) el.checked = false;
        });
}

/**
 * 釋放並清空預覽用的 Blob URL 快取，避免記憶體洩漏
 */
function clearPreviewUrlCache() {
    previewUrlCache.forEach(url => {
        try { URL.revokeObjectURL(url); } catch (e) { }
    });
    previewUrlCache = [];
}

/**
 * 開啟物件即時預覽彈窗
 */
async function openObjectPreview(strategyType, key, entry) {
    objectPreviewTitle.textContent = `🔍 即時預覽：正在載入項目...`;
    // 顯示載入動畫，隱藏 iframe（全部透過 CSS class 控制）
    objectPreviewSpinner.classList.remove("hidden");
    objectPreviewIframe.classList.add("hidden");
    objectPreviewIframe.src = "";
    objectPreviewModal.classList.add("active");

    try {
        if (!cachedDecryptedBytes) {
            throw new Error("無法讀取 PDF 原始資料。");
        }

        let previewUrl = "";

        function escapeHTML(str) {
            return str.replace(/[&<>'"]/g,
                tag => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag])
            );
        }

        if (strategyType === "formXObjectItem") {
            objectPreviewTitle.innerHTML = `🔍 表單外部物件預覽：/${escapeHTML(entry.keyName.replace(/^\//, ""))} (第 ${entry.pages[0]} 頁)`;
            previewUrl = await generateFormXObjectPreviewUrl(entry.keyName, entry.pages[0] - 1);
        } else if (strategyType === "imageXObjectItem") {
            objectPreviewTitle.innerHTML = `🔍 影像外部物件預覽：/${escapeHTML(entry.keyName.replace(/^\//, ""))} (第 ${entry.page} 頁)`;
            previewUrl = await generateImageXObjectPreviewUrl(entry.keyName, entry.rawStream, entry.page - 1);
        } else if (strategyType === "directContentItem") {
            objectPreviewTitle.innerHTML = `🔍 頁面直接內容預覽：流 (第 ${entry.page} 頁)`;
            previewUrl = await generateDirectContentPreviewUrl(key, entry.page - 1, entry.streamIndex);
        } else if (strategyType === "annotItem") {
            objectPreviewTitle.innerHTML = `🔍 註解預覽：${escapeHTML(entry.subtype)} (第 ${entry.page} 頁)`;
            previewUrl = await generateAnnotationPreviewUrl(key, entry.page - 1, entry.annotIndex);
        } else if (strategyType === "ocgItem") {
            objectPreviewTitle.innerHTML = `🔍 圖層<strong style="color: #d32f2f; background-color: #ffebee; padding: 2px 6px; border-radius: 4px; margin: 0 4px;">移除效果</strong>預覽：${escapeHTML(entry.name)} (全份文件)`;
            previewUrl = await generateOCGPreviewUrl(key);
        }

        if (previewUrl) {
            objectPreviewIframe.src = previewUrl;
            objectPreviewIframe.classList.remove("hidden");
        } else {
            throw new Error("不支援此物件類型的預覽。");
        }
    } catch (err) {
        console.error("預覽生成失敗", err);
        objectPreviewTitle.textContent = `❌ 預覽失敗：${err.message}`;
    } finally {
        objectPreviewSpinner.classList.add("hidden");
    }
}

/**
 * 關閉物件即時預覽彈窗，並即時釋放該預覽 PDF 的 Blob URL 以防止記憶體洩漏
 */
function closeObjectPreview() {
    objectPreviewModal.classList.remove("active");

    // 即時釋放預覽 PDF 的 Blob URL 記憶體
    const currentSrc = objectPreviewIframe.src;
    if (currentSrc && currentSrc.startsWith("blob:")) {
        try {
            URL.revokeObjectURL(currentSrc);
            // 從快取清單中移出，避免後續重複釋放
            const cacheIdx = previewUrlCache.indexOf(currentSrc);
            if (cacheIdx > -1) {
                previewUrlCache.splice(cacheIdx, 1);
            }
        } catch (e) {
            console.warn("釋放即時預覽 Blob URL 失敗:", e);
        }
    }
    objectPreviewIframe.src = "";
}

// 綁定關閉預覽彈窗事件
document.getElementById("closeObjectPreviewModalBtn").addEventListener("click", closeObjectPreview);
document.getElementById("closeObjectPreviewBtn").addEventListener("click", closeObjectPreview);

// ==========================================
