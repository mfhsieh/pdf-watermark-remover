---
name: review-project-files
description: 執行專案 Code Review。提及「code review」、「審查專案」、「檢查專案品質/安全」或要求「看看專案有無問題」時觸發。
---

# 專案 Code Review 指南

## 1. 檔案盤點
**目標**: `.html`, `.css`, `.js`, `.mjs`, `.sh`, `.json`, `.md`
**排除**: `.git/`, `node_modules/`, `dist/`, `tmp/`
```bash
find . -type d \( -name .git -o -name node_modules -o -name dist -o -name tmp \) -prune -o -type f -print | grep -E '\.(html|css|m?js|sh|json|md)$'
```
*(盤點後請先告知使用者預計審查的檔案清單與數量)*

## 2. 核心審查面向
- **自動化靜態分析**：先執行 `./bin/lint-all.sh`，確保沒有殘留的未使用變數 (Unused Variables) 或是嚴重語法問題。
- **安全性 (最高優先)**：XSS 風險、未過濾輸入、`eval()` 濫用、硬編碼機敏資訊。
- **品質與架構**：邏輯清晰度、DRY 原則、命名語意、效能瓶頸、全域變數污染。
- **穩定性與其他**：錯誤處理、a11y (語意化/aria)、Shell 腳本 (`set -e`)、文件同步。

## 3. 結構化報告產出
報告須包含以下層級，並針對每項提供**檔案行號、問題描述與具體修正建議**：
1. **Critical (嚴重)**：安全漏洞、崩潰 Bug（若有請於報告頂部醒目標示）。
2. **Warning (中等)**：效能疑慮、不良實踐。
3. **Info (建議)**：可讀性、文件完整性。
4. **總結評估**：專案健康度摘要與修復順序建議。
