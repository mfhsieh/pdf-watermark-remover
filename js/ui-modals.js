// ==========================================
// 浮水印清除策略設定彈出視窗 (Modal) 抽象化通用管理類別
// ==========================================
/**
 * 浮水印清除策略設定彈出視窗 (Modal) 抽象化通用管理類別
 *
 * 此類別採用統一的封裝設計，負責管理 6 種不同清除策略的彈出設定視窗，
 * 包含視窗開關、條列式 Checkbox 的動態渲染、回復預設值、套用設定以及與主畫面勾選狀態的雙向連動。
 */
class WatermarkStrategyModal {
    /**
     * 構造函數：初始化 Modal 實例並選取關聯的 DOM 元素
     * @param {Object} config - 設定物件
     */
    constructor(config) {
        this.modal = document.getElementById(config.modalId);
        this.openBtn = document.getElementById(config.openBtnId);
        this.closeBtn = document.getElementById(config.closeBtnId);
        this.applyBtn = document.getElementById(config.applyBtnId);
        this.resetBtn = document.getElementById(config.resetBtnId);
        this.listContainer = document.getElementById(config.listContainerId);
        this.desc = document.getElementById(config.descId);

        this.checkboxName = config.checkboxName;
        this.emptyText = config.emptyText || '未偵測到任何物件。';
        this.mainCheckboxId = config.mainCheckboxId;

        this.getDetectedMap = config.getDetectedMap;
        this.getDestroyList = config.getDestroyList;
        this.setDestroyList = config.setDestroyList;
        this.getSuspectState = config.getSuspectState;
        this.getSortCompare = config.getSortCompare;
        this.renderLabel = config.renderLabel;
        this.applyMsgTemplate = config.applyMsgTemplate;
        this.resetMsg = config.resetMsg;

        this.initEvents();
    }

    /**
     * 初始化 DOM 元素事件監聽器
     */
    initEvents() {
        // 開啟 Modal
        this.openBtn.addEventListener('click', () => {
            this.render();
            this.modal.classList.add('active');
        });

        // 關閉 Modal
        this.closeBtn.addEventListener('click', () => {
            this.modal.classList.remove('active');
        });

        // 回復預設值
        this.resetBtn.addEventListener('click', () => {
            const checkboxes = this.listContainer.querySelectorAll(`input[name="${this.checkboxName}"]`);
            const map = this.getDetectedMap();
            checkboxes.forEach((cb) => {
                const key = cb.dataset.rawText !== undefined ? cb.dataset.rawText : cb.value;
                const entry = map.get(key);
                if (entry) {
                    cb.checked = this.getSuspectState(key, entry, cb);
                }
            });
            addStatusMessage(this.resetMsg, 'info');
        });

        // 套用設定
        this.applyBtn.addEventListener('click', () => {
            const checkboxes = this.listContainer.querySelectorAll(`input[name="${this.checkboxName}"]`);
            const destroyList = [];
            checkboxes.forEach((cb) => {
                if (cb.checked) {
                    const val = cb.dataset.rawText !== undefined ? cb.dataset.rawText : cb.value;
                    destroyList.push(val);
                }
            });
            this.setDestroyList(destroyList);

            // 自動連動主策略 checkbox：有選項就勾選，否則取消
            const mainCheckbox = document.getElementById(this.mainCheckboxId);
            if (mainCheckbox) {
                mainCheckbox.checked = destroyList.length > 0;
            }

            this.modal.classList.remove('active');
            addStatusMessage(this.applyMsgTemplate(destroyList.length), 'success');
        });
    }

