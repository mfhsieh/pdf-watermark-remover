// ==========================================
// [Polyfill Config] 早期環境相容性設定
// ==========================================
// 為了讓舊版 text-encoding 可以順利掛載全域的 TextEncoder / TextDecoder
window.TextEncoder = undefined;
window.TextDecoder = undefined;
