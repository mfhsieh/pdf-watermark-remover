# PDF 浮水印清除工具 - 前端 JavaScript 架構文件

本文件詳細記錄了 `js/` 目錄下的所有 JavaScript 模組之架構、分工作用以及核心邏輯。本專案採用 Vanilla JavaScript (ES6+) 開發，具備 **100% 的 JSDoc 型別註釋與模組說明覆蓋率**，並基於 `pdf-lib` 與 `qpdf-wasm` 進行 PDF 結構的解析與操作。

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
| `pdf-scanner.js`| 掃描與預覽引擎 | 負責載入 PDF、執行密碼解密驗證，掃描各類型物件（支援巢狀遞迴掃描）以找出疑似浮水印，並動態產生即時預覽的 Blob URL。 |
| `pdf-cleaner.js`| 核心清除引擎 | 執行實際的 PDF 結構重構。運用「空串流置換」與正則防禦技術來移除浮水印，防止 PDF 損毀。 |
| `app.js` | 流程控制與事件綁定 | 程式的進入點。負責綁定拖曳、點擊等事件，統一檔案處理流程 (`handleFileSelected`)，並串接上述模組完成完整流程。 |
| `polyfill-config.js` | 相容性補丁 (前綴) | 將 `window.TextEncoder` 與 `TextDecoder` 強制設為 `undefined`，確保舊版 `text-encoding` 函式庫在現代瀏覽器中正常掛載。 |
| `polyfill-config-after.js`| 相容性補丁 (後置) | 在 `text-encoding` 載入完成後，還原原生的 `TextEncoder` 與 `TextDecoder`，以避免與其他現代套件 (如 `pdf-lib`) 衝突。 |

---

## 3. 六大核心清除策略

本系統針對 PDF 的底層結構，實作了六種無損清除策略。所有的判定邏輯定義於 `utils.js`，清除邏輯實作於 `pdf-cleaner.js`：

1. **表單外部物件 (Form XObject)：** 針對封裝為可重複使用的圖形或文字物件（支援巢狀結構）。清除時會直接從資源字典將其參照抹除，並清除呼叫指令。
2. **註解 (Annotation)：** 包含浮水印 (`Watermark`)、印章 (`Stamp`) 等附加於頁面上方的元件。清除時直接從頁面的 `/Annots` 陣列中移除參照。
3. **頁面直接內容 (Direct Content)：** 針對直接寫入於頁面內容流（Contents stream）的明文指令。系統會讀出並比對文字，若命中特徵碼則將該流內容清空。
4. **影像外部物件 (Image XObject)：** 針對圖片型態的浮水印。清除時同樣自資源字典中移除物件參照並清除呼叫指令。
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
  - **`STRATEGY_REGISTRY`**: 全域策略註冊表 (Single Source of Truth)，將六大清理策略的資料狀態 (`map`, `destroyList`) 與 UI 綁定 ID 集中管理，完美解決了散彈槍手術 (Shotgun Surgery) 的壞味道。
- **重要函式：**
  - `decryptWithQpdfWasm(pdfBytes, password)`: 呼叫 qpdf-wasm 引擎進行非同步解密。包含虛擬記憶體清理（`FS.unlink`）的防禦性除錯邏輯。
  - `resetAllState()`: 負責清空快取變數並安全釋放 `previewUrlCache` 的 Blob URL，防止記憶體洩漏。此處重置陣列時採用**就地清空 (`length = 0`)** 進行突變 (Mutation)，以確保所有 Modal 與引擎間的陣列記憶體參照 (Reference) 永不中斷。