    /**
     * 渲染彈出視窗內的選項列表
     */
    render() {
        const map = this.getDetectedMap();
        const destroyList = this.getDestroyList();

        this.listContainer.innerHTML = '';

        // 清除之前渲染可能留在 listContainer 上方的「全選/全不選」控制列
        const prevSibling = this.listContainer.previousElementSibling;
        if (prevSibling && prevSibling.classList.contains('modal-select-controls')) {
            prevSibling.remove();
        }

        if (map.size === 0) {
            if (this.desc) this.desc.classList.add('hidden');
            this.listContainer.innerHTML = `
                        <div class="no-annots-card">
                            ${this.emptyText}
                        </div>
                    `;
            if (this.resetBtn) this.resetBtn.disabled = true;
            if (this.applyBtn) this.applyBtn.disabled = true;
        } else {
            if (this.desc) this.desc.classList.remove('hidden');
            if (this.resetBtn) this.resetBtn.disabled = false;
            if (this.applyBtn) this.applyBtn.disabled = false;

            // 加入「全選/全不選」控制項
            const controlsRow = document.createElement('div');
            controlsRow.className = 'modal-select-controls';

            const selectAllBtn = document.createElement('a');
            selectAllBtn.href = '#';
            selectAllBtn.textContent = '☑️ 全選';
            selectAllBtn.className = 'modal-select-btn select-all';
            selectAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const checkboxes = this.listContainer.querySelectorAll(`input[name="${this.checkboxName}"]`);
                checkboxes.forEach((cb) => (cb.checked = true));
            });

            const deselectAllBtn = document.createElement('a');
            deselectAllBtn.href = '#';
            deselectAllBtn.textContent = '✖️ 全不選';
            deselectAllBtn.className = 'modal-select-btn deselect-all';
            deselectAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const checkboxes = this.listContainer.querySelectorAll(`input[name="${this.checkboxName}"]`);
                checkboxes.forEach((cb) => (cb.checked = false));
            });

            controlsRow.appendChild(selectAllBtn);
            controlsRow.appendChild(deselectAllBtn);
            this.listContainer.before(controlsRow);

            const sortedEntries = Array.from(map.entries()).sort(this.getSortCompare);
            let index = 0;
            sortedEntries.forEach(([key, entry]) => {
                const label = document.createElement('label');
                label.className = 'annot-checkbox-label';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = this.checkboxName;

                // Form XObject 特殊處理
                if (this.checkboxName === 'formXObjectItem') {
                    input.value = index.toString();
                    input.dataset.rawText = key;
                } else {
                    input.value = key;
                }

                const isChecked = destroyList.includes(key);
                input.checked = isChecked;
                input.className = 'annot-checkbox-input';

                label.appendChild(input);
                this.renderLabel(label, key, entry, isChecked);

                // 針對支援即時預覽的清理類型，動態追加「👁️ 預覽」微按鈕
                const previewTypes = [
                    'formXObjectItem',
                    'imageXObjectItem',
                    'directContentItem',
                    'annotItem',
                    'ocgItem',
                ];
                if (previewTypes.includes(this.checkboxName)) {
                    const previewBtn = document.createElement('button');
                    previewBtn.type = 'button';
                    previewBtn.className = 'preview-item-btn';
                    previewBtn.title = '即時預覽該浮水印物件';
                    previewBtn.innerHTML = '👁️';
                    // margin-left: auto 與 padding 已由 .preview-item-btn CSS 定義，無需重複設定

                    previewBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation(); // 阻止點擊事件冒泡，防止誤觸核取方塊的狀態
                        openObjectPreview(this.checkboxName, key, entry);
                    });

                    label.appendChild(previewBtn);
                }

                this.listContainer.appendChild(label);
                index++;
            });
        }
    }
}

// ==========================================
// 註解 (Annotation) 元資料定義與 Modal 初始化
// ==========================================
/**
 * 註解 (Annotation) 子類型元資料設定
 * @type {Object.<string, {label: string, defaultDestroy: boolean, color: string}>}
 */
