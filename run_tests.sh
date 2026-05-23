#!/bin/bash

# 當任何命令失敗時立即停止，以防無效等待
set -e

echo "[TEST RUNNER] 正在啟動本地靜態伺服器 (Port 8085) 供載入測試元件..."
# 使用獨立 Process 在後台起 http.server
python3 -m http.server 8085 > /dev/null 2>&1 &
HTTP_PID=$!

# 確保退出時徹底清理所有背景工作與臨時進程
cleanup() {
  echo "[TEST RUNNER] 正在清理本地伺服器與無頭瀏覽器進程..."
  kill $HTTP_PID 2>/dev/null || true
  if [ ! -z "$CHROME_PID" ]; then
    kill $CHROME_PID 2>/dev/null || true
  fi
}
trap cleanup EXIT

# 等待靜態伺服器初始化
sleep 1.0

echo "[TEST RUNNER] 正在啟動 Headless Chrome 靜默執行 JS 清理策略測試..."
# 啟動 Headless Chrome，使其在背景打開網頁，並傳入報告伺服器的埠號 8086
google-chrome --headless --disable-gpu --no-sandbox --disable-software-rasterizer http://localhost:8085/test.html?reportPort=8086 > /dev/null 2>&1 &
CHROME_PID=$!

echo "[TEST RUNNER] 正在啟動事件驅動型測試結果收集伺服器 (Port 8086)..."
# 啟動微型 Python 伺服器以阻斷等待 Chrome 的測試完成回報
python3 -c "
import sys
import json
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

class ReportHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # 靜音內建的請求日誌，保持 Terminal 輸出極致乾淨與專注
        return

    def do_GET(self):
        # 回覆瀏覽器跨網域請求與 OK 狀態碼
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b'OK')
        
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/report':
            query = urllib.parse.parse_qs(parsed.query)
            data_str = query.get('data', [None])[0]
            if data_str:
                report = json.loads(data_str)
                print_report(report)
                # 依測試通過與否，返回對應的 POSIX 退出狀態碼
                failed = int(report.get('failed', 0))
                sys.exit(0 if failed == 0 else 1)

def print_report(report):
    passed = report.get('passed', 0)
    failed = report.get('failed', 0)
    total_time = report.get('totalTime', 0)
    
    print('\n' + '='*64)
    print('          PDF WATERMARK REMOVER - AUTOMATED TEST SUITE        ')
    print('='*64)
    print(f' 🟢 通過項目 (PASS):  \033[92m{passed}\033[0m')
    print(f' 🔴 失敗項目 (FAIL):  \033[91m{failed}\033[0m')
    print(f' ⏱️  自動化總耗時:     \033[96m{total_time}ms\033[0m')
    print('='*64)
    
    for case in report.get('cases', []):
        title = case.get('title', '未命名測試')
        pass_status = case.get('pass', False)
        metrics = case.get('metrics', [])
        
        if pass_status:
            print(f' \033[92m[PASS]\033[0m {title}')
            for m in metrics:
                print(f'        {m}')
        else:
            print(f' \033[91m[FAIL]\033[0m {title}')
            for m in metrics:
                print(f'        {m}')
    print('='*64 + '\n')
    
    if failed == 0 and passed > 0:
        print('\033[92m🎉 完美通過！所有測試案例皆已 100% PASS！這完美證明了程式宣告順序物理重排無任何邏輯破壞！\033[0m\n')
    else:
        print('\033[91m❌ 警告：有測試案例失敗，請檢視控制台日誌排除錯誤。\033[0m\n')

if __name__ == '__main__':
    try:
        server = HTTPServer(('localhost', 8086), ReportHandler)
        server.serve_forever()
    except SystemExit as se:
        # 捕捉退出狀態碼並傳回作業系統
        sys.exit(se.code)
    except KeyboardInterrupt:
        sys.exit(1)
"

# 測試完成，cleanup 會自動清理所有背景靜態伺服器
echo "[TEST RUNNER] 測試套件順利關閉。"