### `utils.js`
所有與「判定是否為浮水印」相關的純函式 (Pure functions) 與二進位處理工具。
- **判定函式：** `isSuspectKeyName(text)`, `isSuspectContentText(text)` 等，這兩個是底層文字特徵比對。
- **策略判定與智慧門檻：** `isSuspectFormXObject()`, `isSuspectAnnotation()`, `isSuspectExtGState()` 等。其中實作了「高頻特徵門檻」（針對出現次數異常高的物件）與「高透明度特徵門檻」（針對 Alpha 值 < 0.3 的圖形狀態），供掃描引擎呼叫以決定是否要「預設勾選」該物件。
- **解碼與快取 (Performance)：** 實作 `getDecodedStreamContents` 並導入 `WeakMap` 進行解碼快取 (`streamDecodeCache`)，避免在大型 PDF 背景掃描、特徵比對與提取 CTM 矩陣時，對同一串流進行重複的 FlateDecode 效能消耗。

### `pdf-scanner.js`
極其核心的非同步掃描器，職責包含「安全載入」與「預覽生成」。
- **統一註冊防呆：** 實作 `registerSuspectEntry()` 與跨頁專用的 `registerOrUpdateXObject()` 輔助函式，統一接管 6 大策略的掃描註冊與頁碼陣列推入，消滅重複的 IF 判斷，徹底落實 DRY 原則。
- **核心流程 `showOriginalPreview(file)`：**
  1. 重置所有全域狀態。
  2. 嘗試讀取 PDF，若失敗則呼叫 `decryptWithQpdfWasm` 處理密碼邏輯。
  3. 進入**背景掃描迴圈**，遍歷所有頁面的 `Resources`、`Annots` 與 `Contents`，建立可疑物件清單。此過程中導入了**時間切片 (Time Slicing)** 技術避免凍結，並支援**遞迴掃描巢狀 Form XObject** (`traverseResources`)，確保深層隱藏的浮水印也能被抓出。
  4. 產生原始 PDF 的 Blob URL 以供預覽。
- **隔離沙盒與矩陣解析 (CTM)：** 透過 `createIsolatedPreviewDoc()` 產生乾淨的預覽沙盒。透過 `getCTMForXObject` 精確解析累積變換矩陣，完美還原物件的縮放與旋轉角度，甚至產生精準貼合的傾斜多邊形紅框 (`getPreviewHighlightPolygonCmd`)。Form 與 Image 的預覽邏輯已被完美收斂至 `generateXObjectPreviewUrl()` 引擎中共用。
- **串流解壓縮：** 統一使用專案內建的 `getDecodedStreamContents` 來取代自行刻製的 FlateDecode 邏輯，避免重複造輪子且提昇穩定度。

### `pdf-cleaner.js`
真正修改 PDF 位元組的引擎，遵循「無損置換」原則。
- **核心流程 `processPdf(pdfDoc, options)`：**
  根據選項，依序呼叫對應的移除邏輯。過程中採用了**時間切片 (Time Slicing)**，每處理 10 頁便讓出主執行緒，防止大型文件清除時畫面凍結。同時確保以「單頁隔離」的方式（如 `clone()` 字典）進行修改，避免破壞其他頁面共用的資源樹。針對不規範的 `PDFRef` 也已具備安全容錯機制。
- **高階共用刪除引擎 (`removeDictEntries` / `removeArrayItems`)：**
  將所有的資源字典 (Dictionary) 屬性移除與陣列 (Array) 元素移除邏輯抽象化。接收高階函式 (Callback) 作為刪除條件判定，並採用反向迴圈確保陣列物理移除時不會發生索引錯位。
- **安全移除資源字典 `safeRemoveFromDictionary()`：**
  以複製隔離的手段修改資源字典，直接將需被清除的資源鍵值物理移除，而不會影響原文件共用結構。並具備智慧判斷，若原物件為間接參照 (`PDFRef`)，會自動註冊新參照，徹底解決了清除共用資源時可能導致 PDF 底層樹狀結構引用斷裂的隱患。
