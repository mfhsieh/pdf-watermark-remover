---
name: review-project-files
description: 執行全面性的專案程式碼審查 (Code Review)，涵蓋 html, js, css, mjs, sh, md, json 等檔案格式。當使用者提到「code review」、「程式碼審查」、「審查專案」、「檢查專案品質」、「掃描安全漏洞」、「review 我的程式」時，務必使用此 skill。即使使用者只說「幫我看看這個專案」或「有沒有問題」，只要涉及多個程式碼檔案的整體檢查，也應觸發。
---

# 專案檔案全面審查 (Comprehensive Project Files Review)

對專案內的多種文字與程式碼檔案進行全面的品質、安全與架構審查。

## 審查範圍

目標副檔名：`.html`, `.css`, `.js`, `.mjs`, `.sh`, `.json`, `.md`

**排除目錄**：`.git/`、`node_modules/`、`dist/`、`tmp/`

---

## 執行流程

### Step 1：檔案盤點

列出所有目標檔案：

```bash
find . \
  -not \( -path './.git' -prune \) \
  -not \( -path './node_modules' -prune \) \
  -not \( -path './dist' -prune \) \
  -not \( -path './tmp' -prune \) \
  -type f \( \
    -name "*.html" -o -name "*.css" -o -name "*.js" \
    -o -name "*.mjs" -o -name "*.sh" -o -name "*.json" \
    -o -name "*.md" \
  \)
```

列出檔案清單後，向使用者說明即將審查的檔案數量與範圍。

### Step 2：逐一審查

逐一檢視每個檔案，針對以下面向分析：

| 面向 | 檢查重點 |
|------|----------|
| **程式碼品質** | 邏輯清晰度、DRY 原則、命名語意 |
| **效能與架構** | 效能瓶頸、過胖的 CSS 選擇器、全域變數污染、記憶體洩漏風險 |
| **安全性** | 寫死的機敏資訊（API key、密碼）、XSS 風險、未過濾的使用者輸入、`eval()` 濫用 |
| **無障礙 (a11y)** | 語意化 HTML 標籤、`aria` 屬性、鍵盤可操作性、`alt` 文字 |
| **穩定性** | Shell script 的 `set -e` / `set -u`、錯誤處理、JSON 格式正確性 |
| **文件完整性** | Markdown 說明是否與程式碼同步更新 |

### Step 3：產出審查報告

審查完成後，產出結構化報告，包含：

1. **嚴重問題（Critical）** — 安全漏洞、會導致錯誤的 bug，需優先處理
2. **中等問題（Warning）** — 效能疑慮、不良實踐，建議修正
3. **建議改善（Info）** — 程式碼品質、可讀性、文件完整性
4. **整體評估** — 專案健康度摘要與優先處理順序建議

每個問題應包含：
- 所在檔案與行號（若可取得）
- 問題描述
- 具體的修正建議或範例

---

## 注意事項

- 若發現嚴重安全漏洞，立即在報告最前面以醒目方式標示
