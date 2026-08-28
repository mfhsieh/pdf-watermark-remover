/**
 * @fileoverview 全域狀態與記憶體管理模組。
 * 集中管理應用程式執行期的快取資料 (解密陣列、密碼、預覽 URL) 與七大策略的偵測/勾選狀態清單，落實單一資料來源 (SSOT)。
 */

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
/** @type {PDFDocument | null} 解析完成的原始 PDFDocument 實例快取（提升預覽效能） */
let cachedPdfDocument = null;
/** @type {string[]} 預覽 Blob URL 快取（換檔時清除） */
let previewUrlCache = [];
/** @type {string | null} 跨檔案成功解密的開啟密碼暫存（執行期記憶體快取，不落地儲存） */
let lastSuccessPassword = null;

// 2. 表單外部物件 (Form XObject) 狀態管理
/** @type {Map<string, string>} 偵測到的表單外部物件 (key = raw stream text, value = extracted display string) */
const detectedFormXObjects = new Map();
/** @type {string[]} 儲存使用者勾選要刪除的 raw stream text */
const formXObjectsToDestroy = [];

// 3. 影像外部物件 (Image XObject) 狀態管理
/** @type {Map<string, {keyName: string, pages: number[], ref: any, rawStream: string, width: number, height: number, filterStr: string}>} 影像外部物件狀態（key = refStr） */
const detectedImages = new Map();
/** @type {string[]} 儲存選定要清除的影像外部物件鍵值 */
const imagesToDestroy = [];

// 4. 註解 (Annotation) 狀態管理
/** @type {Map<string, any>} 當前 PDF 檔案中偵測到的所有註解實例（key = annotRefStr） */
const detectedAnnotations = new Map();
/** @type {string[]} 要刪除的特定註解參照 (annotRefStr) 清單 */
const annotsToDestroy = [];

// 5. 頁面直接內容 (Direct Content) 狀態管理
/** @type {Map<string, {page: number, ref: any, rawText: string, streamIndex: number}>} 頁面直接內容狀態（key = streamRefStr） */
const detectedDirectContents = new Map();
/** @type {string[]} 儲存選定要清空的頁面直接內容參照字串 */
const directContentsToDestroy = [];

// 6. 巨型文字區塊 (TextBlocks) 狀態管理
/** @type {Map<string, {page: number}>} 巨型文字區塊狀態 (key = pageIndex) */
const detectedTextBlocks = new Map();
/** @type {string[]} 儲存選定要清除的巨型文字區塊所在頁面索引 */
const textBlocksToDestroy = [];

// 7. 選擇性內容群組 (OCG) 狀態管理
/** @type {Map<string, {name: string, ref: any}>} 選擇性內容群組狀態（key = ocgRefStr） */
const detectedOCGs = new Map();
/** @type {string[]} 儲存選定要隱藏的 OCG 參照字串 */
const ocgsToDestroy = [];

// 8. 延伸圖形狀態 (ExtGState) 狀態管理
/** @type {Map<string, {keyName: string, page: number, ref: any, detailText: string, fillOpacity: number, strokeOpacity: number}>} 延伸圖形狀態（key = `${page}:${name}`） */
const detectedExtGStates = new Map();
/** @type {string[]} 儲存選定要清除的延伸圖形狀態鍵值 */
const extGStatesToDestroy = [];

/**
 * 全域策略註冊表 (Strategy Registry)
 * 將七大清理策略的資料狀態與 UI 綁定 ID 集中管理，
 * 供狀態重置、掃描結果更新與選項取值時進行共用迴圈處理。
 * @type {Array<{map: Map, destroyList: Array, checkboxId: string, rowId: string}>}
 */
/**
 * STRATEGY_REGISTRY 將各種清理策略封裝註冊。
 * 注意：由於是以參照(Reference)方式綁定 `map` 與 `destroyList`，
 * 這些陣列和 Map 必須定義為 `const`，在清空時使用 `.clear()` 或 `.length = 0`，
 * 絕對不可重新賦值（如 `map = new Map()`），否則會導致此處的參照斷裂。
 * @readonly
 */