- **安全參照清理 `cleanContentStreams()` 與 `removeDeletedReferencesFromText()`：**
  若將 XObject 抽掉，原本呼叫該物件的指令若繼續存在，會導致 Acrobat Reader 等工具報錯。此函式除了以正則徹底抹除殘留呼叫外，更新增了**快速字串比對**，在執行昂貴的正則替換前先做預先過濾，大幅降低了大檔的處理時間。同時也支援了巢狀 `Resources` 的遞迴清理 (`cleanResourcesRecursively`)。
  > **Trade-off (效能/穩定性取捨)**：為了確保修改後的 Content Stream 結構穩定性並避免 Acrobat 報錯，重新寫入的內容流會捨棄原有的壓縮演算法 (如 `FlateDecode` Filter)。這會使得處理後的 PDF 體積微幅增加，但大幅提升了檔案的相容性與修復成功率。

### `ui-modals.js`
為了減少重複的 DOM 操作，這裡採用 OOP 封裝。
- **`WatermarkStrategyModal` 類別：** 
  提供通用的彈窗邏輯，自動生成核取方塊清單、綁定全選/全不選功能，以及動態插入「即時預覽 (👁️)」按鈕。透過傳入 `config` 將六大策略資料綁定。**動態生成的 DOM 結構嚴格遵循 HTML5 規範（使用獨立外層 `<div>` 容器分離 `<label>` 與 `<button>`），確保螢幕閱讀器與鍵盤焦點行為正確無誤。**
- **即時預覽系統 (`openObjectPreview` & `closeObjectPreview`)：**
  捨棄冗長的 `if...else`，改用**策略模式 (Strategy Pattern)** 的 `previewHandlers` 字典來分派預覽載入。切換預覽時會主動攔截並清除前一次的 Blob URL，徹底防堵記憶體洩漏 (Memory Leak)。
- **技術債 (Technical Debt) 註明：**
  已於原始碼頂部明確記錄其對於全域狀態 (`window.State`) 的高度相依性，作為未來若引入建置工具時，優先進行解耦與單元測試重構的明確方向。

### `ui.js`
不僅負責使用 `document.getElementById` 集中宣告所有固定存在的 DOM 元素，它現在更是專案的 **無障礙體驗 (a11y) 與行動端 UX 守門員**：
- **全域 Escape 鍵監聽：** 統一處理按下 ESC 鍵時關閉預覽彈窗或設定選單，並即時執行清理邏輯。
- **Modal 焦點陷阱 (Focus Trap) 與防捲動穿透 (Scroll Bleed Prevention)：** 實作 `MutationObserver` 監聽彈窗狀態。當 Modal 開啟時：
  1. 自動對主背景 (`#mainContainer`) 設定 `inert="true"` 與 `aria-hidden="true"`，防止鍵盤焦點與螢幕閱讀器穿透到後方元件。
  2. 針對手機版觸控拖曳導致的 **捲動穿透 (Scroll Bleed)** 問題，實作了終極防護：記錄捲動位置並將 `body` 強制設為 `position: fixed`，徹底鎖死底層主畫面；關閉時則無縫還原，完美提升行動端操作體驗。
- **技術債 (Technical Debt) 註明：** 與 `ui-modals.js` 相同，已標示並記錄其受限於 `file://` 執行環境而導致的模組耦合問題。

### `app.js`
系統的生命週期進入點。
- **統一檔案處理：** 提供 `handleFileSelected(file)` 共用函式，避免冗餘。加入了針對非同步預覽的錯誤捕捉 (`catch`) 防護，避免發生 Unhandled Promise Rejection 引發的隱性崩潰。同時在拖曳上傳中增加了附檔名檢查，作為跨作業系統拖曳時可能遺失 MIME Type (`file.type`) 的後備方案。
- **事件綁定：** 監聽 `fileInput.addEventListener("change")` 以及 Drag & Drop 事件。
- **動態配置讀取與輸出：** 捨棄寫死的 DOM ID 綁定，`getOptions()` 會動態迭代全域的 `STRATEGY_REGISTRY` 來抓取 6 大策略當前的核取狀態，達到完全解耦（開閉原則）。處理流程中，會呼叫 `processPdf`，並將重構完成的文件轉成 Blob 供下載，**同時具備容錯的下載檔名處理後備方案**。

