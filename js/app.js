// ==========================================
// [Event Controllers] 事件綁定與流程控制
// ==========================================

/**
 * 共用輔助函式：當使用者選取檔案後，統一執行 UI 更新與背景掃描
 * @param {File} file - 使用者選取的 PDF 檔案
 */
function handleFileSelected(file) {
    selectedFile = file;
    updateFileAreaDisplay();
    clearStatusMessages();
    addStatusMessage(`已選擇檔案：${selectedFile.name}，大小 ${formatBytes(selectedFile.size)}`, 'info');
    downloadArea.classList.add('hidden');
    // 捕捉非同步背景處理時可能發生的未預期錯誤，避免 Unhandled Promise Rejection
    showOriginalPreview(selectedFile).catch((err) => {
        console.error('預覽載入失敗:', err);
        addStatusMessage(`預覽載入失敗: ${err.message}`, 'error');
    });
}
// 監聽傳統點擊選擇檔案事件
fileInput.addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
        handleFileSelected(event.target.files[0]);
    }
});

// 監聽鍵盤事件 (無障礙支援：允許使用 Enter 或空白鍵觸發上傳)
fileArea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput.click();
    }
});

// 監聽檔案拖曳滑過拖曳區事件
fileArea.addEventListener('dragover', (event) => {
    event.preventDefault(); // 必須阻擋瀏覽器預設開啟 PDF 的行為
    fileArea.classList.add('dragging');
});

// 監聽檔案拖曳離開拖曳區事件
fileArea.addEventListener('dragleave', () => {
    fileArea.classList.remove('dragging');
});

// 監聽檔案釋放拖曳事件
fileArea.addEventListener('drop', (event) => {
    event.preventDefault();
    fileArea.classList.remove('dragging');

    const file = event.dataTransfer.files[0];
    // 加入副檔名判斷 Fallback，避免部分 OS 拖曳時遺失 MIME Type
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
        // 嘗試將拖曳檔案與 input 同步（相容性處理，部分舊瀏覽器 input.files 為唯讀）
        try {
            fileInput.files = event.dataTransfer.files;
        } catch (err) {
            console.warn('無法同步 fileInput.files，將僅使用 selectedFile 變數維持選檔狀態:', err);
        }

        handleFileSelected(file);
    } else {
        clearStatusMessages();
        addStatusMessage('僅支援 PDF 檔案格式。', 'error');
    }
});

