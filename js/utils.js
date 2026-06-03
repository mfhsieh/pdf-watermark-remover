/**
 * @fileoverview 核心工具與特徵判定輔助模組。
 * 實作 PDFLib 資源解構、二進位字串編解碼、十六進制處理、以及六大浮水印策略的純函式判定邏輯 (Heuristics & Matching)。
 */

// ==========================================
// [Core Utilities] 核心工具與輔助函式
// ==========================================

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

/**
 * 將字串中的正則表達式特殊字元進行跳脫，以安全地嵌入 RegExp 建構式
 * @param {string} str - 需要跳脫的原始字串
 * @returns {string} 跳脫後的字串
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 判定資源鍵名或圖層名稱是否含有疑似浮水印的特徵
 * @param {string} text - 鍵名或圖層名稱
 * @returns {boolean} 若包含浮水印特徵則回傳 true，否則回傳 false
 */
function isSuspectKeyName(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return WATERMARK_KEY_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
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
 * @returns {boolean} 若包含浮水印特徵則回傳 true，否則回傳 false
 */
function isSuspectContentText(text) {
    if (!text) return false;
    const expandedText = decodeHexStringsInText(text);
    const lower = expandedText.toLowerCase();
    return FINAL_CONTENT_KEYWORDS.some((kw) => {
        // 若為純 ASCII（如英文關鍵字），轉小寫進行不區分大小寫的寬鬆比對
        if (/^[\x00-\x7F]*$/.test(kw)) {
            return lower.includes(kw.toLowerCase());
        }
        // 非 ASCII（包含中文原字串、或二進位特徵位元組），進行嚴格精確比對
        // 避免 toLowerCase() 破壞二進位特徵值
        return expandedText.includes(kw);
    });
}

/**
 * 策略 1: 表單外部物件 (Form XObject) 判定
 * @param {Object} entry - 表單外部物件偵測 Entry
 * @param {string} [rawStr=''] - 原始內容流文字 (可選)
 * @returns {boolean} 是否為疑似浮水印
 */
function isSuspectFormXObject(entry, rawStr = '') {
    if (!entry) return false;
    if (entry.isHeuristic) return true;
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
    return entry.subtype === 'Watermark' || entry.subtype === 'Stamp';
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
    if (entry.isHeuristic) return true;
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
    // 使用 config.js 中全域定義的透明度門檻（預設 0.5）
    return caVal <= TRANSPARENCY_THRESHOLD || CAVal <= TRANSPARENCY_THRESHOLD;
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
 * @param {Uint8Array} data - 二進位資料陣列
 * @returns {string} 轉換後的字串
 */
function decodeBinaryToText(data) {
    let str = '';
    const chunkSize = 16384;
    for (let i = 0; i < data.length; i += chunkSize) {
        str += String.fromCharCode.apply(null, data.subarray(i, i + chunkSize));
    }
    return str;
}

/**
 * 將二進位 Latin1 字串安全地轉換回 Uint8Array 位元組陣列
 * @param {string} text - Latin1 格式的二進位字串
 * @returns {Uint8Array} 轉換後的位元組陣列
 */
function encodeTextToBinary(text) {
    const arr = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
        arr[i] = text.charCodeAt(i) & 0xff;
    }
    return arr;
}

// ==========================================
// [Binary & String Utils] 二進位與編碼輔助函式
// ==========================================
/**
 * 將字串動態編譯為 Big5 格式的 Latin1 字串
 * 依賴 text-encoding polyfill (NONSTANDARD_allowLegacyEncoding)
 * @param {string} str - 輸入字串
 * @returns {string} Big5 編碼的 Latin1 字串，若失敗則回傳空字串
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
        // 將 UTF-8 字元的 16 位元代碼，拆分為高位元組 (High byte) 與低位元組 (Low byte)
        // 以支援 PDF 標準中文字型的 UTF-16BE 二進位特徵表示法
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
    let start = 0;
    while (true) {
        // 找尋 < 與 >，框出十六進位字串區塊
        const openIdx = text.indexOf('<', start);
        if (openIdx === -1) break;
        const closeIdx = text.indexOf('>', openIdx);
        if (closeIdx === -1) break;

        const hexClean = text.substring(openIdx + 1, closeIdx).replace(/\s/g, '');
        start = closeIdx + 1;

        if (hexClean.length === 0) continue;
        let paddedHex = hexClean;
        // 若十六進位字串長度為奇數，依 PDF 規範應在尾部補 0
        if (paddedHex.length % 2 !== 0) {
            paddedHex += '0';
        }

        try {
            const decodedChars = [];
            // 將每兩個十六進位字元視為一個位元組進行解碼，並組合成 Latin1 字串
            for (let i = 0; i < paddedHex.length; i += 2) {
                const byteVal = parseInt(paddedHex.substring(i, i + 2), 16);
                if (isNaN(byteVal)) break; // 遇到非十六進位字元提早中斷，取代耗時的 Regex 測試
                decodedChars.push(String.fromCharCode(byteVal));
            }
            expandedText += ' ' + decodedChars.join('');
        } catch (e) {
            console.debug('hex string 解碼失敗（可忽略）', e);
        }
    }
    return expandedText;
}

/** @type {WeakMap<PDFRawStream, Uint8Array>} 內容串流解碼快取，用於降低大檔重複掃描的效能開銷 */
const streamDecodeCache = new WeakMap();

/**
 * 安全地獲取並解壓縮 PDFRawStream 的二進位內容
 * @param {PDFRawStream} stream - PDF 原始二進位串流
 * @returns {Uint8Array} 解密解壓後的二進位資料
 */
function getDecodedStreamContents(stream) {
    if (!(stream instanceof PDFRawStream)) return new Uint8Array();

    if (streamDecodeCache.has(stream)) {
        return streamDecodeCache.get(stream);
    }

    try {
        const decoded = PDFLib.decodePDFRawStream(stream);
        decoded.reset();
        const bytes = decoded.getBytes();
        streamDecodeCache.set(stream, bytes);
        return bytes;
    } catch (err) {
        console.error('解碼二進位串流失敗，回退至 raw 資料', err);
        const bytes = stream.contents || new Uint8Array();
        streamDecodeCache.set(stream, bytes);
        return bytes;
    }
}