### `polyfill-config.js` & `polyfill-config-after.js`
處理外部依賴套件相容性的補丁檔案群。
- **環境設定與還原：** 透過先將 `window.TextEncoder` 設為 `undefined`，強制舊版 `text-encoding` polyfill 掛載，確保能穩定支援 Big5 等非標準編碼；載入完成後，再透過 `polyfill-config-after.js` 將原生的 TextEncoder 還原，避免對底層 `pdf-lib` 等依賴現代 API 的套件造成效能或相容性干擾。

---

## 5. 專案技術亮點與架構優勢

本專案在架構設計上，除了解決核心的 PDF 浮水印清除需求外，更在安全性、效能與使用者體驗上導入了多項現代前端最佳實踐：

1. **極致的安全性與記憶體管理 (Security & Memory Safety)**
   - **純前端零信任架構**：完全在瀏覽器記憶體內執行，不依賴任何後端伺服器，輔以嚴格的 CSP (Content Security Policy) 防護。
   - **Blob URL 防洩漏機制**：在物件預覽 (`openObjectPreview`) 與檔案切換 (`resetAllState`) 時，主動執行 `URL.revokeObjectURL()`，徹底防堵大型 PDF 產生的記憶體洩漏 (Memory Leak)。
   - **閉包與作用域優化**：將共用輔助函式（如 `escapeHTML`）提升至模組頂層，避免在頻繁觸發的事件中重複宣告閉包，降低垃圾回收 (GC) 負擔。
2. **進階效能優化 (Performance)**
   - **時間切片 (Time Slicing)**：在背景掃描巨型 PDF (`performBackgroundScan`) 與執行實際清除 (`processPdf`) 雙重環節中，均實作了每處理 10 頁即透過非同步微任務讓出主執行緒的機制，徹底解決大型檔案處理時的瀏覽器畫面凍結問題。
   - **WeakMap 解碼快取**：實作 `streamDecodeCache`，避免在特徵比對與矩陣解析時對相同的二進位串流重複進行昂貴的 FlateDecode 解壓縮。
   - **零冗餘代碼 (Zero Dead Code)**：極限縮減迴圈內不必要的陣列宣告與重複的 DOM 樣式變更，並去除無效的物件屬性，達到最佳化執行效率。
3. **無障礙體驗設計 (a11y)**
   - **焦點陷阱 (Focus Trap)**：全面實作 Modal 的鍵盤導覽 (Tab / Shift+Tab) 限制，並運用 `inert` 屬性動態隱藏背景 DOM，確保螢幕閱讀器與鍵盤使用者獲得完美體驗。
   - **語意化標籤 (Semantic ARIA)**：針對動態生成或未配對 `<label>` 的控制項（如密碼輸入框），主動補齊 `aria-label` 屬性，確保符合 WCAG 無障礙規範。
4. **極致的狀態同步與文件覆蓋率 (State & Documentation)**
   - **單一資料來源 (SSOT) 陣列突變**：在 UI 勾選更新狀態時，利用原地突變 (`destroyList.length = 0`) 取代重新賦值，徹底解決 Modal 視窗與底層 `STRATEGY_REGISTRY` 之間的記憶體參照脫鉤問題。
   - **100% JSDoc 覆蓋率**：所有模組、類別、函式與內部輔助閉包皆具備嚴格的 `@param`、`@returns` 等 JSDoc 標籤，保證自動化 API 文件生成的零死角。

---

## 6. 自動化 API 文件生成

本專案所有的 JavaScript 模組皆嚴格遵守 JSDoc 規範撰寫註解（包含 `@fileoverview`, `@param`, `@returns`, `@type` 等標籤）。
開發者可透過專案內建的 npm script 指令，自動掃描所有 `.js` 檔案並產出或更新 `API_Reference.md`：
```bash
npm run docs
```
