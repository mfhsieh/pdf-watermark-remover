import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import http from 'http';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';

// 取得 ESM 頂層環境下的 __dirname 與 __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定義快照輸出目錄，並確保其存在
const snapFilesDir = path.resolve(__dirname, 'snap-files');
if (!fs.existsSync(snapFilesDir)) fs.mkdirSync(snapFilesDir, { recursive: true });

// 跨系統 WSL2 <-> Windows 檔案路徑橋接：動態將 Linux 本地路徑映射為 Windows UNC 共享格式
// 自動取得當前 WSL 發行版名稱 (如 Ubuntu, Debian 等)，解決名稱硬編碼問題
const distro = process.env.WSL_DISTRO_NAME || 'Ubuntu';
const localPDF = path.resolve(__dirname, 'e2e-files/sample1.pdf');
const winPDF = `\\\\wsl.localhost\\${distro}` + localPDF.replace(/\//g, '\\');

try {
    // 跨系統 WSL -> Windows 自動拉起 Chrome 除錯瀏覽器
    console.log('🧹 正在預防性清理 Windows 殘留 Chrome 除錯行程...');
    try {
        execSync(
            'powershell.exe -Command \'$p = Get-CimInstance Win32_Process | Where-Object {$_.Name -eq "chrome.exe" -and $_.CommandLine -like "*chrome-debug-wsl*"}; if ($p) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }\'',
            { stdio: 'ignore' }
        );
        console.log('   └─ 清理完成');
    } catch { }

    console.log('🚀 正在 Windows 端啟動除錯 Chrome 瀏覽器並開啟除錯埠...');
    const targetUrl = 'http://127.0.0.1:5500/index.html';
    // 使用非同步 exec 以防 cmd.exe 阻塞測試腳本執行
    exec(
        `cmd.exe /c start chrome --remote-debugging-port=9222 --user-data-dir="%TEMP%\\chrome-debug-wsl" "${targetUrl}"`,
        (err) => {
            if (err) console.debug('啟動 Chrome 警告（可忽略）:', err.message);
        }
    );

    // 依據 SKILL 規範，必須使用 http 模組獲取 ws endpoint，避免 Puppeteer 內部 fetch 的雙堆疊異常
    let data;
    for (let i = 0; i < 5; i++) {
        try {
            data = await new Promise((res, rej) => {
                http.get('http://127.0.0.1:9222/json/version', (r) => {
                    let d = '';
                    r.on('data', (c) => (d += c));
                    r.on('end', () => res(JSON.parse(d)));
                }).on('error', rej);
            });
            break;
        } catch {
            console.log(`⏳ 等待 Chrome 除錯埠開啟中... (${i + 1}/5)`);
            await new Promise((r) => setTimeout(r, 1000));
        }
    }

    if (!data) throw new Error('無法連接至 Chrome 除錯埠');
    const browser = await puppeteer.connect({ browserWSEndpoint: data.webSocketDebuggerUrl, defaultViewport: null });
    const [page] = await browser.pages();

    if (!page.url().includes('5500')) {
        console.log('🌐 導航至 http://127.0.0.1:5500/index.html ...');
        await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'networkidle0' });
    } else {
        console.log('🌐 已連接至現有的 5500 頁面');
    }

    await page.setCacheEnabled(false);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1280, height: 900 });

    // 1. 初始狀態截圖
    await page.screenshot({ path: `${snapFilesDir}/ui-01-initial.png`, fullPage: true });
    console.log('📸 截圖 1: 初始狀態 ✅');

    // 2. 上傳檔案並等待背景掃描完成
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error('找不到上傳按鈕');
    await fileInput.uploadFile(winPDF);
    console.log('📂 檔案已上傳，等待掃描...');

    await page.waitForFunction(() => document.body.innerText.includes('掃描完成'), { timeout: 30000 });
    await page.screenshot({ path: `${snapFilesDir}/ui-02-scanned.png`, fullPage: true });
    console.log('📸 截圖 2: 掃描完成 ✅');

    // 2.5 開啟各個設定彈窗 (Modals) 並截圖
    const modalsToTest = [
        {
            name: 'global',
            open: '#openGlobalKeywordsModalBtn',
            close: '#closeGlobalKeywordsModalBtn',
            active: '#globalKeywordsModal',
        },
        {
            name: 'form-xobject',
            open: '#openFormXObjectKeywordsModalBtn',
            close: '#closeFormXObjectKeywordsModalBtn',
            active: '#formXObjectKeywordsModal',
        },
        {
            name: 'annotations',
            open: '#openAnnotsSettingsModalBtn',
            close: '#closeAnnotsSettingsModalBtn',
            active: '#annotsSettingsModal',
        },
        {
            name: 'direct-content',
            open: '#openTriggerWordsModalBtn',
            close: '#closeTriggerWordsModalBtn',
            active: '#triggerWordsModal',
        },
        {
            name: 'image-xobject',
            open: '#openImageKeywordsModalBtn',
            close: '#closeImageKeywordsModalBtn',
            active: '#imageKeywordsModal',
        },
        {
            name: 'extgstate',
            open: '#openExtGStateKeywordsModalBtn',
            close: '#closeExtGStateKeywordsModalBtn',
            active: '#extGStateKeywordsModal',
        },
        {
            name: 'ocg',
            open: '#openOCGKeywordsModalBtn',
            close: '#closeOCGKeywordsModalBtn',
            active: '#ocgKeywordsModal',
        },
    ];

    for (const m of modalsToTest) {
        const openBtn = await page.$(m.open);
        if (openBtn) {
            // 點擊開啟 Modal (使用 DOM 點擊防範 CSS 動態過渡時半透明遮罩導致不可點擊的 Bug)
            await page.$eval(m.open, (btn) => btn.click());
            // 等待 Modal active 樣式出現且可見
            await page.waitForSelector(`${m.active}.active`, { visible: true, timeout: 5000 });
            // 稍微等待 CSS Transition 平滑過渡完畢 (避免動態縮放殘影)
            await new Promise((r) => setTimeout(r, 400));

            // 截圖
            await page.screenshot({ path: `${snapFilesDir}/ui-modal-${m.name}.png` });
            console.log(`📸 截圖: Modal [${m.name}] 開啟 ✅`);

            // 點擊關閉 (同樣使用 DOM 點擊)
            await page.$eval(m.close, (btn) => btn.click());
            // 等待 Modal 隱藏
            await page.waitForSelector(`${m.active}.active`, { hidden: true, timeout: 5000 });
            // 等待關閉過渡動畫
            await new Promise((r) => setTimeout(r, 200));
        }
    }

    // 3. 點擊清除並等待處理完成
    await page.$eval('#processButton', (btn) => btn.click());
    console.log('🚀 已點擊清除按鈕，等待處理...');

    await page.waitForFunction(() => document.body.innerText.includes('清除已完成'), { timeout: 30000 });
    await page.screenshot({ path: `${snapFilesDir}/ui-03-done.png`, fullPage: true });
    console.log('📸 截圖 3: 清除完成 ✅');

    console.log('\n🎉 E2E 自動化測試與截圖已全部圓滿完成！');
    browser.disconnect();
} catch (e) {
    console.error('❌ 錯誤:', e.message);
    process.exit(1);
}