const annotSubtypeMeta = {
    Watermark: { label: '浮水印 (Watermark)', defaultDestroy: true, color: 'inherit' },
    Stamp: { label: '蓋印與圖章 (Stamp)', defaultDestroy: true, color: 'inherit' },
    Text: { label: '文字附註 (Text)', defaultDestroy: false, color: 'inherit' },
    Popup: { label: '彈出說明視窗 (Popup)', defaultDestroy: false, color: 'inherit' },
    FreeText: { label: '打字機文字 (FreeText)', defaultDestroy: false, color: 'inherit' },
    Highlight: { label: '螢光筆標註 (Highlight)', defaultDestroy: false, color: 'inherit' },
    Underline: { label: '底線標註 (Underline)', defaultDestroy: false, color: 'inherit' },
    StrikeOut: { label: '刪除線標註 (StrikeOut)', defaultDestroy: false, color: 'inherit' },
    Squiggly: { label: '波浪線標註 (Squiggly)', defaultDestroy: false, color: 'inherit' },
    Ink: { label: '手繪塗鴉 (Ink)', defaultDestroy: false, color: 'inherit' },
    Line: { label: '線條與箭頭標註 (Line)', defaultDestroy: false, color: 'inherit' },
    Square: { label: '矩形框標註 (Square)', defaultDestroy: false, color: 'inherit' },
    Circle: { label: '圓形框標註 (Circle)', defaultDestroy: false, color: 'inherit' },
    Polygon: { label: '多邊形標註 (Polygon)', defaultDestroy: false, color: 'inherit' },
    PolyLine: { label: '折線標註 (PolyLine)', defaultDestroy: false, color: 'inherit' },
    Link: { label: '網頁與目錄超連結 (Link)', defaultDestroy: false, color: 'var(--primary)' },
    Widget: { label: '表單欄位與電子簽章 (Widget)', defaultDestroy: false, color: 'var(--primary)' },
};

// 1. 表單外部物件 (Form XObject) Modal
new WatermarkStrategyModal({
    modalId: 'formXObjectKeywordsModal',
    openBtnId: 'openFormXObjectKeywordsModalBtn',
    closeBtnId: 'closeFormXObjectKeywordsModalBtn',
    applyBtnId: 'applyFormXObjectKeywordsBtn',
    resetBtnId: 'resetFormXObjectBtn',
    listContainerId: 'formXObjectListContainer',
    descId: 'formXObjectModalDesc',
    checkboxName: 'formXObjectItem',
    emptyText: `<div class="no-annots-card"><div class="no-annots-icon">📄</div><p class="no-annots-text">未解析出可選擇的「表單外部物件」內容。</p></div>`,
    mainCheckboxId: 'removeFormXObject',
    getDetectedMap: () => detectedFormXObjects,
    getDestroyList: () => formXObjectsToDestroy,
    setDestroyList: (list) => {
        formXObjectsToDestroy = list;
    },
    getSuspectState: (key, entry) => isSuspectFormXObject(entry, entry.rawStr),
    getSortCompare: () => 0, // 無特定排序需求
    renderLabel: (labelEl, key, entry) => {
        const pageLabel = ` (第 ${entry.pages.join(', ')} 頁)`;
        const displayName = entry.keyName.startsWith('/') ? entry.keyName : `/${entry.keyName}`;
        
        const textSpan = document.createElement('span');
        textSpan.appendChild(document.createTextNode(`${displayName}${pageLabel} [實體: ${key}]`));
        
        if (entry.isHeuristic) {
            const highlight = document.createElement('span');
            highlight.style.color = '#dc3545';
            highlight.style.fontWeight = 'bold';
            highlight.textContent = ' [高頻偵測]';
            textSpan.appendChild(highlight);
        }
        
        labelEl.appendChild(textSpan);
    },
    applyMsgTemplate: (len) => `已選擇套用清理 ${len} 個「表單外部物件」。`,
    resetMsg: '已將當前檔案中的「表單外部物件」清理選項回復為預設值（預設勾選疑似浮水印的物件，其餘安全保留）。',
});

