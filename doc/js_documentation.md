# PDF 浮水印清除工具 - 前端 JavaScript 架構文件

本文件詳細記錄了 `js/` 目錄下的所有 JavaScript 模組之架構、分工作用以及核心邏輯。本專案採用 Vanilla JavaScript (ES6+) 開發，並基於 `pdf-lib` 與 `qpdf-wasm` 進行 PDF 結構的解析與操作。

## 1. 架構總覽

整個前端應用程式被劃分為九個職責單一的模組檔案，以便於維護與擴充。系統的運作流程可概分為：
1. **設定與狀態初始化：** 載入全域關鍵字與暫存變數。
2. **檔案讀取與掃描：** 讀取 PDF（必要時解密），並於背景掃描可能的浮水印物件。
3. **預覽與互動：** 顯示雙欄預覽窗格，並提供策略選項的即時預覽。
4. **核心清除與重建：** 根據使用者的勾選，以無損置換的方式清理 PDF 內容流，並匯出處理後的文件。

---

## 2. 檔案分工與說明

模組之間透過全域變數與函式進行依賴，主要檔案列表如下：

| 檔案名稱 | 核心職責 | 說明 |
| :--- | :--- | :--- |
| `config.js` | 全域設定與關鍵字 | 處理浮水印判定關鍵字的動態編譯（支援 UTF-16BE、Big5），並管理 localStorage 存取。 |
| `state.js` | 狀態管理 | 集中管理記憶體暫存（如 PDF 解密快取）、清除策略的待刪除清單，以及共用的日誌與預覽彈窗狀態。 |
| `utils.js` | 核心判定工具 | 提供六大浮水印策略的判定邏輯（`isSuspect...`）、二進位字串轉換，以及高頻與高透明度等「智慧門檻偵測」。 |
| `ui.js` | DOM 選取與無障礙 | 集中宣告介面上的 DOM 元素常數，並負責全域的無障礙 (a11y) 控制（如 Escape 鍵監聽與 Modal 焦點陷阱）。 |
| `ui-modals.js` | 彈窗管理類別 | 將清除策略的選項視窗封裝為 `WatermarkStrategyModal` 類別，並包含物件即時預覽 (`openObjectPreview`) 的載入與清理邏輯。 |
| `pdf-scanner.js`| 掃描與預覽引擎 | 負責載入 PDF、執行密碼解密驗證，掃描各類型物件以找出疑似浮水印，並動態產生即時預覽的 Blob URL。 |
| `pdf-cleaner.js`| 核心清除引擎 | 執行實際的 PDF 結構重構。運用「空串流置換」與正則防禦技術來移除浮水印，防止 PDF 損毀。 |
| `app.js` | 流程控制與事件綁定 | 程式的進入點。負責綁定拖曳、點擊等事件，統一檔案處理流程 (`handleFileSelected`)，並串接上述模組完成完整流程。 |
| `polyfill-config.js` | 相容性補丁 | 定義 `window.TEXT_ENCODING_NO_POLYFILL` 等環境變數，確保 `text-encoding` 函式庫在現代瀏覽器中正常運作。 |

---

## 3. 六大核心清除策略

本系統針對 PDF 的底層結構，實作了六種無損清除策略。所有的判定邏輯定義於 `utils.js`，清除邏輯實作於 `pdf-cleaner.js`：

1. **表單外部物件 (Form XObject)：** 針對封裝為可重複使用的圖形或文字物件。清除時會使用空白的 XObject 串流進行取代。
2. **註解 (Annotation)：** 包含浮水印 (`Watermark`)、印章 (`Stamp`) 等附加於頁面上方的元件。清除時直接從頁面的 `/Annots` 陣列中移除參照。
3. **頁面直接內容 (Direct Content)：** 針對直接寫入於頁面內容流（Contents stream）的明文指令。系統會讀出並比對文字，若命中特徵碼則將該流內容清空。
4. **影像外部物件 (Image XObject)：** 針對圖片型態的浮水印。清除時會置換為 1x1 的全透明影像遮罩 (`ImageMask`)。
5. **延伸圖形狀態 (ExtGState)：** 某些浮水印透過綁定特定的透明度（`ca` / `CA`）來呈現半透明效果。此策略負責移除特定的圖形狀態參照。
6. **選擇性內容群組 (OCG / 圖層)：** 針對利用 PDF 圖層功能實作的浮水印。系統會從 `/OCGs` 清單中移除，並強制將其加入至預設隱藏（`/OFF`）陣列中。

---

## 4. 各檔案詳細 API 與功能解析

### `config.js`
負責管理使用者的全域設定，特別是浮水印比對用的關鍵字。
- **重要函式：**
  - `buildFinalContentKeywords()`: 將使用者輸入的關鍵字轉換為小寫、以及各種編碼（如 Big5、UTF-16BE）的 Latin1 特徵碼陣列，儲存於 `FINAL_CONTENT_KEYWORDS`，以應對不同編碼形式的 PDF。
  - `loadGlobalKeywords()` / `saveGlobalKeywords()`: 從 localStorage 讀寫設定。

### `state.js`
存放跨檔案共用的狀態，防止互相污染。
- **重要變數：**
  - `detectedFormXObjects` 等：儲存背景掃描引擎抓出的物件 Map。
  - `formXObjectsToDestroy` 等：儲存使用者目前「勾選準備要刪除」的物件清單。
  - `cachedDecryptedBytes`: 儲存剛解密後的 PDF 原始資料（免去重複解密耗時）。
