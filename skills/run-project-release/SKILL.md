---
name: run-project-release
description: 執行專案發佈流程。當要求「發佈新版」或「升級版本」時觸發，涵蓋版號更新、文件更新、測試與打包。
---

# 📦 專案發佈 SOP

## 1. 更新版本號
同步更新 `package.json` 與 `package-lock.json`：
```bash
npm --no-git-tag-version version <新版本號>
```

## 2. 更新檔案內容
修改以下檔案以對應新版號：
- **`index.html`**: 更新 `<header>` 內的 `<span class="version-badge">vX.X.X</span>`。
- **`README.md`**: 
  1. 更新頂部 Version Badge 的版號字串。
  2. 更新頂部 `[→ 下載個人使用版本]` 的 ZIP 檔名（`dist/pdf-watermark-remover-vX.X.X.zip`）。
  3. 於 `## 📦 Release Notes` 頂部加入新版標題、日期，並根據近期變更**自動歸納改版重點**。

## 3. 執行 CI/CD 管線
一鍵執行格式化、靜態分析、E2E 測試、文件生成與打包：
```bash
npm run format && npm run lint && npm run test && npm run docs && ./bin/build-zip.sh
```
> ⚠️ **Fail-fast 原則**：若管線中途失敗，**立即中斷發佈流程**並回報錯誤以利修復。

## 4. 最終檢查清單
- [ ] `package.json` / `package-lock.json` 版本號已更新
- [ ] `index.html` 標記已更新
- [ ] `README.md` (Badge、下載連結、Release Notes) 已更新
- [ ] CI/CD 管線成功執行，且 `dist/` 已產生新版 ZIP
