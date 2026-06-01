// ==========================================
// [State Management] 全域狀態與記憶體暫存
// ==========================================

// 1. 全域狀態變數與暫存快取
/** @type {File | null} 目前使用者選取上傳的 PDF 檔案實體 (File) */
let selectedFile = null;
/** @type {string | null} 原始 PDF 於瀏覽器端動態建立的 Blob URL */
let originalUrl = null;
/** @type {string | null} 處理後 PDF 於瀏覽器端動態建立的 Blob URL */
let processedUrl = null;
/** @type {string | null} 本次選檔後使用者輸入的開啟密碼快取（換檔時清除） */
let cachedPassword = null;
/** @type {Uint8Array | null} 使用密碼解密後的 PDF 位元組快取（換檔時清除） */
let cachedDecryptedBytes = null;
/** @type {string[]} 預覽 Blob URL 快取（換檔時清除） */
let previewUrlCache = [];
/** @type {string | null} 跨檔案成功解密的開啟密碼暫存（執行期記憶體快取，不落地儲存） */
let lastSuccessPassword = null;

// 2. 表單外部物件 (Form XObject) 狀態管理
/** @type {Map<string, string>} 偵測到的表單外部物件 (key = raw stream text, value = extracted display string) */
let detectedFormXObjects = new Map();
/** @type {string[]} 儲存使用者勾選要刪除的 raw stream text */
let formXObjectsToDestroy = [];

/** @type {Map<string, boolean>} 標記哪些 Form XObject 是「頁面內容流唯一的 Do 呼叫」（危險的樣式） */
let dangerousFormXObjects = new Map();

// 3. 註解 (Annotation) 狀態管理
/** @type {Map<string, any>} 當前 PDF 檔案中偵測到的所有註解實例（key = annotRefStr） */
let detectedAnnotations = new Map();
/** @type {string[]} 要刪除的特定註解參照 (annotRefStr) 清單 */
let annotsToDestroy = [];

// 4. 頁面直接內容 (Direct Content) 狀態管理
/** @type {Map<string, {page: number, ref: any, rawText: string, streamIndex: number}>} 頁面直接內容狀態（key = streamRefStr） */
let detectedDirectContents = new Map();
/** @type {string[]} 儲存選定要清空的頁面直接內容參照字串 */
let directContentsToDestroy = [];

// 5. 影像外部物件 (Image XObject) 狀態管理
/** @type {Map<string, {keyName: string, pages: number[], ref: any, rawStream: string, width: number, height: number, filterStr: string}>} 影像外部物件狀態（key = refStr） */
let detectedImages = new Map();
/** @type {string[]} 儲存選定要清除的影像外部物件鍵值 */
let imagesToDestroy = [];

// 6. 延伸圖形狀態 (ExtGState) 狀態管理
/** @type {Map<string, {keyName: string, page: number, ref: any, detailText: string, caVal: number, CAVal: number}>} 延伸圖形狀態（key = `${page}:${name}`） */
let detectedExtGStates = new Map();
/** @type {string[]} 儲存選定要清除的延伸圖形狀態鍵值 */
let extGStatesToDestroy = [];

// 7. 選擇性內容群組 (OCG) 狀態管理
/** @type {Map<string, {name: string, ref: any}>} 選擇性內容群組狀態（key = ocgRefStr） */
let detectedOCGs = new Map();
/** @type {string[]} 儲存選定要隱藏的 OCG 參照字串 */
let ocgsToDestroy = [];

/**
 * 追加一條狀態日誌到控制台面板中，並自動滾動到最下方
 * @param {string} text - 日誌文字內容
 * @param {string} type - 日誌類型 ('info', 'success', 'error')
 */
function addStatusMessage(text, type = 'info') {
    if (!statusEl) return;
    const line = document.createElement('div');
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
 * 此函式採用「延遲載入 (Lazy Load)」策略，僅在遇到有開啟密碼或編輯限制的 PDF 時，
 * 才會從高速 CDN 載入約 1.8MB 的 QPDF WebAssembly 模組，節省初始頁面載入頻寬。
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
            const { default: QPDF } =
                await import('https://cdn.jsdelivr.net/npm/qpdf-wasm-esm-embedded@1.1.1/qpdf.mjs');
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
        try {
            qpdf.FS.unlink(inputPath);
        } catch (e) {
            console.debug('FS.unlink inputPath 失敗（可忽略）', e);
        }
        try {
            qpdf.FS.unlink(outputPath);
        } catch (e) {
            console.debug('FS.unlink outputPath 失敗（可忽略）', e);
        }

        return new Uint8Array(decryptedBytes);
    } catch (err) {
        // 發生任何異常時，亦必須在 catch 中進行檔案釋放與記憶體垃圾回收
        try {
            qpdf.FS.unlink(inputPath);
        } catch (e) {
            console.debug('FS.unlink inputPath 失敗（可忽略）', e);
        }
        try {
            qpdf.FS.unlink(outputPath);
        } catch (e) {
            console.debug('FS.unlink outputPath 失敗（可忽略）', e);
        }
        throw err;
    }
}

/**
 * 顯示密碼彈窗並等待使用者輸入
 * @param {boolean} [isRetry=false] - 是否為重試輸入密碼
 * @returns {Promise<string | null>} 回傳解決為密碼字串或 null (取消)
 */
function promptForPassword(isRetry = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('passwordModal');
        const input = document.getElementById('pdfPasswordInput');
        const errorEl = document.getElementById('modalError');
        const submitBtn = document.getElementById('modalSubmitButton');
        const cancelBtn = document.getElementById('modalCancelButton');

        // 重置輸入與錯誤提示
        input.value = '';
        if (isRetry) {
            errorEl.classList.remove('hidden');
        } else {
            errorEl.classList.add('hidden');
        }

        // 顯示 Modal
        modal.classList.add('active');
        input.focus();

        function cleanup() {
            modal.classList.remove('active');
            submitBtn.removeEventListener('click', onSubmit);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKeyDown);
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
            if (e.key === 'Enter') {
                onSubmit();
            } else if (e.key === 'Escape') {
                onCancel();
            }
        }

        submitBtn.addEventListener('click', onSubmit);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKeyDown);
    });
}

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
    downloadArea.classList.add('hidden');
    downloadLink.href = '#';
    downloadLink.download = '';

    // 3. 隱藏並清空處理後的預覽視窗
    processedPreviewBox.classList.add('hidden');
    processedPreview.src = '';

    // 4. 清除密碼快取與解密後的位元組快取
    cachedPassword = null;
    cachedDecryptedBytes = null;

    // 5. 隱藏開始處理按鈕
    processButton.classList.add('hidden');

    // 6. 重置偵測到的註解類型與刪除清單
    detectedFormXObjects.clear();
    formXObjectsToDestroy = [];
    dangerousFormXObjects.clear();
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
        optionsContainer.classList.add('hidden');
    }

    // 8. 重置所有清理策略為預設不勾選
    [
        chkRemoveFormXObject,
        chkRemoveAnnotations,
        chkRemoveDirectContent,
        chkRemoveImageXObject,
        chkRemoveExtGState,
        chkRemoveOCG,
    ].forEach((el) => {
        if (el) el.checked = false;
    });
}

/**
 * 釋放並清空預覽用的 Blob URL 快取，避免記憶體洩漏
 */
function clearPreviewUrlCache() {
    previewUrlCache.forEach((url) => {
        try {
            URL.revokeObjectURL(url);
        } catch (e) {
            console.debug('revokeObjectURL 失敗（可忽略）', e);
        }
    });
    previewUrlCache = [];
}
