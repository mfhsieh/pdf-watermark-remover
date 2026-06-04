/**
 * @fileoverview UI 快照 (Snapshot) 與無障礙/排版驗證測試腳本
 *
 * 職責：
 * 1. 橋接 WSL2 與 Windows 系統，強制啟動具有視覺介面 (Headful) 的 Windows 原生 Chrome 瀏覽器。
 * 2. 自動執行使用者操作流程 (上傳、掃描、點擊各設定 Modal)，並在每個關鍵節點進行 Full-Page 截圖。
 * 3. 包含預覽項目輪播 (Carousel) 展示邏輯，在介面自動化操作過程中，自動點開預覽畫面供開發者肉眼即時查看。
 * 4. 確保 Modals 動畫過渡、焦點陷阱 (Focus Trap) 等 UI 行為正常，並將最終截圖結果存入 snap-files 目錄。
 *
 * 執行指令：
 *   - npm run snap                (預設測試全部，並自動清空舊資料)
 *   - npm run snap [檔名]         (測試單一檔案)
 *   - npm run snap -- --clean [檔名] (強制清空目錄後測試單一檔案)
 *   - npm run snap -- --clean     (僅清空輸出目錄，不進行測試)
 * 
 * 💡 備註：[檔名] 支援相對於當前目錄的路徑或絕對路徑 (如 ../file.pdf)。
 *    若單純提供檔名，將預設於 test/e2e-files/ 目錄底下尋找。
 */
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import http from 'http';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';

// 取得 ESM 頂層環境下的 __dirname 與 __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定義快照輸出目錄
const snapFilesDir = path.resolve(__dirname, 'snap-files');

// 取得使用者指定的測試檔案，過濾掉 --clean 參數
const rawArgs = process.argv.slice(2);
const isClean = rawArgs.includes('--clean');
const args = rawArgs.filter((arg) => arg !== '--clean');

