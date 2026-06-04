/**
 * @fileoverview 全域 UI 元素參照與無障礙 (A11y) 控制。
 *
 * TODO: [Technical Debt] 全域變數與狀態相依性過高
 * 此模組承載了極大的 UI 狀態控制邏輯，且高度依賴 `window.State` 與其他全域函數。
 * 因應專案目前需維持 `file://` 離線執行的最高指導原則而無法使用原生 ESM `import/export`，此架構目前是可接受的最佳解。
 * 未來若專案允許引入建置工具 (如 Vite/Webpack)，應優先對這兩支檔案進行模組化解耦，以便進行單元測試。
 * 集中選取並快取所有的 DOM 節點以提升效能，並實作跨元件的焦點陷阱 (Focus Trap) 與鍵盤事件攔截。
 */

// ==========================================
// [UI Components] DOM 元素選取與介面控制
// ==========================================

/** @type {HTMLInputElement} 檔案輸入元素 */
const fileInput = document.getElementById('fileInput');
/** @type {HTMLElement} 檔案拖曳與顯示區域 */
const fileArea = document.getElementById('fileArea');
/** @type {HTMLElement} 檔案區域內部容器 */
const fileAreaInner = document.querySelector('.file-area-inner');
/** @type {HTMLElement} 狀態訊息顯示區塊 */
const statusEl = document.getElementById('status');
/** @type {HTMLButtonElement} 執行處理按鈕 */
const processButton = document.getElementById('processButton');
/** @type {HTMLElement} 下載區域區塊 */
const downloadArea = document.getElementById('downloadArea');
/** @type {HTMLAnchorElement} 下載連結元素 */
const downloadLink = document.getElementById('downloadLink');
/** @type {HTMLElement} 清理選項容器 */
const optionsContainer = document.getElementById('optionsContainer');

// PDF 雙欄預覽容器與 iframe
/** @type {HTMLElement} 雙欄預覽容器 */
const previewContainer = document.getElementById('previewContainer');
/** @type {HTMLIFrameElement} 原始 PDF 預覽 iframe */
const originalPreview = document.getElementById('originalPreview');
/** @type {HTMLElement} 處理後預覽區塊容器 */
const processedPreviewBox = document.getElementById('processedPreviewBox');
/** @type {HTMLIFrameElement} 處理後 PDF 預覽 iframe */
const processedPreview = document.getElementById('processedPreview');

// 物件即時預覽彈窗 (Object Preview Modal) 元件
/** @type {HTMLElement} 物件預覽彈窗元素 */
const objectPreviewModal = document.getElementById('objectPreviewModal');
/** @type {HTMLElement} 物件預覽彈窗標題 */
const objectPreviewTitle = document.getElementById('objectPreviewModalTitle');
/** @type {HTMLElement} 物件預覽載入中指示器 */
const objectPreviewSpinner = document.getElementById('objectPreviewSpinner');
/** @type {HTMLIFrameElement} 物件預覽 iframe */
const objectPreviewIframe = document.getElementById('objectPreviewIframe');

// ==========================================
// [A11y] 全域 Modal Focus Trap (焦點陷阱) 與 Escape 鍵支援
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.querySelector('.container');
    const modals = document.querySelectorAll('.modal-overlay');
    let lastActiveElement = null;
    let currentlyHasActiveModal = false;

    /**
     * 透過 MutationObserver 統一監聽所有 Modal 的 class 變化，並自動處理焦點與 inert。
     * 確保開啟 Modal 時，背景內容無法透過鍵盤或螢幕閱讀器存取 (符合 a11y 無障礙規範)。
     * @type {MutationCallback}
     */
    const observer = new MutationObserver(() => {
        const hasActiveModal = Array.from(modals).some((m) => m.classList.contains('active'));

        if (hasActiveModal !== currentlyHasActiveModal) {
            if (hasActiveModal) {
                // 狀態從無到有：記錄開啟前的焦點
                lastActiveElement = document.activeElement;
                if (mainContainer) {
                    mainContainer.inert = true;
                    mainContainer.setAttribute('aria-hidden', 'true');
                }
                document.body.classList.add('modal-open');
                // 將焦點移入 Modal
                const activeModal = document.querySelector('.modal-overlay.active');
                if (activeModal && !activeModal.contains(document.activeElement)) {
                    // 優先 focus 有 autofocus 屬性的元素，其次是輸入框，否則 focus 第一個可互動按鈕
                    const focusable =
                        activeModal.querySelector('[autofocus]') ||
                        activeModal.querySelector(
                            'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
                        ) ||
                        activeModal.querySelector('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
                    if (focusable) focusable.focus();
                }
            } else {
                // 狀態從有到無：解開 inert 並還原焦點
                if (mainContainer) {
                    mainContainer.inert = false;
                    mainContainer.setAttribute('aria-hidden', 'false');
                }
                document.body.classList.remove('modal-open');
                if (lastActiveElement && document.body.contains(lastActiveElement)) {
                    lastActiveElement.focus();
                }
                lastActiveElement = null;
            }
            currentlyHasActiveModal = hasActiveModal;
        }
    });

    modals.forEach((modal) => {
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    /**
     * 支援 Escape 鍵全局關閉與 Tab 鍵焦點陷阱 (Focus Trap Fallback)
     * 確保使用者在 Modal 內使用 Tab 鍵切換焦點時，焦點不會不慎跑出 Modal 外部。
     * @param {KeyboardEvent} e - 鍵盤按鍵事件
     */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                // 選取 Modal 內所有可獲取焦點的元素
                const focusableElements = activeModal.querySelectorAll(
                    'button:not([disabled]), [href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (focusableElements.length > 0) {
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];

                    // Shift + Tab：如果當前焦點在第一個元素，跳到最後一個
                    if (e.shiftKey) {
                        if (
                            document.activeElement === firstElement ||
                            document.activeElement === activeModal ||
                            document.activeElement === document.body
                        ) {
                            e.preventDefault();
                            lastElement.focus();
                        }
                    } else {
                        // Tab：如果當前焦點在最後一個元素，跳到第一個
                        if (document.activeElement === lastElement) {
                            e.preventDefault();
                            firstElement.focus();
                        }
                    }
                } else {
                    // 若無可獲取焦點的元素，直接攔截預設行為以將焦點鎖定在 modal
                    e.preventDefault();
                }
            }
        } else if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                // 尋找取消或關閉按鈕並觸發點擊，確保對應的清理邏輯 (如 Blob 釋放) 正常執行
                const closeBtn = activeModal.querySelector(
                    '.preview-modal-close-btn, #modalCancelButton, .button:not(.button-primary)'
                );
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    activeModal.classList.remove('active');
                }
            }
        }
    });
});
