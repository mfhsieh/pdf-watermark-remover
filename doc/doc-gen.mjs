import jsdoc2md from 'jsdoc-to-markdown';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * @fileoverview 自動化 API 文件生成腳本 (API Documentation Generator)
 *
 * 職責：
 * 1. 負責掃描專案 `js/` 目錄下的所有核心 JavaScript 檔案。
 * 2. 透過 `jsdoc-to-markdown` 套件，將原始碼中的 JSDoc 註解自動轉換為 Markdown 格式。
 * 3. 產出並覆蓋 `doc/API_Reference.md` 檔案，確保團隊的 API 文件永遠與程式碼同步。
 *
 * 執行指令： npm run docs (或 node doc/doc-gen.mjs)
 */

// 取得目前檔案的絕對路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定義專案根目錄 (doc/ 的上一層)
const rootDir = path.resolve(__dirname, '..');

/**
 * 非同步產生 API 文件
 * 此腳本會掃描 js/ 目錄下的所有 .js 檔案，讀取其中的 JSDoc 註解，
 * 轉換為 Markdown 格式，並輸出至 doc/API_Reference.md
 */
async function generateDocs() {
    const docDir = __dirname;

    // 使用 Glob Pattern 抓取 js 目錄下所有 JS 檔案，
    // 確保未來新增模組時，不需手動更新此處的檔案清單。
    const files = path.resolve(rootDir, 'js').replace(/\\/g, '/') + '/**/*.js';

    try {
        // 呼叫 jsdoc-to-markdown 解析程式碼並渲染為 Markdown
        const markdown = await jsdoc2md.render({ files: files });

        // 組合標題與產出的文件內容
        const output = `# PDF Watermark Remover 核心模組 API 文件\n\n${markdown}`;

        // 將結果寫入實體檔案 API_Reference.md
        fs.writeFileSync(path.resolve(docDir, 'API_Reference.md'), output);

        console.log('✅ 成功產出 API_Reference.md 至 doc 目錄！');
    } catch (e) {
        console.error('❌ 產生文件失敗:', e);
        process.exitCode = 1;
    }
}

// 執行主程式
generateDocs();