const STRATEGY_REGISTRY = (window.STRATEGY_REGISTRY = [
    {
        map: detectedFormXObjects,
        destroyList: formXObjectsToDestroy,
        checkboxId: 'removeFormXObject',
        rowId: 'optionRowFormXObject',
    },
    {
        map: detectedImages,
        destroyList: imagesToDestroy,
        checkboxId: 'removeImageXObject',
        rowId: 'optionRowImageXObject',
    },
    {
        map: detectedAnnotations,
        destroyList: annotsToDestroy,
        checkboxId: 'removeAnnotations',
        rowId: 'optionRowAnnotations',
    },
    {
        map: detectedDirectContents,
        destroyList: directContentsToDestroy,
        checkboxId: 'removeDirectContent',
        rowId: 'optionRowDirectContent',
    },
    {
        map: detectedTextBlocks,
        destroyList: textBlocksToDestroy,
        checkboxId: 'removeTextBlocks',
        rowId: 'optionRowTextBlocks',
    },
    {
        map: detectedOCGs,
        destroyList: ocgsToDestroy,
        checkboxId: 'removeOCG',
        rowId: 'optionRowOCG',
    },
    {
        map: detectedExtGStates,
        destroyList: extGStatesToDestroy,
        checkboxId: 'removeExtGState',
        rowId: 'optionRowExtGState',
    },
]);

/**
 * 追加一條狀態日誌到控制台面板中，並自動滾動到最下方
 * @param {string} text - 日誌文字內容
 * @param {string} type - 日誌類型 ('info', 'success', 'error')
 * @returns {void}
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
 * @returns {void}
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

    // 產生獨立的虛擬檔案路徑，防止併發執行時產生 Race Condition 檔案覆蓋
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const inputPath = `/decrypt_input_${uniqueId}.pdf`;
    const outputPath = `/decrypt_output_${uniqueId}.pdf`;

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

        return new Uint8Array(decryptedBytes);
    } finally {
        // 無論成功或發生異常，皆主動清理 WebAssembly 虛擬記憶體檔案，防止長期使用引發瀏覽器 Memory Leak
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
    }
}

/**
 * 顯示密碼彈窗並等待使用者輸入
 * @param {boolean} [isRetry=false] - 是否為重試輸入密碼
 * @returns {Promise<string | null>} 回傳解決為密碼字串或 null (取消)
 */
function promptForPassword(isRetry = false) {
    // 防呆機制：若已經有密碼彈窗正在等待，先強制移除舊的監聽器
    // 避免使用者快速拖曳多個檔案時，產生 Event Listener 疊加與 Promise 競爭狀態。
    if (window._currentPasswordPromptCleanup) {
        window._currentPasswordPromptCleanup();
    }

    return new Promise((resolve) => {
        const modal = document.getElementById('passwordModal');
        const form = document.getElementById('passwordModalForm');
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

        /**
         * 內部輔助函式：清理 Modal 的事件監聽器，防止重複觸發引發 Memory Leak
         * @returns {void}
         */
        function cleanup() {
            modal.classList.remove('active');
            if (form) form.removeEventListener('submit', onSubmit);
            else submitBtn.removeEventListener('click', onSubmit);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKeyDown);
            window._currentPasswordPromptCleanup = null;
        }
        window._currentPasswordPromptCleanup = cleanup;

        /**
         * 內部輔助函式：處理送出密碼邏輯
         * @returns {void}
         */
        function onSubmit(e) {
            if (e) e.preventDefault();
            const password = input.value;
            cleanup();
            resolve(password);
        }

        /**
         * 內部輔助函式：處理取消密碼輸入邏輯
         * @returns {void}
         */
        function onCancel() {
            cleanup();
            resolve(null);
        }

        /**
         * 內部輔助函式：處理鍵盤按鍵事件 (Enter 送出、Escape 取消)
         * @param {KeyboardEvent} e - 鍵盤事件物件
         * @returns {void}
         */
        function onKeyDown(e) {
            if (!form && e.key === 'Enter') {
                onSubmit(e);
            } else if (e.key === 'Escape') {
                onCancel();
            }
        }

        if (form) form.addEventListener('submit', onSubmit);
        else submitBtn.addEventListener('click', onSubmit);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKeyDown);
    });
}

/**
 * 重置所有狀態與暫存，確保新檔案載入時不殘留舊狀態
 * @returns {void}
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
    processedPreview.removeAttribute('src');

    // 4. 清空 PDF 快取（密碼、解密位元組、PDFDocument 實例）
    cachedPassword = null;
    cachedDecryptedBytes = null;
    cachedPdfDocument = null;

    // 5. 隱藏開始處理按鈕
    processButton.classList.add('hidden');

    // 6. 重置所有策略的偵測紀錄、刪除清單與主畫面選項勾選狀態
    STRATEGY_REGISTRY.forEach((strategy) => {
        strategy.map.clear();
        strategy.destroyList.length = 0;
        const chk = document.getElementById(strategy.checkboxId);
        if (chk) chk.checked = false;
    });

    // 7. 隱藏清理策略選項區塊
    if (optionsContainer) {
        optionsContainer.classList.add('hidden');
    }
}

/**
 * 釋放並清空預覽用的 Blob URL 快取，避免記憶體洩漏
 * @returns {void}
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
