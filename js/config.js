// 從全域載入的 PDFLib 程式庫解構出所需的低階/高階 PDF 資料型態
const {
    PDFDocument, // 代表整個 PDF 文件物件
    PDFName, // 代表 PDF 中的命名實體（以 / 開頭，如 /Type, /Form）
    PDFDict, // 代表 PDF 的字典結構（Dictionary）
    PDFArray, // 代表 PDF 的陣列結構（Array）
    PDFRawStream, // 代表 PDF 的二進位原始串流（Raw Stream，如內容流、圖片資料）
    PDFString, // 代表 PDF 的常規字串實體
    PDFHexString, // 代表 PDF 的十六進制編碼字串
} = PDFLib;

// ==========================================
// [Config Layer] 參數與設定 (全域浮水印判定關鍵字)
// ==========================================
/** @type {string[]} 預設的資源鍵名與圖層名稱關鍵字 */
const DEFAULT_KEY_KEYWORDS = [
    'watermark',
    'confidential',
    'draft',
    'sample',
    'internal',
    'authorized',
    'evaluation',
    'wm',
    'copy',
    'trial',
    'demo',
];
/** @type {string[]} 預設的實際內容文字關鍵字 */
const DEFAULT_CONTENT_KEYWORDS = [
    'watermark',
    'confidential',
    'draft',
    'sample',
    'internal',
    'authorized',
    'evaluation',
    '機密',
    '內部',
    '草稿',
    '樣本',
    '樣品',
    '複製品',
    '浮水印',
    '水印',
    '僅供參考',
];

// 1. 專門用於比對 PDF 資源鍵名 (KeyName) 與圖層名稱 (OCG Name) 的關鍵字
/** @type {string[]} 全域資源鍵名關鍵字清單 */
let WATERMARK_KEY_KEYWORDS = [];

// 2. 專門用於比對實際呈現在畫面上的內容文字 (如 Direct Content) 的中文與英文關鍵字
/** @type {string[]} 全域內容文字關鍵字清單 */
let WATERMARK_CONTENT_KEYWORDS = [];

/**
 * 將字串動態編譯為 Big5 格式的 Latin1 字串
 * 依賴 text-encoding polyfill (NONSTANDARD_allowLegacyEncoding)
 */
function compileToBig5Latin1(str) {
    try {
        const encoder = new TextEncoder('big5', { NONSTANDARD_allowLegacyEncoding: true });
        const bytes = encoder.encode(str);
        let result = '';
        for (let i = 0; i < bytes.length; i++) {
            result += String.fromCharCode(bytes[i]);
        }
        return result;
    } catch (e) {
        console.warn('Big5 動態編譯失敗，請確認已載入 text-encoding polyfill', e);
        return '';
    }
}

/**
 * 將正規 UTF-8 字串動態編譯為 PDF 標準中文字型 UTF-16BE 在 Latin1 解碼流下的二進位特徵碼
 * @param {string} str - 輸入中文
 * @returns {string} Latin1 格式的特徵碼
 */
function compileToUTF16BELatin1(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        const hi = code >> 8;
        const lo = code & 0xff;
        result += String.fromCharCode(hi, lo);
    }
    return result;
}

/**
 * 將內容文字流中可能含有的 PDF 十六進位字串 <...> 萃取並還原為 Latin1 字串
 * @param {string} text - 原始內容文字流
 * @returns {string} 包含已還原之十六進位內容的完整文字字串
 */
function decodeHexStringsInText(text) {
    if (!text) return '';
    let expandedText = text;
    const hexRegex = /<([0-9a-fA-F\s]+)>/g;
    let match;
    while ((match = hexRegex.exec(text)) !== null) {
        const hexClean = match[1].replace(/\s/g, '');
        if (hexClean.length === 0) continue;
        let paddedHex = hexClean;
        if (paddedHex.length % 2 !== 0) {
            paddedHex += '0';
        }
        try {
            let decodedStr = '';
            for (let i = 0; i < paddedHex.length; i += 2) {
                const byteVal = parseInt(paddedHex.substring(i, i + 2), 16);
                decodedStr += String.fromCharCode(byteVal);
            }
            expandedText += ' ' + decodedStr;
        } catch (e) {}
    }
    return expandedText;
}

/**
 * 安全地獲取並解壓縮 PDFRawStream 的二進位內容
 * @param {PDFRawStream} stream - PDF 原始二進位串流
 * @returns {Uint8Array} 解密解壓後的二進位資料
 */
function getDecodedStreamContents(stream) {
    if (!(stream instanceof PDFRawStream)) return new Uint8Array();
    try {
        const decoded = PDFLib.decodePDFRawStream(stream);
        decoded.reset();
        return decoded.getBytes();
    } catch (err) {
        console.error('解碼二進位串流失敗，回退至 raw 資料', err);
        return stream.contents || new Uint8Array();
    }
}

// === 動態編譯並整合產生最終的高精度比對字串庫 ===
/** @type {string[]} 編譯後的最終高精度比對字串庫 */
let FINAL_CONTENT_KEYWORDS = [];

/**
 * 根據目前的 WATERMARK_CONTENT_KEYWORDS 建立最終的多重編碼比對特徵碼陣列
 */
