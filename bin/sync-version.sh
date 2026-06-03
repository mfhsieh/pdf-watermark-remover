#!/bin/bash

set -euo pipefail

# ==============================================================================
# 指令稿名稱：sync-version.sh
# 
# 職責：
# 1. 作為 NPM Version 的自動化 Hook 腳本 (由 package.json 的 version script 觸發)。
# 2. 自動從 package.json 提取最新的版本號，並利用正規表示式 (sed) 同步更新 
#    index.html 中的版號標籤 (Version Badge)。
# 3. 同步更新 README.md 中的「下載連結檔名」以及「Shields.io 版本徽章」。
#    確保所有文件與介面的版本號永遠與 package.json 保持一致，減少人工遺漏。
#
# 使用方式：由 `npm version <major|minor|patch>` 自動觸發
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Read version from package.json
VERSION=$(node -p "require('./package.json').version" 2>/dev/null)

if [ -z "$VERSION" ]; then
  echo "Failed to read version from package.json"
  exit 1
fi

echo "Syncing version v$VERSION to index.html..."

# Update index.html version-badge
sed -i -E "s/<span class=\"version-badge\">v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?<\/span>/<span class=\"version-badge\">v$VERSION<\/span>/g" index.html

# Update README.md download link
sed -i -E "s/dist\/pdf-watermark-remover-v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?\.zip/dist\/pdf-watermark-remover-v$VERSION\.zip/g" README.md

# Update README.md shields.io badge
sed -i -E "s/badge\/version-[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?-blue/badge\/version-$VERSION-blue/g" README.md

echo "Version synced successfully."
