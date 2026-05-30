// ==========================================
// [Core Utilities] 核心工具與輔助函式
// ==========================================

/**
 * 判定資源鍵名或圖層名稱是否含有疑似浮水印的特徵
 * @param {string} text - 鍵名或圖層名稱
 * @returns {boolean}
 */
function isSuspectKeyName(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return WATERMARK_KEY_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * 判定實際內容文字流中是否含有疑似浮水印的特徵
 *
 * 注意：FINAL_CONTENT_KEYWORDS 同時包含：
 *   1. 可讀的英文/中文字串（toLowerCase 比對）
 *   2. UTF-16BE Latin1 / Big5 的二進位特徵碼（不可 toLowerCase，否則會破壞位元組值）
 * 因此必須對兩類分別比對：英文全小寫比對，二進位直接對原始 text 比對。
 *
 * @param {string} text - 內容流文字（以 Latin1 解碼的二進位字串）
 * @returns {boolean}
 */
function isSuspectContentText(text) {
    if (!text) return false;
    const expandedText = decodeHexStringsInText(text);
    const lower = expandedText.toLowerCase();
    return FINAL_CONTENT_KEYWORDS.some(kw => {
        if (kw === kw.toLowerCase()) {
            return lower.includes(kw);
        }
        return expandedText.includes(kw);
    });
}

/**
 * 策略 1: 表單外部物件 (Form XObject) 判定
 * @param {Object} entry - 表單外部物件偵測 Entry
 * @returns {boolean} 是否為疑似浮水印
 */
function isSuspectFormXObject(entry, rawStr = "") {
    if (!entry) return false;
    if (isSuspectKeyName(entry.keyName)) return true;
    if (rawStr && isSuspectContentText(rawStr)) return true;
    return false;
}

/**
 * 策略 2: 註解 (Annotation) 判定
 * @param {Object} entry - 註解偵測 Entry
 * @returns {boolean} 是否為疑似浮水印
 */
function isSuspectAnnotation(entry) {
    if (!entry) return false;
    return entry.subtype === "Watermark" || entry.subtype === "Stamp";
}

/**
 * 策略 3: 頁面直接內容 (Direct Content) 判定
 * @param {Object} entry - 頁面直接內容偵測 Entry
 * @returns {boolean} 是否為疑似浮水印
 */
function isSuspectDirectContent(entry) {
    if (!entry) return false;
    return isSuspectContentText(entry.rawText);
}

/**
 * 策略 4: 影像外部物件 (Image XObject) 判定
 * @param {Object} entry - 影像外部物件偵測 Entry
 * @returns {boolean} 是否為疑似浮水印
 */
function isSuspectImageXObject(entry) {
    if (!entry) return false;
    return isSuspectKeyName(entry.keyName);
}

/**
 * 策略 5: 延伸圖形狀態 (ExtGState) 判定
 * @param {Object} entry - 延伸圖形狀態偵測 Entry
 * @returns {boolean} 是否為疑似浮水印
 */
function isSuspectExtGState(entry) {
    if (!entry) return false;
    if (isSuspectKeyName(entry.keyName)) return true;
    const caVal = entry.caVal !== undefined ? entry.caVal : 1.0;
    const CAVal = entry.CAVal !== undefined ? entry.CAVal : 1.0;
    return caVal < 0.5 || CAVal < 0.5;
}

/**
 * 策略 6: 選擇性內容群組 (OCG) 判定
 * @param {Object} entry - 選擇性內容群組偵測 Entry
 * @returns {boolean} 是否為疑似浮水印
 */
function isSuspectOCG(entry) {
    if (!entry) return false;
    return isSuspectKeyName(entry.name);
}

/**
 * 將 Uint8Array 以二進位字串的方式精確轉換（避免 TextDecoder 將非 UTF-8 字元變成亂碼）
 * @param {Uint8Array} data 
 * @returns {string}
 */
function decodeBinaryToText(data) {
    let str = "";
    const chunkSize = 16384;
    for (let i = 0; i < data.length; i += chunkSize) {
        str += String.fromCharCode.apply(null, data.subarray(i, i + chunkSize));
    }
    return str;
}
