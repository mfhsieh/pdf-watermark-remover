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

// 六大清理策略控制選項
/** @type {HTMLInputElement} 是否移除表單外部物件 (Form XObject) 的核取方塊 */
const chkRemoveFormXObject = document.getElementById('removeFormXObject');
/** @type {HTMLInputElement} 是否移除註解 (Annotations) 的核取方塊 */
const chkRemoveAnnotations = document.getElementById('removeAnnotations');
/** @type {HTMLInputElement} 是否移除頁面直接內容 (Direct Content) 的核取方塊 */
const chkRemoveDirectContent = document.getElementById('removeDirectContent');
/** @type {HTMLInputElement} 是否移除影像外部物件 (Image XObject) 的核取方塊 */
const chkRemoveImageXObject = document.getElementById('removeImageXObject');
/** @type {HTMLInputElement} 是否移除延伸圖形狀態 (ExtGState) 的核取方塊 */
const chkRemoveExtGState = document.getElementById('removeExtGState');
/** @type {HTMLInputElement} 是否移除選擇性內容群組 (OCG) 的核取方塊 */
const chkRemoveOCG = document.getElementById('removeOCG');
