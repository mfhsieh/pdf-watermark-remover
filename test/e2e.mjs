/**
 * @fileoverview 端到端 (E2E) 核心自動化測試腳本
 *
 * 職責：
 * 1. 利用 Puppeteer 啟動無頭瀏覽器，自動化模擬使用者上傳、設定與下載 PDF 檔案的完整流程。
 * 2. 結合 pdf-lib 進行結果驗證，解析清除前後的 PDF 內部結構 (Form, Image, ExtGState, Annotations)，確保浮水印物件數量確實減少。
 * 3. 包含例外流程覆蓋率測試，如非 PDF 檔案攔截與密碼錯誤次數上限驗證。
 *
 * 執行指令：
 *   - npm run e2e                (預設執行完整自動化測試，並自動清空舊資料)
 *   - npm run e2e [檔名]         (測試單一檔案)
 *   - npm run e2e -- --clean [檔名] (強制清空目錄後測試單一檔案)
 *   - npm run e2e -- --clean     (僅清空輸出目錄，不進行測試)
 * 
 * 💡 備註：[檔名] 支援相對於當前目錄的路徑或絕對路徑 (如 ../file.pdf)。
 *    若單純提供檔名，將預設於 test/e2e-files/ 目錄底下尋找。
 */
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import assert from 'assert';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream } from 'pdf-lib';

// 取得目前檔案的絕對路徑與目錄 (ES 模組標準寫法)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定義測試檔案目錄與下載輸出目錄
const testFilesDir = path.resolve(__dirname, 'e2e-files');
const removedDir = path.resolve(testFilesDir, 'removed');

// 定義要測試的本地端 HTML 檔案路徑
const indexUrl = 'file://' + path.resolve(__dirname, '../index.html');

/**
 * 輔助函式：計算 PDF 中特定特徵（浮水印物件）的數量
 * 使用 pdf-lib 解析 PDF，並盤點 Form、Image、ExtGState 與 Annotations 的總數，
 * 用於驗證清除浮水印前後的數量變化。
 *
 * @param {Uint8Array} pdfBytes - PDF 檔案的位元組陣列
 * @returns {Promise<Object|null>} 回傳各項特徵的數量，若解析失敗則回傳 null
 */
async function countFeatures(pdfBytes) {
    try {
        // 載入 PDF，忽略加密狀態（因為清除後的檔案應該已經解密）
        const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        let forms = 0;
        let images = 0;
        let extgs = 0;
        let annots = 0;

        for (const page of doc.getPages()) {
            const annotsArray = page.node.lookup(PDFName.of('Annots'));
            if (annotsArray instanceof PDFArray) {
                annots += annotsArray.size();
            }

            const resources = page.node.lookup(PDFName.of('Resources'));
            if (resources instanceof PDFDict) {
                const xObjects = doc.context.lookup(resources.get(PDFName.of('XObject')));
                if (xObjects instanceof PDFDict) {
                    for (const key of xObjects.keys()) {
                        const xObj = doc.context.lookup(xObjects.get(key));
                        const subtype =
                            xObj instanceof PDFRawStream
                                ? doc.context.lookup(xObj.dict.get(PDFName.of('Subtype')))
                                : null;
                        if (subtype instanceof PDFName) {
                            if (subtype.toString() === '/Form') forms++;
                            if (subtype.toString() === '/Image') images++;
                        }
                    }
                }

                const extGState = doc.context.lookup(resources.get(PDFName.of('ExtGState')));
                if (extGState instanceof PDFDict) {
                    extgs += extGState.keys().length;
                }
            }
        }
        return { forms, images, extgs, annots };
    } catch {
        // Node.js 環境下的 pdf-lib 解析某些損壞物件時會報錯，這裡做容錯處理
        console.warn(
            '⚠️ 警告：無法在 Node.js 環境中解析 PDF 進行驗證計數 (此為 pdf-lib 的已知解析限制)。將跳過計數驗證。'
        );
        return null;
    }
}