function buildFinalContentKeywords() {
    const rawKeywords = [];
    WATERMARK_CONTENT_KEYWORDS.forEach((kw) => {
        const trimmed = kw.trim();
        if (!trimmed) return;

        // 1. 保留原始英文或已解碼的 Unicode 中文 (用於註解中繼資料等已處理過的文字)
        rawKeywords.push(trimmed);

        // 英文或包含大小寫的字串，額外推入小寫版以進行不區分大小寫的比對
        const lower = trimmed.toLowerCase();
        if (lower !== trimmed) {
            rawKeywords.push(lower);
        }

        // 2. 非 ASCII 字元與中文字的多重編碼轉譯
        if (/[^\x00-\x7F]/.test(trimmed)) {
            // (A) 只要包含非 ASCII 字元（如特殊符號 ★、©、日韓文），皆動態生成標準 UTF-16BE Latin1 特徵碼以相容 Unicode
            rawKeywords.push(compileToUTF16BELatin1(trimmed));

            // (B) 若其中包含中文字元，才額外動態生成 Big5 特徵碼以相容老舊 PDF
            if (/[\u4e00-\u9fa5]/.test(trimmed)) {
                const big5Str = compileToBig5Latin1(trimmed);
                if (big5Str) {
                    rawKeywords.push(big5Str);
                }
            }
        }
    });
    // 使用 Set 進行全域去重，避免因大小寫相同、中文無大小寫或重複輸入導致的比對效能損耗
    FINAL_CONTENT_KEYWORDS = Array.from(new Set(rawKeywords));
}

// ==========================================
// 關鍵字設定存取邏輯
// ==========================================
/**
 * 載入並初始化全域關鍵字設定（從 localStorage 讀取或使用預設值）
 */
function loadGlobalKeywords() {
    try {
        const savedKeys = localStorage.getItem('WATERMARK_KEY_KEYWORDS');
        const savedContents = localStorage.getItem('WATERMARK_CONTENT_KEYWORDS');
        WATERMARK_KEY_KEYWORDS = savedKeys ? JSON.parse(savedKeys) : [...DEFAULT_KEY_KEYWORDS];
        WATERMARK_CONTENT_KEYWORDS = savedContents ? JSON.parse(savedContents) : [...DEFAULT_CONTENT_KEYWORDS];

        // 確保新加入的預設關鍵字也能生效於舊使用者
        DEFAULT_KEY_KEYWORDS.forEach((kw) => {
            if (!WATERMARK_KEY_KEYWORDS.includes(kw)) {
                WATERMARK_KEY_KEYWORDS.push(kw);
            }
        });
        DEFAULT_CONTENT_KEYWORDS.forEach((kw) => {
            if (!WATERMARK_CONTENT_KEYWORDS.includes(kw)) {
                WATERMARK_CONTENT_KEYWORDS.push(kw);
            }
        });
    } catch (e) {
        WATERMARK_KEY_KEYWORDS = [...DEFAULT_KEY_KEYWORDS];
        WATERMARK_CONTENT_KEYWORDS = [...DEFAULT_CONTENT_KEYWORDS];
    }
    buildFinalContentKeywords();
}

/**
 * 儲存全域關鍵字設定至 localStorage
 * @param {string[]} keysArray - 資源鍵名關鍵字陣列
 * @param {string[]} contentsArray - 內容文字關鍵字陣列
 */
function saveGlobalKeywords(keysArray, contentsArray) {
    WATERMARK_KEY_KEYWORDS = keysArray;
    WATERMARK_CONTENT_KEYWORDS = contentsArray;
    localStorage.setItem('WATERMARK_KEY_KEYWORDS', JSON.stringify(keysArray));
    localStorage.setItem('WATERMARK_CONTENT_KEYWORDS', JSON.stringify(contentsArray));
    buildFinalContentKeywords();
}

// 初始載入
loadGlobalKeywords();

// 綁定設定介面事件
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('globalKeywordsModal');
    const keyInput = document.getElementById('keyKeywordsInput');
    const contentInput = document.getElementById('contentKeywordsInput');

    // 自動適應文字方塊高度
    function adjustTextareaHeight(el) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    keyInput.addEventListener('input', () => adjustTextareaHeight(keyInput));
    contentInput.addEventListener('input', () => adjustTextareaHeight(contentInput));

    document.getElementById('openGlobalKeywordsModalBtn').addEventListener('click', () => {
        keyInput.value = WATERMARK_KEY_KEYWORDS.join(', ');
        contentInput.value = WATERMARK_CONTENT_KEYWORDS.join(', ');
        modal.classList.add('active');

        // 開啟時立即觸發高度適應，避免內容過長出現捲軸 (微幅延遲確保渲染計算精確)
        setTimeout(() => {
            adjustTextareaHeight(keyInput);
            adjustTextareaHeight(contentInput);
        }, 50);
    });

    document.getElementById('closeGlobalKeywordsModalBtn').addEventListener('click', () => {
        modal.classList.remove('active');
    });

    document.getElementById('resetGlobalKeywordsBtn').addEventListener('click', () => {
        if (confirm('確定要回復為預設關鍵字嗎？這將會覆寫您的自訂設定。')) {
            saveGlobalKeywords([...DEFAULT_KEY_KEYWORDS], [...DEFAULT_CONTENT_KEYWORDS]);
            modal.classList.remove('active');
            addStatusMessage('已回復預設關鍵字。', 'success');
        }
    });

    document.getElementById('saveGlobalKeywordsBtn').addEventListener('click', () => {
        const keysRaw = keyInput.value
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s);
        const contentsRaw = contentInput.value
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s);
        saveGlobalKeywords(keysRaw, contentsRaw);
        modal.classList.remove('active');
        addStatusMessage('已儲存自訂關鍵字設定。', 'success');

        if (typeof selectedFile !== 'undefined' && selectedFile) {
            addStatusMessage('🔄 關鍵字已變更，正在以新關鍵字重新掃描 PDF...', 'info');
            showOriginalPreview(selectedFile);
        }
    });
});
