import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';

// 取得 ESM 頂層環境下的 __dirname 與 __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定義快照輸出目錄，並確保其存在
const snapFilesDir = path.resolve(__dirname, 'snap-files');
if (!fs.existsSync(snapFilesDir)) fs.mkdirSync(snapFilesDir, { recursive: true });

// 跨系統 WSL2 <-> Windows 檔案路徑橋接：動態將 Linux 本地路徑映射為 Windows UNC 共享格式
const localPDF = path.resolve(__dirname, 'e2e-files/sample1.pdf');
const winPDF = '\\\\wsl.localhost\\Ubuntu' + localPDF.replace(/\//g, '\\');

try {
    // 使用 browserURL 直接連接現有 Chrome 實例，省去手動獲取 WebSocket Debugger URL 的冗長代碼
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const targets = await browser.targets();
    let pageTarget = targets.find((t) => t.type() === 'page' && t.url().includes('5500'));
    let page;

    if (pageTarget) {
        page = await pageTarget.asPage();
        console.log('🌐 已連接至現有的 5500 頁面');
    } else {
        page = await browser.newPage();
        console.log('🌐 未找到已開啟頁面，正開新分頁並導航至 http://127.0.0.1:5500/index.html ...');
        await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'networkidle0' });
    }

    await page.setCacheEnabled(false);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1280, height: 900 });

    // 1. 初始狀態截圖
    await page.screenshot({ path: `${snapFilesDir}/ui-01-initial.png` });
    console.log('📸 截圖 1: 初始狀態 ✅');

    // 2. 上傳檔案並等待背景掃描完成
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error('找不到上傳按鈕');
    await fileInput.uploadFile(winPDF);
    console.log('📂 檔案已上傳，等待掃描...');

    await page.waitForFunction(() => document.body.innerText.includes('掃描完成'), { timeout: 30000 });
    await page.screenshot({ path: `${snapFilesDir}/ui-02-scanned.png` });
    console.log('📸 截圖 2: 掃描完成 ✅');

    // 3. 點擊清除並等待處理完成
    await page.$eval('#processButton', (btn) => btn.click());
    console.log('🚀 已點擊清除按鈕，等待處理...');

    await page.waitForFunction(() => document.body.innerText.includes('清除已完成'), { timeout: 30000 });
    await page.screenshot({ path: `${snapFilesDir}/ui-03-done.png` });
    await page.screenshot({ path: `${snapFilesDir}/ui-04-final.png`, fullPage: true });
    console.log('📸 截圖 3 & 4: 清除完成 ✅');

    console.log('\n🎉 E2E 自動化測試與截圖已全部圓滿完成！');
    browser.disconnect();
} catch (e) {
    console.error('❌ 錯誤:', e.message);
    process.exit(1);
}