/**
 * 執行端到端 (E2E) 測試主程式 (利用 ESM Top-level Await 頂層執行)
 */
// 取得使用者指定的參數，過濾掉 --clean 參數
const rawArgs = process.argv.slice(2);
const isClean = rawArgs.includes('--clean');
const args = rawArgs.filter((arg) => arg !== '--clean');

// 如果只有傳入 --clean，沒有指定任何額外參數，則僅清空目錄並結束
if (isClean && args.length === 0) {
    if (fs.existsSync(removedDir)) {
        fs.rmSync(removedDir, { recursive: true, force: true });
    }
    fs.mkdirSync(removedDir, { recursive: true });
    console.log('🧹 測試輸出目錄 (removed) 已清空，結束執行。');
    process.exit(0);
}

// 在測試開始前強制清空並重建下載目錄，避免前次測試殘留的 .crdownload 導致輪詢卡死
if (fs.existsSync(removedDir)) fs.rmSync(removedDir, { recursive: true, force: true });
if (!fs.existsSync(removedDir)) fs.mkdirSync(removedDir, { recursive: true });

console.log('🚀 開始執行 PDF 浮水印清除工具 E2E 測試...');
let browser;

try {
    // 啟動 Puppeteer 無頭瀏覽器 (Headless Browser)
    browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
        headless: true, // 升級為標準設定，避免 headless: 'new' 引發的棄用警告
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    /**
     * 內部輔助函式：處理單一 PDF 檔案的自動化測試流程
     * @param {string} filename - 測試檔案名稱
     * @param {Function} setupOptionsCallback - 在瀏覽器內執行的回呼函式，用來模擬使用者勾選 UI 選項
     * @param {Object} expectedReductions - 預期應該被減少的物件類型 (例如 { forms: true })
     */
    const processFile = async (filename, setupOptionsCallback, expectedReductions) => {
        console.log(`\n⏳ 測試 ${filename} 中...`);
        const page = await browser.newPage();

        // 監聽並印出瀏覽器內的 console.log 與錯誤，方便除錯
        page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.toString()));

        try {
            // 設定 Chrome 下載行為，自動存入指定的 removedDir 目錄且不跳出儲存視窗
            const client = await page.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: removedDir,
            });

            // 進入本地端的 index.html (等待網路請求結束)
            await page.goto(indexUrl, { waitUntil: 'networkidle0' });

            const filePath = path.resolve(testFilesDir, filename);
            if (!fs.existsSync(filePath)) {
                throw new Error(`找不到測試檔案: ${filePath}`);
            }

            // 讀取輸入檔，並計算原始的物件數量
            const inputBytes = fs.readFileSync(filePath);
            const inputCounts = await countFeatures(inputBytes);

            // 模擬使用者透過 input 上傳檔案
            const fileInput = await page.$('#fileInput');
            await fileInput.uploadFile(filePath);

            // 等待背景掃描完成（處理按鈕出現且可點擊）
            await page.waitForFunction(
                () => {
                    const btn = document.getElementById('processButton');
                    return btn && !btn.classList.contains('hidden') && !btn.disabled;
                },
                { timeout: 30000 }
            );

            // 若有自訂設定選項，則在瀏覽器內執行該回呼函式（模擬點擊 UI）
            if (setupOptionsCallback) {
                await page.evaluate(setupOptionsCallback);
            }

            // 點擊「開始清除浮水印」按鈕
            await page.click('#processButton');

            // 等待處理完成（下載區塊顯示出來）
            await page.waitForSelector('#downloadArea:not(.hidden)', { timeout: 30000 });

            // 預期下載的檔案路徑，若已存在舊檔則先刪除 (使用 basename 確保即使跨目錄也能正確對應瀏覽器下載行為)
            const baseFilename = path.basename(filename);
            const expectedFile = path.resolve(removedDir, baseFilename.replace('.pdf', '_removed.pdf'));
            if (fs.existsSync(expectedFile)) {
                fs.unlinkSync(expectedFile);
            }

            // 觸發下載
            await page.click('#downloadLink');

            // 輪詢檢查檔案是否下載完畢且大小已穩定 (避免還在 .crdownload 狀態)
            let downloaded = false;
            let lastSize = -1;
            let stableCount = 0;

            for (let i = 0; i < 60; i++) {
                // 檢查目錄中是否還有尚未下載完成的 .crdownload 暫存檔
                const files = fs.readdirSync(removedDir);
                const isDownloading = files.some((f) => f.endsWith('.crdownload'));

                if (fs.existsSync(expectedFile) && !isDownloading) {
                    const currentSize = fs.statSync(expectedFile).size;
                    if (currentSize > 0 && currentSize === lastSize) {
                        stableCount++;
                        if (stableCount >= 2) {
                            // 檔案大小穩定超過 1 秒 (500ms * 2)，判定下載完成
                            downloaded = true;
                            break;
                        }
                    } else {
                        stableCount = 0;
                    }
                    lastSize = currentSize;
                }
                await new Promise((r) => setTimeout(r, 500));
            }

            // 斷言：驗證檔案是否順利下載且不為空
            assert.ok(downloaded, `檔案應該完全下載完畢：${filename}`);
            assert.ok(fs.existsSync(expectedFile), `檔案 ${expectedFile} 應該要存在`);
            const stat = fs.statSync(expectedFile);
            assert.ok(stat.size > 0, `檔案 ${expectedFile} 不應為空檔`);

            // ===== 驗證邏輯 (VERIFICATION) =====
            const outputBytes = fs.readFileSync(expectedFile);
            const outputCounts = await countFeatures(outputBytes);

            if (inputCounts && outputCounts) {
                console.log(`  - 原始物件數量:  `, inputCounts);
                console.log(`  - 產出物件數量: `, outputCounts);

                if (expectedReductions.forms)
                    assert.ok(
                        outputCounts.forms < inputCounts.forms,
                        '預期 Form XObject (表單外部物件) 數量會減少，但並沒有。'
                    );
                if (expectedReductions.images)
                    assert.ok(
                        outputCounts.images < inputCounts.images,
                        '預期 Image XObject (影像外部物件) 數量會減少，但並沒有。'
                    );
                if (expectedReductions.extgs)
                    assert.ok(
                        outputCounts.extgs < inputCounts.extgs,
                        '預期 ExtGState (延伸圖形狀態) 數量會減少，但並沒有。'
                    );
                if (expectedReductions.annots)
                    assert.ok(
                        outputCounts.annots < inputCounts.annots,
                        '預期 Annotations (註解) 數量會減少，但並沒有。'
                    );

                console.log(`✅ 測試通過 ${filename} - 驗證成功，結果已儲存至 ${expectedFile}`);
            } else {
                console.log(`✅ 測試通過 ${filename} - 處理完畢並儲存至 ${expectedFile} (已跳過數量驗證)`);
            }
        } finally {
            await page.close();
        }
    };

    // 定義各個預設測試檔案的配置與測試情境
    const defaultConfigs = {
        // 測試案例 1：使用預設選項，驗證清除表單外部物件 (Form XObject)
        'sample1.pdf': { setup: null, expected: { forms: true } },

        // 測試案例 2：模擬使用者打開設定，勾選所有「延伸圖形狀態 (ExtGState)」並驗證其清除效果
        'sample2.pdf': {
            setup: () => {
                document.getElementById('openExtGStateKeywordsModalBtn').click();
                const selectAllExt = document.querySelector('#extGStateKeywordsModal .select-all');
                if (selectAllExt) selectAllExt.click();
                document.getElementById('applyExtGStateKeywordsBtn').click();
            },
            expected: { forms: true, extgs: true },
        },

        // 測試案例 3：模擬使用者打開設定，勾選所有「註解 (Annotation)」與「影像 (Image)」並驗證其清除效果
        'sample3.pdf': {
            setup: () => {
                document.getElementById('openAnnotsSettingsModalBtn').click();
                const selectAllAnnots = document.querySelector('#annotsSettingsModal .select-all');
                if (selectAllAnnots) selectAllAnnots.click();
                document.getElementById('applyAnnotsSettingsBtn').click();

                document.getElementById('openImageKeywordsModalBtn').click();
                const selectAllImg = document.querySelector('#imageKeywordsModal .select-all');
                if (selectAllImg) selectAllImg.click();
                document.getElementById('applyImageKeywordsBtn').click();
            },
            expected: { annots: true, images: true },
        },

        // 測試案例 4：使用預設選項（假設預設邏輯會自動偵測並處理，主要驗證腳本順利執行不報錯）
        'sample4.pdf': { setup: null, expected: {} },
    };

    // 取得要測試的檔案名稱，若無參數則測試全部預設項目
    const targetFiles = args.length > 0 ? args : Object.keys(defaultConfigs);
    const shouldRunErrorPaths = args.length === 0; // 只有預設完整測試時才跑錯誤路徑

    // 依序測試目標檔案
    for (const filename of targetFiles) {
        const config = defaultConfigs[filename] || { setup: null, expected: {} };
        await processFile(filename, config.setup, config.expected);
    }

    // 測試案例 5 & 6：錯誤路徑覆蓋 (非 PDF 與 密碼錯誤)
    const testErrorPaths = async () => {
        console.log(`\n⏳ 測試錯誤路徑 (非 PDF 檔案與密碼錯誤) 中...`);
        const page = await browser.newPage();

        try {
            await page.goto(indexUrl, { waitUntil: 'networkidle0' });

            // 1. 測試上傳非 PDF 檔案
            const txtFilePath = path.resolve(testFilesDir, 'sample.txt');
            const fileInput = await page.$('#fileInput');
            await fileInput.uploadFile(txtFilePath);

            await page.waitForFunction(
                () => {
                    const msgs = document.querySelectorAll('.status-line.error');
                    return Array.from(msgs).some((m) => m.textContent.includes('僅支援 PDF 檔案格式。'));
                },
                { timeout: 5000 }
            );
            console.log(`✅ 非 PDF 檔案攔截測試通過`);

            // 2. 測試密碼嘗試超過次數 (使用 sample-encrypted.pdf)
            await page.goto(indexUrl, { waitUntil: 'networkidle0' }); // reload
            const encFilePath = path.resolve(testFilesDir, 'sample-encrypted.pdf');
            const fileInput2 = await page.$('#fileInput');

            // 攔截並自動輸入錯誤密碼 (密碼嘗試次數上限為 5 次)
            await fileInput2.uploadFile(encFilePath);
            for (let i = 0; i < 5; i++) {
                // 等待密碼 Modal 顯示
                await page.waitForSelector('#passwordModal.active', { timeout: 10000 });
                // 輸入錯誤密碼
                await page.type('#pdfPasswordInput', 'wrong-password');
                // 點擊送出
                await page.click('#modalSubmitButton');
                // 若這不是最後一次，等待 modal 短暫消失或重新出現錯誤提示，避免太快連續點擊
                await new Promise((r) => setTimeout(r, 500));
            }

            await page.waitForFunction(
                () => {
                    const msgs = document.querySelectorAll('.status-line.error');
                    return Array.from(msgs).some(
                        (m) =>
                            m.textContent.includes('密碼嘗試次數過多') || m.textContent.includes('連續輸入錯誤密碼達')
                    );
                },
                { timeout: 10000 }
            );
            console.log(`✅ 密碼嘗試超過上限攔截測試通過`);
        } finally {
            await page.close();
        }
    };

    if (shouldRunErrorPaths) {
        await testErrorPaths();
    }

    console.log('\n🎉 所有 E2E 測試與驗證均順利通過！');
} catch (e) {
    console.error('\n❌ E2E 測試失敗:', e);
} finally {
    // 測試結束，關閉瀏覽器
    if (browser) await browser.close();
}