// 2. 註解 (Annotation) Modal
new WatermarkStrategyModal({
    modalId: 'annotsSettingsModal',
    openBtnId: 'openAnnotsSettingsModalBtn',
    closeBtnId: 'closeAnnotsSettingsModalBtn',
    applyBtnId: 'applyAnnotsSettingsBtn',
    resetBtnId: 'resetAnnotsSettingsBtn',
    listContainerId: 'annotsSubtypesContainer',
    descId: 'annotsModalDesc',
    checkboxName: 'annotItem',
    emptyText: `<div class="no-annots-card"><div class="no-annots-icon">📄</div><p class="no-annots-text">當前 PDF 檔案中未偵測到任何「註解」，無需進行設定。</p></div>`,
    mainCheckboxId: 'removeAnnotations',
    getDetectedMap: () => detectedAnnotations,
    getDestroyList: () => annotsToDestroy,
    setDestroyList: (list) => {
        annotsToDestroy = list;
    },
    getSuspectState: (key, entry) => isSuspectAnnotation(entry),
    getSortCompare: (a, b) => {
        const annotA = a[1];
        const annotB = b[1];
        if (annotA.page !== annotB.page) return annotA.page - annotB.page;
        const isSpecialA = annotA.subtype === 'Link' || annotA.subtype === 'Widget';
        const isSpecialB = annotB.subtype === 'Link' || annotB.subtype === 'Widget';
        if (isSpecialA && !isSpecialB) return 1;
        if (!isSpecialA && isSpecialB) return -1;
        if (annotA.subtype !== annotB.subtype) return annotA.subtype.localeCompare(annotB.subtype);
        return 0;
    },
    renderLabel: (labelEl, key, entry) => {
        const meta = annotSubtypeMeta[entry.subtype];
        const labelText = meta ? meta.label : `/${entry.subtype}`;
        const textColor = meta ? meta.color : 'inherit';
        if (textColor !== 'inherit') labelEl.style.color = textColor;
        const pageLabel = ` (第 ${entry.page} 頁)`;
        labelEl.appendChild(document.createTextNode(`[${labelText}]${pageLabel}`));
    },
    applyMsgTemplate: (len) => `已成功套用「註解」清理設定！共選定清理 ${len} 個「註解」實例。`,
    resetMsg: '已將當前檔案中的「註解」清理選項回復為預設值（預設勾選 Watermark 與 Stamp 類型，其餘類型安全保留）。',
});

// 3. 頁面直接內容 (Direct Content) Modal
new WatermarkStrategyModal({
    modalId: 'triggerWordsModal',
    openBtnId: 'openTriggerWordsModalBtn',
    closeBtnId: 'closeTriggerWordsModalBtn',
    applyBtnId: 'applyTriggerWordsBtn',
    resetBtnId: 'resetTriggerWordsBtn',
    listContainerId: 'directContentListContainer',
    descId: 'triggerWordsModalDesc',
    checkboxName: 'directContentItem',
    emptyText: '📭 當前 PDF 檔案中未偵測到任何「頁面直接內容」。',
    mainCheckboxId: 'removeDirectContent',
    getDetectedMap: () => detectedDirectContents,
    getDestroyList: () => directContentsToDestroy,
    setDestroyList: (list) => {
        directContentsToDestroy = list;
    },
    getSuspectState: (key, entry) => isSuspectDirectContent(entry),
    getSortCompare: (a, b) => a[1].page - b[1].page,
    renderLabel: (labelEl, key, entry) => {
        const labelText = `第 ${entry.page} 頁`;
        labelEl.appendChild(document.createTextNode(labelText));
    },
    applyMsgTemplate: (len) => `已成功套用「頁面直接內容」清理設定！共選定清理 ${len} 個「頁面直接內容」實例。`,
    resetMsg: '已將當前檔案中的「頁面直接內容」清理選項回復為預設值（預設勾選疑似浮水印的內容流，其餘安全保留）。',
});

// 4. 影像外部物件 (Image XObject) Modal
new WatermarkStrategyModal({
    modalId: 'imageKeywordsModal',
    openBtnId: 'openImageKeywordsModalBtn',
    closeBtnId: 'closeImageKeywordsModalBtn',
    applyBtnId: 'applyImageKeywordsBtn',
    resetBtnId: 'resetImageXObjectBtn',
    listContainerId: 'imageXObjectListContainer',
    descId: 'imageXObjectModalDesc',
    checkboxName: 'imageXObjectItem',
    emptyText: '📭 當前 PDF 檔案中未偵測到任何「影像外部物件」。',
    mainCheckboxId: 'removeImageXObject',
    getDetectedMap: () => detectedImages,
    getDestroyList: () => imagesToDestroy,
    setDestroyList: (list) => {
        imagesToDestroy = list;
    },
    getSuspectState: (key, entry) => isSuspectImageXObject(entry),
    getSortCompare: (a, b) => {
        const pageA = a[1].pages && a[1].pages.length > 0 ? a[1].pages[0] : 0;
        const pageB = b[1].pages && b[1].pages.length > 0 ? b[1].pages[0] : 0;
        return pageA !== pageB ? pageA - pageB : a[1].keyName.localeCompare(b[1].keyName);
    },
    renderLabel: (labelEl, key, entry) => {
        const displayName = entry.keyName.startsWith('/') ? entry.keyName : `/${entry.keyName}`;
        const pageLabel = entry.pages && entry.pages.length > 0 ? ` (第 ${entry.pages.join(', ')} 頁)` : '';
        
        const textSpan = document.createElement('span');
        textSpan.appendChild(
            document.createTextNode(`${displayName} (${entry.width}x${entry.height}, ${entry.filterStr})${pageLabel}`)
        );
        
        if (entry.isHeuristic) {
            const highlight = document.createElement('span');
            highlight.style.color = '#dc3545';
            highlight.style.fontWeight = 'bold';
            highlight.textContent = ' [高頻偵測]';
            textSpan.appendChild(highlight);
        }
        
        labelEl.appendChild(textSpan);
    },
    applyMsgTemplate: (len) => `已成功套用「影像外部物件」清理設定！共選定清除 ${len} 個影像實例。`,
    resetMsg: '已將當前檔案中的「影像外部物件」清理選項回復為預設值（自動勾選名稱疑似浮水印之項目，其餘安全保留）。',
});

