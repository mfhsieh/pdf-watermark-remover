/**
 * @fileoverview 端到端 (E2E) 預覽圖截取腳本
 *
 * 職責：
 * 1. 啟動無頭瀏覽器，自動化上傳 PDF 並等待背景掃描引擎完成。
 * 2. 自動遍歷並點擊六大策略 (FormXObject, Annotation 等) 的浮水印設定視窗。
 * 3. 利用 Fetch API 將隱藏 iframe 中的 Blob URL (物件預覽圖) 取出，並轉存為本地端 PDF，
 *    藉此迴避原生 PDFium 外掛進程導致 Puppeteer 截圖變黑的問題。
 * 4. 支援批次輪詢測試多份樣本 (預設 sample1 到 sample5)。
 *
 * 執行指令：
 *   - npm run e2e-preview                (預設測試全部，並自動清空舊資料)
 *   - npm run e2e-preview [檔名]         (測試單一檔案)
 *   - npm run e2e-preview -- --clean [檔名] (強制清空目錄後測試單一檔案)
 *   - npm run e2e-preview -- --clean     (僅清空輸出目錄，不進行測試)
 *
 * 💡 備註：[檔名] 支援相對於當前目錄的路徑或絕對路徑 (如 ../file.pdf)。
 *    若單純提供檔名，將預設於 test/e2e-files/ 目錄底下尋找。
 */
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 取得目前檔案的絕對路徑與目錄 (ES 模組標準寫法)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定義測試檔案目錄與輸出預覽檔的目錄
const testFilesDir = path.resolve(__dirname, 'e2e-files');
const previewsDir = path.resolve(testFilesDir, 'previews');
const indexUrl = 'file://' + path.resolve(__dirname, '../index.html');

// 取得使用者指定的測試檔案，過濾掉 --clean 參數
const rawArgs = process.argv.slice(2);
const isClean = rawArgs.includes('--clean');
const args = rawArgs.filter((arg) => arg !== '--clean');

