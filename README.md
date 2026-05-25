# 純前端 PDF 浮水印移除工具
[![Version](https://img.shields.io/badge/version-1.1.2-blue.svg)](https://github.com/mfhsieh/pdf-watermark-remover/)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-Hant)

在瀏覽器端執行的 PDF 浮水印移除工具，**檔案不會上傳至伺服器**。

[→ 線上使用](https://mfhsieh.github.io/pdf-watermark-remover/) | [→ 下載個人使用版本](https://github.com/mfhsieh/pdf-watermark-remover/raw/main/index.html)

## 📌 專案簡介

本專案透過 `pdf-lib` 程式庫直接在瀏覽器記憶體中重構 PDF 檔案，所有處理皆在本機端完成，**檔案絕對不會上傳至任何後端伺服器**，能有效保障文件隱私。

## 💡 主要功能

### 1. 六種清理策略
工具提供以下六種常見 PDF 物件的掃描與清理選項：
- **移除表單外部物件 (Form XObject)**：移除封裝在獨立子畫布中的向量或文字型物件（如最常見的背景浮水印）。提供**「精準過濾模式」**（預設，會解壓縮物件內部繪圖指令並比對關鍵字以防誤刪 Logo）與**「強力清除模式」**（會強制刪除所有 Form XObject 向量圖形）。
- **移除註解 (Annotation)**：提供**「註解個體客製化過濾」**設定彈窗，列出 PDF 中每一個具體的註解實例並標記所在頁碼與解碼文字內容，允許自由勾選要清除的個別實例，並預設自動預勾選最常作為浮水印的 `Watermark`（浮水印）與 `Stamp`（蓋印與圖章），同時保留其他如「超連結」與「互動表單」不被破壞。
- **掃描並清除頁面直接內容 (Direct Content)**：提供**「頁面直接內容個體客製化過濾」**設定彈窗，偵測並列出 PDF 每一頁中的頁面直接內容（Content Stream）實例並標記頁碼與解碼文字內容，允許自由勾選要清除的個別頁面直接內容實例（預設自動預勾選疑似浮水印的串流），**能極大程度地防止因誤判而導致整頁正常正文一併被清除變白**。
- **清理半透明效果 (ExtGState)**：清除透明度設定中與浮水印相關的 ExtGState 物件，並可透過自訂「內部資源代號」進行過濾。
- **清除浮水印圖層 (OCG)**：若浮水印定義在特定的選用內容圖層（Optional Content Group）中，可透過自訂關鍵字比對圖層名稱並將其隱藏。
- **移除圖片型浮水印 (Image XObject)**：若浮水印為圖片形式，可透過自訂「內部資源代號」關鍵字 (例如 `/Im1` 等) 進行比對並予以清除。

### 2. 雙欄對照預覽（Before & After）

提供「Before & After 雙欄對照預覽」，方便在下載前確認浮水印移除前後的視覺差異。

### 3. 精準解鎖「檔案權限限制」與「開啟密碼限制」

工具會自動偵測並分析 PDF 文件的加密保護狀態：

- **檔案權限限制**（無開啟密碼，但限制列印、編輯與複製等）：系統會自動導入 `qpdf-wasm` 進行權限解除，無須使用者手動介入，過程快速且自動化。
- **開啟密碼限制**（設有開檔密碼保護）：系統會主動識別並彈出密碼輸入框，由使用者輸入密碼後完成解密與浮水印清理。

### 4. 進階比對與過濾模式 (持久化儲存)

為了避免誤刪正常文件內容，工具為五大清理策略提供自訂關鍵字，並支援 `localStorage` 自動儲存設定，提供三種匹配模式（設定視窗中可獨立切換）：
*   **包含匹配 (Includes)**：PDF 物件名稱或內容文字包含關鍵字即清除，最為通用。
*   **完全匹配 (Exact)**：物件名稱必須完全符合關鍵字，防範誤刪正常的同名前綴插圖。
*   **正規表示式 (Regex)**：預設啟用。支援複雜正則比對，適合清理序列化或動態特徵的物件。
*   **回復預設值**：各設定彈窗提供「回復預設值」按鈕，可一鍵還原官方預設參數並啟用 Regex 模式。

#### 關鍵字預設值：
*   **表單外部物件 (Form XObject)**：`watermark`, `wm`, `confidential`, `draft`, `sample`, `internal`, `copy`, `trial`, `evaluation`, `demo`, `機密`, `內部`, `草稿`, `樣本`, `樣品`, `複製品`, `浮水印`, `水印`, `僅供參考`
*   **掃描特徵 (Direct Content)**：`watermark`, `wm`, `confidential`, `draft`, `sample`, `internal`, `copy`, `trial`, `evaluation`, `demo`, `機密`, `內部`, `草稿`, `樣本`, `樣品`, `複製品`, `浮水印`, `水印`, `僅供參考`
*   **內部圖片代號 (Image XObject)**：`watermark`, `wm`, `stamp`, `logo`, `bg`, `background`, `sign`, `signature`, `shuiyin`
*   **ExtGState (半透明度)**：`watermark`, `wm`, `trans`, `opacity`, `shuiyin`
*   **OCG (圖層名稱)**：`watermark`, `wm`, `layer`, `stamp`, `print`, `overlay`, `shuiyin`, `浮水印`, `水印`

### 5. 密碼安全機制

*   **跨檔案密碼安全沿用**：前次成功解密的密碼暫存於運行期記憶體（不落地，禁止存入 `localStorage`）。新上傳加密 PDF 時會於背景自動嘗試解密，失敗時再行詢問。網頁重整或關閉後即自動徹底清除。


## 🛠️ 使用技術

| 套件 | 用途 |
|------|------|
| [pdf-lib](https://pdf-lib.js.org/) | PDF 結構解析與重構 |
| [qpdf-wasm](https://github.com/nicowillis/qpdf-wasm) | PDF 加密權限解除 |

## 🚀 離線使用與可攜性

本專案採用 **「單頁應用程式 (SPA)」** 架構，所有 CSS 樣式與 JavaScript 邏輯皆內嵌於單一 `index.html` 中，具備良好的可攜性：

- **直接開啟**：在檔案總管中雙擊 `index.html`，即可在任何現代瀏覽器（Chrome, Edge, Firefox, Safari 等）中執行。
- **便於傳播**：可將此單一 HTML 檔案發送給同事或儲存在隨身碟中。
- **離線限制**：處理無加密 PDF 時可完全離線運作；若需解除密碼或權限限制，首次使用時需連線以下載 `qpdf-wasm` 引擎（約 1.8 MB），之後由瀏覽器快取。

## ⚠️ 免責聲明

開始使用前，請詳閱以下說明：

1. **相容性限制**：由於各 PDF 文件之製作規格與標準不同，本工具無法保證適用於所有檔案，部分加密或特殊排版之文件可能無法完整處理。

2. **備份原始檔案**：移除浮水印會修改 PDF 內部結構，處理前請先備份原始檔案，以避免資料遺失。

3. **合法使用授權**：請確認您擁有該文件移除浮水印之合法權利（例如個人學習、合理使用或已取得原作者之授權）。若因移除浮水印衍生任何版權爭議或法律責任，均須由使用者自行承擔。

## 📄 授權條款

本專案採用 **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-Hant)** 授權條款釋出。

使用者可以自由分享或修改本專案，但必須遵循以下條件：

| 條件 | 說明 |
|------|------|
| **姓名標示 (BY)** | 必須提供適當的姓名標示，並附上授權條款連結 |
| **非商業性 (NC)** | 不得將本素材用於商業目的 |
| **相同方式分享 (SA)** | 若改作或再發布，須採用相同授權條款 |

作者：[mfhsieh at github](https://github.com/mfhsieh)

## 📢 訊息揭露

本應用程式的程式碼主要透過 AI 工具（Antigravity IDE）協助生成，並經人工審閱與修改。

## 📦 Release Notes

- v1.1.2 (2026-05-24) 新增開啟密碼解密、檔案權限解除與跨檔案密碼安全沿用；自訂關鍵字新增「回復預設值」並預設啟用 Regex。
- v1.0.0 (2026-05-23) 初始版本發布