// 5. 延伸圖形狀態 (ExtGState) Modal
new WatermarkStrategyModal({
    modalId: 'extGStateKeywordsModal',
    openBtnId: 'openExtGStateKeywordsModalBtn',
    closeBtnId: 'closeExtGStateKeywordsModalBtn',
    applyBtnId: 'applyExtGStateKeywordsBtn',
    resetBtnId: 'resetExtGStateBtn',
    listContainerId: 'extGStateListContainer',
    descId: 'extGStateModalDesc',
    checkboxName: 'extGStateItem',
    emptyText: '📭 當前 PDF 檔案中未偵測到任何「延伸圖形狀態」。',
    mainCheckboxId: 'removeExtGState',
    getDetectedMap: () => detectedExtGStates,
    getDestroyList: () => extGStatesToDestroy,
    setDestroyList: (list) => {
        extGStatesToDestroy = list;
    },
    getSuspectState: (key, entry) => isSuspectExtGState(entry),
    getSortCompare: (a, b) =>
        a[1].page !== b[1].page ? a[1].page - b[1].page : a[1].keyName.localeCompare(b[1].keyName),
    renderLabel: (labelEl, key, entry) => {
        const displayName = entry.keyName.startsWith('/') ? entry.keyName : `/${entry.keyName}`;
        labelEl.appendChild(document.createTextNode(`${displayName} (${entry.detailText}) (第 ${entry.page} 頁)`));
    },
    applyMsgTemplate: (len) => `已成功套用「延伸圖形狀態」清理設定！共選定清理 ${len} 個「延伸圖形狀態」實例。`,
    resetMsg: '已將當前檔案中的「延伸圖形狀態」清理選項回復為預設值（自動勾選疑似浮水印的延伸狀態，其餘安全保留）。',
});

// 6. 選擇性內容群組 (OCG) Modal
new WatermarkStrategyModal({
    modalId: 'ocgKeywordsModal',
    openBtnId: 'openOCGKeywordsModalBtn',
    closeBtnId: 'closeOCGKeywordsModalBtn',
    applyBtnId: 'applyOCGKeywordsBtn',
    resetBtnId: 'resetOCGBtn',
    listContainerId: 'ocgListContainer',
    descId: 'ocgModalDesc',
    checkboxName: 'ocgItem',
    emptyText: '📭 當前 PDF 檔案中未偵測到任何「選擇性內容群組」。',
    mainCheckboxId: 'removeOCG',
    getDetectedMap: () => detectedOCGs,
    getDestroyList: () => ocgsToDestroy,
    setDestroyList: (list) => {
        ocgsToDestroy = list;
    },
    getSuspectState: (key, entry) => isSuspectOCG(entry),
    getSortCompare: (a, b) => a[1].name.localeCompare(b[1].name),
    renderLabel: (labelEl, key, entry) => {
        labelEl.appendChild(document.createTextNode(`"${entry.name}"`));
    },
    applyMsgTemplate: (len) => `已成功套用「選擇性內容群組」清理設定！共選定隱藏 ${len} 個「選擇性內容群組」實例。`,
    resetMsg: '已將當前檔案中的「選擇性內容群組」清理選項回復為預設值（自動勾選名稱疑似浮水印之圖層，其餘安全保留）。',
});
