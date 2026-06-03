---
name: run-project-release
description: 執行專案發佈流程。當要求「發佈新版」或「升級版本」時觸發，涵蓋版號更新、文件更新、測試與打包。
---

# 📦 專案發佈 SOP

## 1. 更新版本號
建議先執行安裝以確保環境與 `package-lock.json` 同步，再更新版號：
```bash
npm install
npm --no-git-tag-version version <新版本號>
```

## 2. 更新檔案內容
執行 `npm version` 時，系統會自動呼叫 `bin/sync-version.sh` 同步更新 `index.html` 的 UI 標籤，以及 `README.md` 頂部的 Version Badge 與下載 ZIP 檔名。
**您只需手動修改以下部分：**
- **`README.md`**: 於 `## 📦 Release Notes` 頂部加入新版標題、日期，並根據近期變更**自動歸納改版重點**。

## 3. 執行 CI/CD 管線
一鍵執行格式化、靜態分析 (含全域變數檢查)、E2E核心測試、預覽抓取測試、UI 快照測試、文件生成與打包：
```bash
npm run format && npm run lint && npm run e2e && npm run e2e-preview && npm run snap && npm run docs && ./bin/build-zip.sh
```
> ⚠️ **Fail-fast 原則**：若管線中途失敗，**立即中斷發佈流程**並回報錯誤以利修復。

## 4. 最終檢查清單
- [ ] `package.json` / `package-lock.json` 版本號已更新
- [ ] `index.html` 標記已更新
- [ ] `README.md` 的 Release Notes 已撰寫
- [ ] CI/CD 管線成功執行，且 `dist/` 已產生新版 ZIP
