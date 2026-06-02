/**
 * @fileoverview 早期環境相容性設定模組。
 * 主要針對舊版 text-encoding polyfill，確保其在現代瀏覽器中也能強制掛載，支援 Big5 等非標準編碼處理。
 */

// ==========================================
// [Polyfill Config] 早期環境相容性設定
// ==========================================
// 為了讓舊版 text-encoding 可以順利掛載全域的 TextEncoder / TextDecoder
window.TextEncoder = undefined;
window.TextDecoder = undefined;
