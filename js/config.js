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

// 3. 動態編譯並整合產生最終的高精度比對字串庫
/** @type {string[]} 編譯後的最終高精度比對字串庫 */
let FINAL_CONTENT_KEYWORDS = [];

// 4. 高透明度特徵門檻 (ExtGState Alpha Threshold)
const DEFAULT_TRANSPARENCY_THRESHOLD = 0.5;
/** @type {number} 全域高透明度特徵門檻 */
let TRANSPARENCY_THRESHOLD = DEFAULT_TRANSPARENCY_THRESHOLD;

// 5. 高頻率特徵門檻 (Heuristic Repetition Threshold)
const DEFAULT_HEURISTIC_THRESHOLD = 0.8;
/** @type {number} 高頻率出現門檻 (0~1) */
let HEURISTIC_THRESHOLD = DEFAULT_HEURISTIC_THRESHOLD;

// 6. 預覽標示紅框外觀設定 (Form XObject, Image XObject, Annotation 共用)
const PREVIEW_HIGHLIGHT_CONFIG = {
    color: [1, 0.2, 0.2], // RGB 顏色比例 (0~1)，紅色
    borderWidth: 3, // 邊框寬度
    fillOpacity: 0.25, // 底色半透明度
    borderOpacity: 0.8, // 邊框半透明度
};

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
        const savedThreshold = localStorage.getItem('TRANSPARENCY_THRESHOLD');
        const savedHeuristicThreshold = localStorage.getItem('HEURISTIC_THRESHOLD');

        WATERMARK_KEY_KEYWORDS = savedKeys ? JSON.parse(savedKeys) : [...DEFAULT_KEY_KEYWORDS];
        WATERMARK_CONTENT_KEYWORDS = savedContents ? JSON.parse(savedContents) : [...DEFAULT_CONTENT_KEYWORDS];
        TRANSPARENCY_THRESHOLD =
            savedThreshold !== null && !isNaN(parseFloat(savedThreshold))
                ? parseFloat(savedThreshold)
                : DEFAULT_TRANSPARENCY_THRESHOLD;
        HEURISTIC_THRESHOLD =
            savedHeuristicThreshold !== null && !isNaN(parseFloat(savedHeuristicThreshold))
                ? parseFloat(savedHeuristicThreshold)
                : DEFAULT_HEURISTIC_THRESHOLD;
    } catch {
        WATERMARK_KEY_KEYWORDS = [...DEFAULT_KEY_KEYWORDS];
        WATERMARK_CONTENT_KEYWORDS = [...DEFAULT_CONTENT_KEYWORDS];
        TRANSPARENCY_THRESHOLD = DEFAULT_TRANSPARENCY_THRESHOLD;
        HEURISTIC_THRESHOLD = DEFAULT_HEURISTIC_THRESHOLD;
    }
    buildFinalContentKeywords();
}

/**
 * 儲存全域設定至 localStorage
 * @param {string[]} keysArray - 資源鍵名關鍵字陣列
 * @param {string[]} contentsArray - 內容文字關鍵字陣列
 * @param {number} threshold - 透明度門檻值
 * @param {number} heuristicThreshold - 智慧偵測高頻率門檻
 */
function saveGlobalKeywords(
    keysArray,
    contentsArray,
    threshold = DEFAULT_TRANSPARENCY_THRESHOLD,
    heuristicThreshold = DEFAULT_HEURISTIC_THRESHOLD
) {
    WATERMARK_KEY_KEYWORDS = keysArray;
    WATERMARK_CONTENT_KEYWORDS = contentsArray;
    TRANSPARENCY_THRESHOLD = threshold;
    HEURISTIC_THRESHOLD = heuristicThreshold;

    localStorage.setItem('WATERMARK_KEY_KEYWORDS', JSON.stringify(keysArray));
    localStorage.setItem('WATERMARK_CONTENT_KEYWORDS', JSON.stringify(contentsArray));
    localStorage.setItem('TRANSPARENCY_THRESHOLD', TRANSPARENCY_THRESHOLD.toString());
    localStorage.setItem('HEURISTIC_THRESHOLD', HEURISTIC_THRESHOLD.toString());

    buildFinalContentKeywords();
}

// 初始載入
loadGlobalKeywords();
