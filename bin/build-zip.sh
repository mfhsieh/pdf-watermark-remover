#!/bin/bash

# 切換到專案根目錄，確保相對路徑正確無誤
cd "$(dirname "$0")/.." || exit 1

# 建立 dist 目錄（如果不存在）
mkdir -p dist

# 嘗試從 package.json 讀取版本號，若無法讀取則使用預設名稱
VERSION=$(node -p "require('./package.json').version" 2>/dev/null)
if [ -n "$VERSION" ]; then
    ZIP_NAME="pdf-watermark-remover-v${VERSION}.zip"
else
    ZIP_NAME="pdf-watermark-remover.zip"
fi

OUTPUT_PATH="dist/$ZIP_NAME"

# 確保移除舊的打包檔，避免重複壓縮或是內容殘留
if [ -f "$OUTPUT_PATH" ]; then
    rm "$OUTPUT_PATH"
fi

echo "開始打包檔案至 $OUTPUT_PATH ..."

# 定義要打包的檔案與資料夾（加入 doc 目錄）
FILES_TO_ZIP="index.html README.md css/ js/ doc/"

# 將指定的檔案與目錄打包進 zip 檔
if command -v zip &> /dev/null; then
    # -r: 遞迴處理目錄, -q: 安靜模式
    zip -r -q "$OUTPUT_PATH" $FILES_TO_ZIP
elif command -v python3 &> /dev/null; then
    echo "未偵測到 zip 指令，改用 Python zipfile 模組..."
    python3 -m zipfile -c "$OUTPUT_PATH" $FILES_TO_ZIP
else
    echo "❌ 打包失敗，請檢查系統是否已安裝 zip 或 python3 指令。"
    exit 1
fi

# 檢查是否打包成功
if [ $? -eq 0 ]; then
    echo "🎉 打包完成！檔案已儲存至: $OUTPUT_PATH"
    # 列出檔案大小
    ls -lh "$OUTPUT_PATH"
else
    echo "❌ 打包失敗。"
    exit 1
fi