- **重要函式：**
  - `decryptWithQpdfWasm(pdfBytes, password)`: 呼叫 qpdf-wasm 引擎進行非同步解密。包含虛擬記憶體清理（`FS.unlink`）的防禦性除錯邏輯。
  - `resetAllState()`: 負責清空快取變數並安全釋放所有儲存於 `previewUrlCache` 的 Blob URL，防止記憶體洩漏。

### `utils.js`
所有與「判定是否為浮水印」相關的純函式 (Pure functions)。
- **判定函式：** `isSuspectKeyName(text)`, `isSuspectContentText(text)` 等，這兩個是底層文字特徵比對。
- **策略判定與智慧門檻：** `isSuspectFormXObject()`, `isSuspectAnnotation()`, `isSuspectExtGState()` 等。其中實作了「高頻特徵門檻」（針對出現次數異常高的物件）與「高透明度特徵門檻」（針對 Alpha 值 < 0.3 的圖形狀態），供掃描引擎呼叫以決定是否要「預設勾選」該物件。

### `pdf-scanner.js`
極其核心的非同步掃描器，職責包含「安全載入」與「預覽生成」。
- **核心流程 `showOriginalPreview(file)`：**
  1. 重置所有全域狀態。
  2. 嘗試讀取 PDF，若失敗則呼叫 `decryptWithQpdfWasm` 處理密碼邏輯。
  3. 進入**背景掃描迴圈**，遍歷所有頁面的 `Resources`、`Annots` 與 `Contents`，建立可疑物件清單。
  4. 產生原始 PDF 的 Blob URL 以供預覽。
- **預覽生成器：** `generateFormXObjectPreviewUrl` 等，這些函式會利用 PDF-lib 動態抽取出單一物件，將周遭干擾隱藏後轉出成獨立的 PDF 供 iframe 檢視。

### `pdf-cleaner.js`
真正修改 PDF 位元組的引擎，遵循「無損置換」原則。
- **核心流程 `processPdf(pdfDoc, options)`：**
  根據選項，依序呼叫對應的移除邏輯，並確保以「單頁隔離」的方式（如 `clone()` 字典）進行修改，避免破壞其他頁面共用的資源樹。
- **空串流置換 `createBlankXObjectStream()`：**
  對於需要移除的資源，不能物理刪除字典鍵值，否則可能導致 PDF 工具（如 Acrobat Reader）報錯。此函式會註冊一個完全透明的物件將其覆蓋。
- **安全參照清理 `cleanContentStreams()`：**
  若將 XObject 抽掉，原本呼叫該物件的指令（如 `/Fm0 Do`）若繼續存在，也會導致報錯。此函式負責使用 RegExp 在明文內容流中徹底抹除這些呼叫。過程中會呼叫 `escapeRegex()` 以防止特殊字元導致正則引擎報錯 (ReDoS 風險)。

### `ui-modals.js`
為了減少重複的 DOM 操作，這裡採用 OOP 封裝。
- **`WatermarkStrategyModal` 類別：** 
  提供通用的彈窗邏輯，自動生成核取方塊清單、綁定全選/全不選功能，以及動態插入「即時預覽 (👁️)」按鈕。透過傳入 `config` 物件將六大策略的資料綁定在同一套 UI 上。底層渲染改用安全的 `replaceChildren()` 避免 `innerHTML` 風險。
- **即時預覽系統 (`openObjectPreview` & `closeObjectPreview`)：**
  根據不同的浮水印策略類型動態載入預覽 iframe，並在關閉視窗時即時呼叫 `URL.revokeObjectURL()` 釋放記憶體。

### `ui.js`
不僅負責使用 `document.getElementById` 集中宣告所有固定存在的 DOM 元素，它現在更是專案的 **無障礙體驗 (a11y) 守門員**：
- **全域 Escape 鍵監聽：** 統一處理按下 ESC 鍵時關閉預覽彈窗或設定選單，並即時執行清理邏輯。
- **Modal 焦點陷阱 (Focus Trap)：** 實作 `MutationObserver` 監聽彈窗狀態，當 Modal 開啟時自動對主背景 (`#mainContainer`) 設定 `inert="true"`，防止鍵盤 (Tab 鍵) 焦點穿透到後方元件，符合 WCAG AA 無障礙標準。

### `app.js`
系統的生命週期進入點。
- **統一檔案處理：** 提供 `handleFileSelected(file)` 共用函式，避免冗餘。
- **事件綁定：** 監聽 `fileInput.addEventListener("change")` 以及 Drag & Drop 事件。
- **處理流程：** 當使用者點擊「開始清除浮水印」按鈕時，取出 `cachedDecryptedBytes`，呼叫 `processPdf`，然後將重構完成的文件轉成 Blob 並掛載到右側結果預覽區及下載按鈕。

### `polyfill-config.js`
處理外部依賴套件相容性的補丁檔案。
- **環境設定：** 定義 `window.TEXT_ENCODING_NO_POLYFILL` 等環境變數。主要是為了解決 `text-encoding` 函式庫在現代瀏覽器環境中執行時可能產生的衝突或錯誤，確保其 Big5 字元編解碼功能能穩定運作。
