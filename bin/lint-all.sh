#!/bin/bash

set -euo pipefail

# ==============================================================================
# 指令稿名稱：lint-all.sh
# 
# 職責：
# 1. 為了突破各檔案獨立檢查時的變數範圍 (Scope) 限制，將 js/ 目錄下
#    所有的核心邏輯檔案依序合併成一個單一的 tmp/all.js 檔案。
# 2. 針對合併後的 tmp/all.js 執行嚴格的靜態分析 (ESLint `no-unused-vars` 規則)，
#    精準捕捉宣告卻未使用的多餘變數或函數，提升程式碼品質與執行效能。
# 3. 自動切換執行目錄至專案根目錄，確保相對路徑抓取正確無誤。
#
# 使用方式：./bin/lint-all.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

mkdir -p tmp

> tmp/all.js
for file in js/polyfill-config.js \
  js/utils.js \
  js/polyfill-config-after.js \
  js/config.js \
  js/state.js \
  js/ui.js \
  js/ui-modals.js \
  js/pdf-scanner.js \
  js/pdf-cleaner.js \
  js/app.js; do
  cat "$file" >> tmp/all.js
  echo "" >> tmp/all.js
done

echo "開始進行全域變數分析 (Unused Variables Check)..."
npx eslint tmp/all.js --rule 'no-unused-vars: error' --rule 'prettier/prettier: off'
echo "✅ 分析通過！無未使用的變數。"