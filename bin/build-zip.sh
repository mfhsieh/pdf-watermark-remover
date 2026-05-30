#!/bin/bash

# 切換到專案根目錄，確保相對路徑正確無誤
cd "$(dirname "$0")/.." || exit 1

# 建立 dist 目錄（如果不存在）
mkdir -p dist

# 定義輸出的 zip 檔案名稱，可加入時間戳記或是版本號
ZIP_NAME="pdf-watermark-remover.zip"
OUTPUT_PATH="dist/$ZIP_NAME"

# 確保移除舊的打包檔，避免重複壓縮或是內容殘留
if [ -f "$OUTPUT_PATH" ]; then
    rm "$OUTPUT_PATH"
fi

echo "開始打包檔案至 $OUTPUT_PATH ..."

# 將指定的檔案與目錄打包進 zip 檔
if command -v zip &> /dev/null; then
    # -r: 遞迴處理目錄, -q: 安靜模式
    zip -r -q "$OUTPUT_PATH" index.html README.md css/ js/
elif command -v python3 &> /dev/null; then
    echo "未偵測到 zip 指令，改用 Python zipfile 模組..."
    python3 -m zipfile -c "$OUTPUT_PATH" index.html README.md css/ js/
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