// 如果只有傳入 --clean，沒有指定任何檔案，則僅清空目錄並結束
if (isClean && args.length === 0) {
    if (fs.existsSync(previewsDir)) {
        fs.rmSync(previewsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(previewsDir, { recursive: true });
    console.log('🧹 預覽輸出目錄已清空，結束執行。');
    process.exit(0);
}

const targetFileNames =
    args.length > 0 ? args : ['sample1.pdf', 'sample2.pdf', 'sample3.pdf', 'sample4.pdf', 'sample5.pdf'];

// 如果是預設全部測試，或者明確加上 --clean 選項，則清空輸出目錄避免舊資料殘留；否則僅確保目錄存在
if (args.length === 0 || isClean) {
    if (fs.existsSync(previewsDir)) {
        fs.rmSync(previewsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(previewsDir, { recursive: true });
} else {
    if (!fs.existsSync(previewsDir)) fs.mkdirSync(previewsDir, { recursive: true });
}

// 定義 7 大策略的 Modal 選擇器資訊
const strategies = [
    {
        rowId: '#optionRowFormXObject',
        openBtn: '#openFormXObjectKeywordsModalBtn',
        closeBtn: '#closeFormXObjectKeywordsModalBtn',
        modalId: '#formXObjectKeywordsModal',
        name: 'FormXObject',
    },
    {
        rowId: '#optionRowImageXObject',
        openBtn: '#openImageKeywordsModalBtn',
        closeBtn: '#closeImageKeywordsModalBtn',
        modalId: '#imageKeywordsModal',
        name: 'ImageXObject',
    },
    {
        rowId: '#optionRowAnnotations',
        openBtn: '#openAnnotsSettingsModalBtn',
        closeBtn: '#closeAnnotsSettingsModalBtn',
        modalId: '#annotsSettingsModal',
        name: 'Annotation',
    },
    {
        rowId: '#optionRowDirectContent',
        openBtn: '#openTriggerWordsModalBtn',
        closeBtn: '#closeTriggerWordsModalBtn',
        modalId: '#triggerWordsModal',
        name: 'DirectContent',
    },
    {
        rowId: '#optionRowTextBlocks',
        openBtn: '#openTextBlocksModalBtn',
        closeBtn: '#closeTextBlocksModalBtn',
        modalId: '#textBlocksModal',
        name: 'TextBlocks',
    },
    {
        rowId: '#optionRowOCG',
        openBtn: '#openOCGKeywordsModalBtn',
        closeBtn: '#closeOCGKeywordsModalBtn',
        modalId: '#ocgKeywordsModal',
        name: 'OCG',
    },
    {
        rowId: '#optionRowExtGState',
        openBtn: '#openExtGStateKeywordsModalBtn',
        closeBtn: '#closeExtGStateKeywordsModalBtn',
        modalId: '#extGStateKeywordsModal',
        name: 'ExtGState',
    },
];

console.log(`🚀 開始執行預覽抓取測試：即將測試 ${targetFileNames.length} 個檔案`);
let browser;

try {
    // 啟動 Puppeteer
    browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const targetFileName of targetFileNames) {
        const targetFilePath = path.isAbsolute(targetFileName)
            ? targetFileName
            : path.resolve(testFilesDir, targetFileName);

        if (!fs.existsSync(targetFilePath)) {
            console.error(`❌ 找不到指定的測試檔案: ${targetFilePath}，跳過此檔案。`);
            continue;
        }

        console.log(`\n========================================`);
        console.log(`📄 正在測試: ${targetFileName}`);
        console.log(`========================================`);

        const page = await browser.newPage();
        page.on('console', (msg) => {
            // 過濾掉不必要的資訊，只印出錯誤或警告
            if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
        });

        // 前往本地端 HTML
        await page.goto(indexUrl, { waitUntil: 'networkidle0' });

        // 上傳檔案
        console.log('⏳ 正在上傳並進行背景掃描...');
        const fileInput = await page.$('#fileInput');
        await fileInput.uploadFile(targetFilePath);

        // 等待掃描完成 (確認 processButton 出現)
        await page.waitForFunction(
            () => {
                const btn = document.getElementById('processButton');
                return btn && !btn.classList.contains('hidden') && !btn.disabled;
            },
            { timeout: 30000 }
        );
        console.log('✅ 掃描完成！準備開始截取各策略預覽...\n');

        // 逐一檢查六個策略
        for (const st of strategies) {
            // 1. 判斷該策略是否有偵測到物件 (如果沒偵測到，row 會被加上 hidden)
            const isRowHidden = await page.$eval(st.rowId, (el) => el.classList.contains('hidden'));
            if (isRowHidden) {
                console.log(`[${st.name}] 📭 無偵測到項目，跳過。`);
                continue;
            }

            // 2. 點擊開啟 Modal
            await page.click(st.openBtn);
            await page.waitForSelector(`${st.modalId}.active`, { visible: true });
            await new Promise((r) => setTimeout(r, 400)); // 等待過渡動畫

            // 3. 尋找該 Modal 內所有的預覽按鈕
            const previewBtns = await page.$$(`${st.modalId} .preview-item-btn`);
            console.log(`[${st.name}] 🔍 偵測到 ${previewBtns.length} 個可預覽項目...`);

            for (let i = 0; i < previewBtns.length; i++) {
                // 每次迴圈重新抓取按鈕陣列，避免 DOM 參照失效
                const btns = await page.$$(`${st.modalId} .preview-item-btn`);
                const btn = btns[i];

                // 點擊預覽
                await btn.click();

                // 等待預覽 Modal 開啟，並等待 spinner 消失 & iframe 出現
                await page.waitForSelector('#objectPreviewModal.active', { visible: true });
                await page.waitForSelector('#objectPreviewIframe:not(.hidden)', { visible: true, timeout: 20000 });

                // 取出 iframe 的 blob URL
                const iframeSrc = await page.$eval('#objectPreviewIframe', (el) => el.src);

                if (iframeSrc && iframeSrc.startsWith('blob:')) {
                    // ★ 核心技巧：在瀏覽器內使用 fetch 取出 Blob，轉為 Base64 後回傳給 Node.js
                    const base64Data = await page.evaluate(async (blobUrl) => {
                        const response = await fetch(blobUrl);
                        const blob = await response.blob();
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                // result 為 'data:application/pdf;base64,JVBERi...'，只需後半段
                                resolve(reader.result.split(',')[1]);
                            };
                            reader.readAsDataURL(blob);
                        });
                    }, iframeSrc);

                    // 寫入本地目錄
                    const outFilename = `${path.basename(targetFileName, '.pdf')}_${st.name}_Preview-${i + 1}.pdf`;
                    const outPath = path.join(previewsDir, outFilename);
                    fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));

                    console.log(`  └─ 💾 成功儲存預覽: ${outFilename}`);
                } else {
                    console.log(`  └─ ⚠️ 無法取得 Blob URL，跳過儲存。`);
                }

                // 關閉預覽 Modal
                await page.click('#closeObjectPreviewModalBtn');
                await page.waitForSelector('#objectPreviewModal.active', { hidden: true });
                await new Promise((r) => setTimeout(r, 300)); // 等待釋放資源與動畫
            }

            // 4. 關閉該策略的 Modal
            await page.click(st.closeBtn);
            await page.waitForSelector(`${st.modalId}.active`, { hidden: true });
            await new Promise((r) => setTimeout(r, 300));
        }

        // 關閉 page，準備處理下一個檔案
        await page.close();
    }

    console.log('\n🎉 所有預覽皆已成功截取並儲存至：', previewsDir);
} catch (e) {
    console.error('\n❌ E2E 預覽截取腳本發生錯誤:', e);
} finally {
    if (browser) await browser.close();
}
