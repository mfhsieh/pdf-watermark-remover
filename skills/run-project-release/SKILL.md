---
name: run-project-release
description: 執行專案的新版本發佈流程，自動更新版本號、README、產出文件、跑測試與打包
---

# 📦 版本更新標準作業流程 (Release SOP)

> **給 AI 助手的指示 (Agent Instructions)**：
> 當使用者要求「發佈新版本」或「升級版本號」時，請嚴格按照以下步驟執行，確保專案一致性。

## 執行步驟

1. **更新專案版本號**
   - 執行指令 `npm --no-git-tag-version version <新版本號>`（例如 `npm --no-git-tag-version version 2.3.0`）。此指令會自動且安全地同步更新 `package.json` 與 `package-lock.json` 中的 version 欄位。

2. **更新 index.html**
   - **HTML 頁面標題版號**：更新 `index.html` 中 `<header>` 內的 `<span class="version-badge">vX.X.X</span>` 為最新版號。

3. **更新 README.md**
   - **版本徽章 (Badge)**：更新頂部 Version Badge 的 URL 與顯示文字（例如 `badge/version-2.3.0-blue.svg`）。
   - **下載連結**：更新頂部 `[→ 下載個人使用版本]` 的 ZIP 檔名（例如 `dist/pdf-watermark-remover-v2.3.0.zip`）。
   - **Release Notes**：在 `## 📦 Release Notes` 區塊最上方，加入新版本的標題與更新日期。請先審閱近期的對話紀錄或程式碼變更，自動歸納出本次改版的重點，再寫入 Release Notes。

4. **執行 CI/CD 檢查與打包管線 (Fail-fast)**
   - 此管線包含以下循序漸進的工作：
     * `npm run format`: 先根據 Prettier 規則自動排版 HTML/CSS/JS 程式碼。
     * `npm run lint`: 再執行靜態語法與潛在錯誤分析，確保程式碼品質 (Fail-fast)。
     * `npm run test`: 執行 E2E 端到端測試，動態驗證浮水印是否能被成功清除且物件未毀損。
     * `npm run docs`: 接著讀取排版與驗證無誤的原始碼，重新生成 `doc/API_Reference.md` 確保文件為最新狀態。
     * `./bin/build-zip.sh`: 解析版號並將所有相關資源打包至 `dist/` 資料夾。
   - 請將指令串聯為單一管線執行，確保一旦有錯誤便立即停止：
     `npm run format && npm run lint && npm run test && npm run docs && ./bin/build-zip.sh`
   - 如果此管線指令失敗，請立即中斷發佈流程，並向使用者回報錯誤日誌以利修復。

## 檢查清單 (Checklist)
- [ ] `package.json` 與 `package-lock.json` 版本號已同步更新
- [ ] `index.html` 標題版號已更新
- [ ] `README.md` Badge 與 下載連結已更新
- [ ] `README.md` Release Notes 已填寫
- [ ] 格式化與靜態分析 (Lint/Format) 均通過
- [ ] E2E 測試 (Test) 均通過
- [ ] API 文件 (Docs) 已重新生成
- [ ] `dist/` 內已產生最新版本的 ZIP 檔