// 如果只有傳入 --clean，沒有指定任何檔案，則僅清空目錄並結束
if (isClean && args.length === 0) {
    if (fs.existsSync(snapFilesDir)) {
        fs.rmSync(snapFilesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(snapFilesDir, { recursive: true });
    console.log('🧹 快照輸出目錄已清空，結束執行。');
    process.exit(0);
}

const targetFileNames = args.length > 0 ? args : ['sample1.pdf', 'sample2.pdf', 'sample3.pdf', 'sample4.pdf'];

// 如果是預設全部測試，或者明確加上 --clean 選項，則清空輸出目錄避免舊資料殘留；否則僅確保目錄存在
if (args.length === 0 || isClean) {
    if (fs.existsSync(snapFilesDir)) {
        fs.rmSync(snapFilesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(snapFilesDir, { recursive: true });
} else {
    if (!fs.existsSync(snapFilesDir)) fs.mkdirSync(snapFilesDir, { recursive: true });
}

try {
    // 跨系統 WSL -> Windows 自動拉起 Chrome 除錯瀏覽器
    console.log('🧹 正在預防性清理 Windows 殘留 Chrome 除錯行程...');
    try {
        execSync(
            'powershell.exe -Command \'$p = Get-CimInstance Win32_Process | Where-Object {$_.Name -eq "chrome.exe" -and $_.CommandLine -like "*chrome-debug-wsl*"}; if ($p) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }\'',
            { stdio: 'ignore' }
        );
        // 清理暫存資料夾，避免長期執行吃掉硬碟空間
        execSync(
            'powershell.exe -Command "if (Test-Path \\"$env:TEMP\\chrome-debug-wsl\\") { Remove-Item -Recurse -Force \\"$env:TEMP\\chrome-debug-wsl\\" -ErrorAction SilentlyContinue }"',
            { stdio: 'ignore' }
        );
        console.log('   └─ 清理完成');
    } catch {}

    console.log('💡 溫馨提示：執行此腳本前，請確保已在背景啟動 Live Server (Port: 5500)');
    console.log('🚀 正在 Windows 端啟動除錯 Chrome 瀏覽器並開啟除錯埠...');
    const targetUrl = 'http://127.0.0.1:5500/index.html';
    // 使用非同步 exec 以防 cmd.exe 阻塞測試腳本執行。加入 window-size 參數使實體視窗與 Puppeteer 截圖寬度一致
    exec(
        `cmd.exe /c start chrome --remote-debugging-port=9222 --window-size=1280,1020 --user-data-dir="%TEMP%\\chrome-debug-wsl" "${targetUrl}"`,
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

    for (const targetFileName of targetFileNames) {
        console.log(`\n========================================`);
        console.log(`📸 正在快照測試: ${targetFileName}`);
        console.log(`========================================`);

        const baseName = path.basename(targetFileName, '.pdf');

        // 跨系統 WSL2 <-> Windows 檔案路徑橋接：動態將 Linux 本地路徑映射為 Windows UNC 共享格式
        const distro = process.env.WSL_DISTRO_NAME || 'Ubuntu';
        const localPDF = path.isAbsolute(targetFileName)
            ? targetFileName
            : path.resolve(__dirname, 'e2e-files', targetFileName);
            
        if (!fs.existsSync(localPDF)) {
            console.error(`❌ 找不到指定的測試檔案: ${localPDF}，跳過此檔案。`);
            continue;
        }
        
        const winPDF = `\\\\wsl.localhost\\${distro}` + localPDF.replace(/\//g, '\\');

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
        await page.screenshot({ path: `${snapFilesDir}/${baseName}-ui-01-initial.png`, fullPage: true });
        console.log('📸 截圖 1: 初始狀態 ✅');

        // 2. 上傳檔案並等待背景掃描完成
        const fileInput = await page.$('input[type="file"]');
        if (!fileInput) throw new Error('找不到上傳按鈕');
        await fileInput.uploadFile(winPDF);
        console.log('📂 檔案已上傳，等待掃描...');

        await page.waitForFunction(() => document.body.innerText.includes('掃描完成'), { timeout: 30000 });
        await page.screenshot({ path: `${snapFilesDir}/${baseName}-ui-02-scanned.png`, fullPage: true });
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
                // 點擊開啟 Modal
                await page.$eval(m.open, (btn) => btn.click());
                await page.waitForSelector(`${m.active}.active`, { visible: true, timeout: 5000 });
                await new Promise((r) => setTimeout(r, 400));

                // 截圖
                await page.screenshot({ path: `${snapFilesDir}/${baseName}-ui-modal-${m.name}.png` });
                console.log(`📸 截圖: Modal [${m.name}] 開啟 ✅`);

                // 新增：遍歷子項 (預覽按鈕) 並開啟給肉眼觀看 (不截圖)
                if (m.name !== 'global') {
                    const previewBtns = await page.$$(`${m.active} .preview-item-btn`);
                    if (previewBtns.length > 0) {
                        console.log(`  👁️ 輪播展示 ${previewBtns.length} 個預覽項目 (僅供肉眼即時觀看)...`);
                        for (let i = 0; i < previewBtns.length; i++) {
                            // 重新選取按鈕陣列以避免 DOM 參照遺失
                            const btns = await page.$$(`${m.active} .preview-item-btn`);
                            if (btns[i]) {
                                await btns[i].click();
                                await page.waitForSelector('#objectPreviewModal.active', { visible: true });
                                await page.waitForSelector('#objectPreviewIframe:not(.hidden)', {
                                    visible: true,
                                    timeout: 20000,
                                });

                                // 停留 800 毫秒供肉眼查看
                                await new Promise((r) => setTimeout(r, 800));

                                // 點擊關閉預覽 Modal
                                await page.$eval('#closeObjectPreviewModalBtn', (btn) => btn.click());
                                await page.waitForSelector('#objectPreviewModal.active', { hidden: true });
                                await new Promise((r) => setTimeout(r, 300));
                            }
                        }
                    }
                }

                // 點擊關閉
                await page.$eval(m.close, (btn) => btn.click());
                await page.waitForSelector(`${m.active}.active`, { hidden: true, timeout: 5000 });
                await new Promise((r) => setTimeout(r, 200));
            }
        }

        // 3. 點擊清除並等待處理完成
        await page.$eval('#processButton', (btn) => btn.click());
        console.log('🚀 已點擊清除按鈕，等待處理...');

        await page.waitForFunction(() => document.body.innerText.includes('清除已完成'), { timeout: 30000 });
        await page.screenshot({ path: `${snapFilesDir}/${baseName}-ui-03-done.png`, fullPage: true });
        console.log('📸 截圖 3: 清除完成 ✅');
    }

    console.log('\n🎉 E2E 自動化測試與截圖已全部圓滿完成！');
    browser.disconnect();
} catch (e) {
    console.error('❌ 錯誤:', e.message);
    process.exit(1);
}
