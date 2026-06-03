/**
 * @fileoverview 早期環境相容性還原模組。
 * 載入完 text-encoding polyfill 後，還原原生 TextEncoder，避免影響 pdf-lib 與其他依賴。
 */

// ==========================================
// [Polyfill Config] 還原原生環境設定
// ==========================================
window.PolyfillTextEncoder = window.TextEncoder;
window.PolyfillTextDecoder = window.TextDecoder;
if (window.NativeTextEncoder) {
    window.TextEncoder = window.NativeTextEncoder;
    window.TextDecoder = window.NativeTextDecoder;
}
delete window.NativeTextEncoder;
delete window.NativeTextDecoder;
