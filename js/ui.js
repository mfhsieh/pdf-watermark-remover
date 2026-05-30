// [UI Components] DOM 元素選取與介面控制
// ==========================================

const fileInput = document.getElementById("fileInput");
const fileArea = document.getElementById("fileArea");
const fileAreaInner = document.querySelector(".file-area-inner");
const statusEl = document.getElementById("status");
const processButton = document.getElementById("processButton");
const downloadArea = document.getElementById("downloadArea");
const downloadLink = document.getElementById("downloadLink");
const optionsContainer = document.getElementById("optionsContainer");

// PDF 雙欄預覽容器與 iframe
const previewContainer = document.getElementById("previewContainer");
const originalPreview = document.getElementById("originalPreview");
const processedPreviewBox = document.getElementById("processedPreviewBox");
const processedPreview = document.getElementById("processedPreview");

// 物件即時預覽彈窗 (Object Preview Modal) 元件
const objectPreviewModal = document.getElementById("objectPreviewModal");
const objectPreviewTitle = document.getElementById("objectPreviewTitle");
const objectPreviewSpinner = document.getElementById("objectPreviewSpinner");
const objectPreviewIframe = document.getElementById("objectPreviewIframe");

// 六大清理策略控制選項
const chkRemoveFormXObject = document.getElementById("removeFormXObject");
const chkRemoveAnnotations = document.getElementById("removeAnnotations");
const chkRemoveDirectContent = document.getElementById("removeDirectContent");
const chkRemoveImageXObject = document.getElementById("removeImageXObject");
const chkRemoveExtGState = document.getElementById("removeExtGState");
const chkRemoveOCG = document.getElementById("removeOCG");

// ==========================================