// 監聽開始處理按鈕事件（使用 Async-Await 避免瀏覽器卡頓）
processButton.addEventListener('click', async () => {
    if (!selectedFile) {
        clearStatusMessages();
        addStatusMessage('請先選擇 PDF 檔案。', 'error');
        return;
    }

    // 每次開始新的處理時，主動隱藏下載區域與上一次的處理後預覽畫面，避免處理失敗時殘留舊狀態
    downloadArea.classList.add('hidden');
    processedPreviewBox.classList.add('hidden');
    processedPreview.removeAttribute('src');

    clearStatusMessages();
    addStatusMessage('🚀 開始處理 PDF 文件，請稍候...', 'info');
    processButton.disabled = true; // 鎖定按鈕，防止使用者在處理過程中重複點擊觸發
    processButton.textContent = '處理中...';

    try {
        // 1. 決定本次處理要使用的 PDF 位元組來源
        // 當前執行時，UI 已確保 cachedDecryptedBytes 存在，因此直接使用記憶體快取，避免重複解碼
        if (!cachedDecryptedBytes) {
            throw new Error('無法取得 PDF 記憶體快取，請重新選擇檔案。');
        }

        if (cachedPassword) {
            addStatusMessage('🔓 使用已快取的開啟密碼，跳過重新解密。', 'info');
        } else if (lastSuccessPassword) {
            addStatusMessage('🔓 使用前次成功解密的密碼快取。', 'info');
        } else {
            addStatusMessage('✅ 已取得 PDF 記憶體快取，開始處理...', 'info');
        }

        const pdfDoc = await PDFDocument.load(cachedDecryptedBytes, { updateMetadata: false });
        pdfDoc.getPageCount();

        // 2. 取得目前畫面中 checkbox 勾選的清理選項
        addStatusMessage('載入浮水印清除選項設定...', 'info');
        const options = getOptions();

        // 3. 開始重構 PDF 物件樹
        addStatusMessage('開始掃描並重構 PDF 物件樹，套用清除策略...', 'info');
        const result = processPdf(pdfDoc, options);

        // 4. 更新狀態列文字
        if (result.modifiedObjects === 0) {
            addStatusMessage('未偵測到可清除的浮水印物件。請嘗試使用更多選項或更換檔案。', 'info');
        } else {
            addStatusMessage(`已成功置換或修改了 ${result.modifiedObjects} 個可疑浮水印物件。`, 'success');
        }

        // 5. 將重構後的 PDF 文件儲存回二進位陣列 (Uint8Array)
        addStatusMessage('正在封裝儲存 PDF 結構，產生無損 PDF 位元組串流...', 'info');
        const bytes = await pdfDoc.save();

        // 6. 將 Uint8Array 封裝成 Blob 並提供瀏覽器下載/預覽
        const blob = new Blob([bytes], { type: 'application/pdf' });
        if (processedUrl) {
            URL.revokeObjectURL(processedUrl); // 釋放舊 URL 記憶體
        }
        processedUrl = URL.createObjectURL(blob);
        downloadLink.href = processedUrl;
        // 下載檔案名稱尾碼自動加上 _removed
        downloadLink.download = selectedFile.name.replace(/\.pdf$/i, '') + '_removed.pdf';
        downloadArea.classList.remove('hidden');

        addStatusMessage('🎉 浮水印清除已完成！請點擊下方按鈕下載處理後的 PDF。', 'success');

        // 7. 將處理完畢的 PDF 掛載至右側 After 預覽窗並顯現出來
        // 先解除隱藏再設定 src，避免 iOS Safari 忽略 display:none 狀態下的 iframe 載入
        processedPreviewBox.classList.remove('hidden');
        // 加入微小延遲確保 DOM 已渲染
        setTimeout(() => { processedPreview.src = processedUrl; }, 10);
    } catch (error) {
        console.error(error);
        addStatusMessage(
            `❌ 處理過程發生錯誤: ${error.message || '未知錯誤'}。無法完成浮水印清除，請嘗試其他檔案。`,
            'error'
        );
    } finally {
        processButton.disabled = false; // 無論成功與否，皆解鎖按鈕
        processButton.textContent = '開始清除浮水印';
    }
});

/**
 * 輔助函式：格式化檔案大小單位
 * @param {number} bytes - 檔案位元組大小
 * @returns {string} 可讀性佳的格式化檔案大小 (如 1.25 MB)
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`;
}

/**
 * 依據目前選取的 selectedFile 更新拖曳上傳區域的文字顯示。
 */
function updateFileAreaDisplay() {
    fileAreaInner.replaceChildren();

    const strongEl = document.createElement('strong');
    const spanEl = document.createElement('span');

    if (selectedFile) {
        strongEl.textContent = `📄 ${selectedFile.name} (${formatBytes(selectedFile.size)})`;
        spanEl.textContent = '點擊或拖曳以更換檔案';
    } else {
        strongEl.textContent = '點擊或拖曳 PDF 檔案到此處';
        spanEl.textContent = '僅支援 PDF，最大建議 50MB';
    }

    fileAreaInner.appendChild(strongEl);
    fileAreaInner.appendChild(spanEl);
}

/**
 * 取得目前畫面中 checkbox 勾選的清理選項
 * @returns {{removeFormXObject: boolean, removeAnnotations: boolean, removeDirectContent: boolean, removeImageXObject: boolean, removeExtGState: boolean, removeOCG: boolean}} 清理選項物件
 */
function getOptions() {
    return {
        removeFormXObject: chkRemoveFormXObject.checked,
        removeAnnotations: chkRemoveAnnotations.checked,
        removeDirectContent: chkRemoveDirectContent.checked,
        removeImageXObject: chkRemoveImageXObject.checked,
        removeExtGState: chkRemoveExtGState.checked,
        removeOCG: chkRemoveOCG.checked,
    };
}
