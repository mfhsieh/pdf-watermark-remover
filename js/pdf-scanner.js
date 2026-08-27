/**
 * @fileoverview PDF 掃描與即時預覽引擎。
 * 負責深度掃描 PDF 各頁面的 Resources、Annots 與 Contents 以找出疑似浮水印目標，並生成即時預覽所需的隔離 Blob URL。
 */

// ==========================================
// [Scanner & Preview Engine] PDF 掃描與即時預覽引擎
// ==========================================

/**
 * 取得頁面或節點的 Resources 字典，支援從 Parent Pages 樹狀結構遞迴繼承
 * @param {PDFDict} node - 頁面或表單節點
 * @returns {PDFDict|null} 解析出的 Resources 字典
 */
function getPageResources(node) {
    let currentNode = node;
    while (currentNode instanceof PDFDict) {
        const res = currentNode.get(PDFName.of('Resources'));
        if (res) return currentNode.context.lookup(res);
        const parentRef = currentNode.get(PDFName.of('Parent'));
        if (!parentRef) break;
        currentNode = currentNode.context.lookup(parentRef);
    }
    return null;
}

/**
 * 從頁面或 Form XObject 中精確計算呼叫目標 XObject 時的累積變換矩陣 (CTM)
 * 支援跨越巢狀 Form XObject 進行深層搜尋。
 * @param {PDFDocument} ownerDoc - 擁有該物件的 PDFDocument 實例
 * @param {PDFPage|PDFRawStream} streamOrPage - 起始掃描的頁面或 Form XObject 串流
 * @param {string} cleanKeyName - 目標物件的資源鍵名 (不含前綴斜線)
 * @param {string|null} [targetRefStr=null] - 目標物件的特定參照字串 (可選)
 * @param {number[]} [baseCTM=[1, 0, 0, 1, 0, 0]] - 初始基準變換矩陣
 * @param {PDFDict|null} [parentResourcesDict=null] - 父層級的資源字典
 * @returns {number[]|null} 計算出的 6 個元素的 CTM 陣列，若找不到則回傳 null
 */
function getCTMForXObject(
    ownerDoc,
    streamOrPage,
    cleanKeyName,
    targetRefStr = null,
    baseCTM = [1, 0, 0, 1, 0, 0],
    parentResourcesDict = null
) {
    let streams = [];
    let dict = null;
    let resourcesDict = null;

    if (streamOrPage.node && streamOrPage.node.get(PDFName.of('Contents'))) {
        const contentsRef = streamOrPage.node.get(PDFName.of('Contents'));
        const contents = ownerDoc.context.lookup(contentsRef);
        if (contents instanceof PDFArray) {
            for (let i = 0; i < contents.size(); i++) {
                streams.push(ownerDoc.context.lookup(contents.get(i)));
            }
        } else if (contents) {
            streams.push(contents);
        }
        resourcesDict = getPageResources(streamOrPage.node);
    } else if (streamOrPage instanceof PDFRawStream) {
        streams.push(streamOrPage);
        dict = streamOrPage.dict;
        resourcesDict = ownerDoc.context.lookup(dict.get(PDFName.of('Resources')));
    }

    resourcesDict = resourcesDict || parentResourcesDict;
    if (streams.length === 0) return null;

    let currentCTM = [...baseCTM];
    if (streamOrPage instanceof PDFRawStream && dict && dict.has(PDFName.of('Matrix'))) {
        const matrixArr = ownerDoc.context.lookup(dict.get(PDFName.of('Matrix')));
        if (matrixArr instanceof PDFArray && matrixArr.size() === 6) {
            const getNum = (i) => {
                const obj = ownerDoc.context.lookup(matrixArr.get(i));
                return obj && typeof obj.value === 'function' ? obj.value() : Number(obj);
            };
            const m1 = getNum(0),
                m2 = getNum(1),
                m3 = getNum(2),
                m4 = getNum(3),
                m5 = getNum(4),
                m6 = getNum(5);
            currentCTM = [
                m1 * currentCTM[0] + m2 * currentCTM[2],
                m1 * currentCTM[1] + m2 * currentCTM[3],
                m3 * currentCTM[0] + m4 * currentCTM[2],
                m3 * currentCTM[1] + m4 * currentCTM[3],
                m5 * currentCTM[0] + m6 * currentCTM[2] + currentCTM[4],
                m5 * currentCTM[1] + m6 * currentCTM[3] + currentCTM[5],
            ];
        }
    }

    let ctm = [...currentCTM];
    let stack = [];

    for (const stream of streams) {
        if (!(stream instanceof PDFRawStream)) continue;
        const data = getDecodedStreamContents(stream);
        let text = decodeBinaryToText(data);

        text = text
            .replace(/%.*(\r\n|\n|\r|$)/g, '')
            .replace(/BI[\s\S]*?EI/g, '')
            .replace(/<[0-9a-fA-F\s]*>/g, '');
        let prevText;
        do {
            prevText = text;
            text = text.replace(/\((?:[^)(]|\\[)(])*\)/g, '');
        } while (text !== prevText);

        const tokenRegex = /(q|Q|cm|Do|\/[A-Za-z0-9_.\-#]+|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
        let match;
        let buffer = [];

        while ((match = tokenRegex.exec(text)) !== null) {
            const token = match[0];
            buffer.push(token);
            if (buffer.length > 7) buffer.shift(); // 僅保留最近的 7 個 tokens 以節省記憶體

            const i = buffer.length - 1;
            if (token === 'q') stack.push([...ctm]);
            else if (token === 'Q') {
                if (stack.length > 0) ctm = stack.pop();
            } else if (token === 'cm' && i >= 6) {
                const m1 = parseFloat(buffer[i - 6]),
                    m2 = parseFloat(buffer[i - 5]),
                    m3 = parseFloat(buffer[i - 4]);
                const m4 = parseFloat(buffer[i - 3]),
                    m5 = parseFloat(buffer[i - 2]),
                    m6 = parseFloat(buffer[i - 1]);
                if (!isNaN(m1) && !isNaN(m6)) {
                    ctm = [
                        m1 * ctm[0] + m2 * ctm[2],
                        m1 * ctm[1] + m2 * ctm[3],
                        m3 * ctm[0] + m4 * ctm[2],
                        m3 * ctm[1] + m4 * ctm[3],
                        m5 * ctm[0] + m6 * ctm[2] + ctm[4],
                        m5 * ctm[1] + m6 * ctm[3] + ctm[5],
                    ];
                }
            } else if (token === 'Do' && i >= 1 && buffer[i - 1].startsWith('/')) {
                const name = buffer[i - 1].substring(1);
                let objRef = null;
                if (resourcesDict instanceof PDFDict) {
                    const xobjNode = resourcesDict.get(PDFName.of('XObject'));
                    if (xobjNode) {
                        const xobjs = ownerDoc.context.lookup(xobjNode);
                        if (xobjs instanceof PDFDict && xobjs.has(PDFName.of(name)))
                            objRef = xobjs.get(PDFName.of(name));
                    }
                }
                if (targetRefStr ? objRef && objRef.toString() === targetRefStr : name === cleanKeyName) return ctm;
                if (objRef) {
                    const xobj = ownerDoc.context.lookup(objRef);
                    const subtype =
                        xobj instanceof PDFRawStream
                            ? ownerDoc.context.lookup(xobj.dict.get(PDFName.of('Subtype')))
                            : null;
                    if (subtype instanceof PDFName && subtype.toString() === '/Form') {
                        const nestedResult = getCTMForXObject(
                            ownerDoc,
                            xobj,
                            cleanKeyName,
                            targetRefStr,
                            ctm,
                            resourcesDict
                        );
                        if (nestedResult) return nestedResult;
                    }
                }
            }
        }
    }
    return null;
}

/**
 * 在指定 Resources 中遞迴搜尋目標 Form XObject
 * @param {PDFObject|PDFDict} resourcesNode - 欲搜尋的 Resources 節點
 * @param {string} cleanKeyName - 目標 Form XObject 的鍵名 (不含斜線)
 * @param {PDFDocument} ownerDoc - 擁有該資源的 PDFDocument 實例
 * @param {Set<string>} [visited=new Set()] - 用於防止循環參照的已訪問集合
 * @returns {{ref: any, obj: any}|null} 找到的參照與物件，若無則回傳 null
 */
function findFormXObjectInResources(resourcesNode, cleanKeyName, ownerDoc, visited = new Set()) {
    if (!resourcesNode) return null;

    const resources = ownerDoc.context.lookup(resourcesNode);
    if (!(resources instanceof PDFDict)) return null;

    const xObjectsNode = resources.get(PDFName.of('XObject'));
    if (!xObjectsNode) return null;

    const xObjects = ownerDoc.context.lookup(xObjectsNode);
    if (!(xObjects instanceof PDFDict)) return null;

    const targetKey = PDFName.of(cleanKeyName);
    if (xObjects.has(targetKey)) {
        const ref = xObjects.get(targetKey);
        return { ref, obj: ownerDoc.context.lookup(ref) };
    }

    for (const key of xObjects.keys()) {
        const xObjRef = xObjects.get(key);
        if (!xObjRef) continue;

        const refStr = xObjRef.toString();
        if (visited.has(refStr)) continue;
        visited.add(refStr);

        const xObj = ownerDoc.context.lookup(xObjRef);
        if (!(xObj instanceof PDFRawStream)) continue;

        const subtype = ownerDoc.context.lookup(xObj.dict.get(PDFName.of('Subtype')));
        if (subtype instanceof PDFName && subtype.toString() === '/Form') {
            const nestedResourcesNode = xObj.dict.get(PDFName.of('Resources'));
            const nestedResult = findFormXObjectInResources(nestedResourcesNode, cleanKeyName, ownerDoc, visited);
            if (nestedResult) return nestedResult;
        }
    }

    return null;
}

/**
 * 共用輔助函式：確保頁面資源中存在預覽高亮專用的 ExtGState，用以設定紅框半透明度
 * @param {PDFDocument} previewDoc - 預覽用的 PDF 文件物件
 * @param {PDFPage} page - 欲繪製紅框的頁面物件
 * @param {string} extGStateName - 預期的 ExtGState 鍵名
 */
function ensurePreviewHighlightExtGState(previewDoc, page, extGStateName) {
    const config = PREVIEW_HIGHLIGHT_CONFIG;
    const extGStateDict = previewDoc.context.obj({
        Type: 'ExtGState',
        ca: config.fillOpacity,
        CA: config.borderOpacity,
    });

    let pageResources = previewDoc.context.lookup(page.node.get(PDFName.of('Resources')));
    if (!(pageResources instanceof PDFDict)) {
        pageResources = previewDoc.context.obj({});
        page.node.set(PDFName.of('Resources'), pageResources);
    }

    let extGState = previewDoc.context.lookup(pageResources.get(PDFName.of('ExtGState')));
    if (!(extGState instanceof PDFDict)) {
        extGState = previewDoc.context.obj({});
        pageResources.set(PDFName.of('ExtGState'), extGState);
    }
    extGState.set(PDFName.of(extGStateName), extGStateDict);
}

/**
 * 產生共用的預覽標示紅框原始繪圖指令 (供 XObject 預覽使用)
 * @param {PDFDocument} previewDoc - 預覽用的 PDF 文件物件
 * @param {PDFPage} page - 欲繪製紅框的頁面物件
 * @param {number} x - 矩形左下角 X 座標
 * @param {number} y - 矩形左下角 Y 座標
 * @param {number} width - 矩形寬度
 * @param {number} height - 矩形高度
 * @returns {string} 繪製矩形紅框的 PDF 內容串流指令字串
 */
function buildHighlightCommand(previewDoc, page, pathCmd) {
    const config = PREVIEW_HIGHLIGHT_CONFIG;
    const extGStateName = 'GsPreviewHighlight';

    ensurePreviewHighlightExtGState(previewDoc, page, extGStateName);

    const [r, g, b] = config.color;
    return `q /${extGStateName} gs\n${r} ${g} ${b} rg\n${r} ${g} ${b} RG\n${config.borderWidth} w\n${pathCmd}\nB\nQ`;
}

function getPreviewHighlightRawCommand(previewDoc, page, x, y, width, height) {
    return buildHighlightCommand(previewDoc, page, `${x} ${y} ${width} ${height} re`);
}

/**
 * 產生精準貼合的變換矩陣多邊形紅框 (支援任意旋轉與傾斜預覽)
 * @param {PDFDocument} previewDoc - 預覽用的 PDF 文件物件
 * @param {PDFPage} page - 欲繪製紅框的頁面物件
 * @param {Array<{x: number, y: number}>} pts - 多邊形的四個頂點座標陣列 (依序連接)
 * @returns {string} 繪製多邊形紅框的 PDF 內容串流指令字串
 */
function getPreviewHighlightPolygonCmd(previewDoc, page, pts) {
    const formatNum = (n) => Number(n.toFixed(6)).toString();
    const path = `${formatNum(pts[0].x)} ${formatNum(pts[0].y)} m\n${formatNum(pts[1].x)} ${formatNum(pts[1].y)} l\n${formatNum(pts[2].x)} ${formatNum(pts[2].y)} l\n${formatNum(pts[3].x)} ${formatNum(pts[3].y)} l\nh`;
    return buildHighlightCommand(previewDoc, page, path);
}

/**
 * 儲存預覽 PDF 文件並建立 Blob URL 以供即時預覽，同時將其加入快取清單以防記憶體洩漏
 * @param {PDFDocument} previewDoc - 已產生好預覽畫面的 PDF 文件物件
 * @returns {Promise<string>} Blob URL 網址
 */
async function saveAndCreatePreviewUrl(previewDoc) {
    const pdfBytes = await previewDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    previewUrlCache.push(url);
    return url;
}

/**
 * 建立供即時預覽用的隔離單頁 PDF 文件，並回傳對應的頁面資源與 XObject 字典
 * @param {PDFDocument} srcDoc - 原始 PDF 文件
 * @param {number} pageIndex - 欲複製的頁面索引
 * @returns {Promise<{previewDoc: PDFDocument, page: PDFPage, pageResources: PDFDict, xObjects: PDFDict}>}
 */
async function createIsolatedPreviewDoc(srcDoc, pageIndex) {
    const previewDoc = await PDFDocument.create();
    const [copiedPage] = await previewDoc.copyPages(srcDoc, [pageIndex]);
    const page = previewDoc.addPage(copiedPage);

    let pageResources = previewDoc.context.lookup(page.node.get(PDFName.of('Resources')));
    if (!(pageResources instanceof PDFDict)) {
        pageResources = previewDoc.context.obj({});
        page.node.set(PDFName.of('Resources'), pageResources);
    }

    let xObjects = previewDoc.context.lookup(pageResources.get(PDFName.of('XObject')));
    if (!(xObjects instanceof PDFDict)) {
        xObjects = previewDoc.context.obj({});
        pageResources.set(PDFName.of('XObject'), xObjects);
    }

    return { previewDoc, page, pageResources, xObjects };
}

/**
 * 將預覽繪圖指令套用至頁面，並產出 Blob URL
 * @param {PDFDocument} previewDoc - 預覽用的 PDF 文件
 * @param {PDFPage} page - 目標頁面
 * @param {string} drawCommand - PDF 內容串流繪製指令
 * @returns {Promise<string>} Blob URL
 */
async function applyPreviewContentAndSave(previewDoc, page, drawCommand) {
    const contentStream = previewDoc.context.stream(drawCommand);
    const contentStreamRef = previewDoc.context.register(contentStream);
    page.node.set(PDFName.of('Contents'), contentStreamRef);
    return await saveAndCreatePreviewUrl(previewDoc);
}

/**
 * 將矩陣陣列轉換為 PDF cm 指令字串
 * @param {number[]} matrix - 變換矩陣陣列
 * @returns {string} PDF cm 指令
 */
function formatMatrixToCm(matrix) {
    return `${matrix.map((n) => Number(n.toFixed(6)).toString()).join(' ')} cm`;
}

/**
 * 生成 Form XObject 的即時預覽 URL
 * @param {string} keyName - 資源鍵名
 * @param {number} pageIndex - 頁面索引 (0-indexed)
 * @returns {Promise<string>} Blob URL
 */
async function generateFormXObjectPreviewUrl(keyName, pageIndex) {
    const srcDoc = cachedPdfDocument || (await PDFDocument.load(cachedDecryptedBytes));
    const srcPage = srcDoc.getPage(pageIndex);
    // 安全清除可能重複的前綴斜線，防止產出 //Fm0 破壞 PDF 資源定址
    const cleanKeyName = keyName.replace(/^\//, '');

    // 1. 深入尋找該 Form XObject 的物件參照，支援 page Resource 與巢狀 Form Resource
    const foundForm = findFormXObjectInResources(srcPage.node.lookup(PDFName.of('Resources')), cleanKeyName, srcDoc);
    if (!foundForm || !foundForm.obj) {
        throw new Error('找不到該 Form 物件，無法產生預覽。');
    }
    const fmObj = foundForm.obj;

    // 2. 呼叫共用輔助函式：建立隔離沙盒頁面
    const { previewDoc, page, pageResources, xObjects } = await createIsolatedPreviewDoc(srcDoc, pageIndex);

    // 3. 如果目標 XObject 是巢狀定義在另一個 Form 內，把它補回頂層 XObject 字典中
    if (!xObjects.has(PDFName.of(cleanKeyName))) {
        const nestedRef = findFormXObjectInResources(pageResources, cleanKeyName, previewDoc);
        if (nestedRef && nestedRef.ref) {
            xObjects.set(PDFName.of(cleanKeyName), nestedRef.ref);
        }
    }

    const clonedFm = previewDoc.context.lookup(xObjects.get(PDFName.of(cleanKeyName)));
    if (clonedFm instanceof PDFRawStream) {
        clonedFm.dict.delete(PDFName.of('OC'));
    }

    // 取得 Form XObject 的 BBox 邊界，以便繪製紅框
    let targetRect = [0, 0, 100, 100]; // 預設尺寸
    if (fmObj instanceof PDFRawStream) {
        const bbox = fmObj.dict.lookup(PDFName.of('BBox'));
        if (bbox instanceof PDFArray && bbox.size() === 4) {
            targetRect = [bbox.get(0).value(), bbox.get(1).value(), bbox.get(2).value(), bbox.get(3).value()];
        }
    }

    const x0 = Math.min(targetRect[0], targetRect[2]);
    const y0 = Math.min(targetRect[1], targetRect[3]);
    const w = Math.abs(targetRect[2] - targetRect[0]);
    const h = Math.abs(targetRect[3] - targetRect[1]);

    // 取得共用的紅框描繪指令
    const boxCmd = getPreviewHighlightRawCommand(previewDoc, page, x0, y0, w, h);

    // 4. 嘗試從原頁面提取精準的累積變換矩陣 (CTM)，支援巢狀 Form 解析
    let matrix = getCTMForXObject(srcDoc, srcPage, cleanKeyName, foundForm.ref ? foundForm.ref.toString() : null);

    let drawCommand;
    if (matrix) {
        // 用精準計算的矩陣還原旋轉與平移！並在同一個座標系畫上紅框
        drawCommand = `q\n${formatMatrixToCm(matrix)}\n/${cleanKeyName} Do\n${boxCmd}\nQ`;
    } else {
        // Fallback：不再強制平移至 (0,0)，讓 XObject 保持在自己 BBox 的原始座標上
        // 同樣補上紅框
        drawCommand = `q /${cleanKeyName} Do \n${boxCmd}\nQ`;
    }

    return await applyPreviewContentAndSave(previewDoc, page, drawCommand);
}

/**
 * 生成 Image XObject 的即時預覽 URL
 * @param {string} keyName - 資源鍵名
 * @param {PDFRawStream} rawStream - 原始影像串流
 * @param {number} pageIndex - 頁面索引 (0-indexed)
 * @returns {Promise<string>} Blob URL
 */
async function generateImageXObjectPreviewUrl(keyName, rawStream, pageIndex) {
    const srcDoc = cachedPdfDocument || (await PDFDocument.load(cachedDecryptedBytes));
    const cleanKeyName = keyName.replace(/^\//, '');

    let targetRefStr = null;
    for (const [refStr, entry] of detectedImages.entries()) {
        if (entry.rawStream === rawStream && entry.pages.includes(pageIndex + 1)) {
            targetRefStr = refStr;
            break;
        }
    }

    let matrix = getCTMForXObject(srcDoc, srcDoc.getPage(pageIndex), cleanKeyName, targetRefStr);

    // Fail Fast: 提早檢查，若無法取得矩陣，直接中斷，避免下方耗費記憶體去建立預覽文件
    if (!matrix) {
        throw new Error('無法解析實際座標，無法產生預覽。');
    }

    const { previewDoc, page, xObjects } = await createIsolatedPreviewDoc(srcDoc, pageIndex);

    const uniqueKeyName = 'PreviewTargetImg';
    const clonedImg = previewDoc.context.register(rawStream.clone(previewDoc.context));
    xObjects.set(PDFName.of(uniqueKeyName), clonedImg);

    let drawCommand;
    let highlightCmd;

    const pts = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
    ].map((p) => ({
        x: matrix[0] * p.x + matrix[2] * p.y + matrix[4],
        y: matrix[1] * p.x + matrix[3] * p.y + matrix[5],
    }));

    highlightCmd = getPreviewHighlightPolygonCmd(previewDoc, page, pts);
    drawCommand = `q\n${formatMatrixToCm(matrix)}\n/${uniqueKeyName} Do\nQ\n${highlightCmd}`;

    return await applyPreviewContentAndSave(previewDoc, page, drawCommand);
}

/**
 * 生成 OCG (圖層) 移除效果的即時預覽 URL
 * 使用與實際清除引擎 (pdf-cleaner.js) 相同的物理移除邏輯，在獨立副本上操作，
 * 確保預覽結果與實際清除一致，且不會污染快取文件。
 * @param {string} ocgRefStr - OCG 物件參照字串
 * @returns {Promise<string>} Blob URL
 */
async function generateOCGPreviewUrl(ocgRefStr) {
    // 載入獨立副本，避免污染 cachedPdfDocument
    const previewDoc = await PDFDocument.load(cachedDecryptedBytes, { updateMetadata: false });
    const ocgsSet = new Set([ocgRefStr]);

    // 1. 全域層級：從 Catalog 的 OCProperties 中移除目標 OCG 條目
    removeOCG(previewDoc, ocgsSet);

    // 2. 頁面層級：逐頁移除 Properties、XObject 資源，並清理 Content Stream
    for (let pageIndex = 0; pageIndex < previewDoc.getPageCount(); pageIndex++) {
        const page = previewDoc.getPage(pageIndex);
        let resources = page.node.lookup(PDFName.of('Resources'));
        if (!(resources instanceof PDFDict)) continue;

        // 複製 Resources 以隔離修改
        if (resources.clone) {
            resources = resources.clone(previewDoc.context);
            page.node.set(PDFName.of('Resources'), resources);
        }

        const resOcg = removeOCGs(previewDoc, resources, ocgsSet);

        // 清理 Content Stream 中的 /OC /key BDC...EMC 區段
        if (resOcg.deletedPropertiesKeys && resOcg.deletedPropertiesKeys.length > 0) {
            cleanContentStreams(previewDoc, page, [], [], resOcg.deletedPropertiesKeys, false);
        }
    }

    return await saveAndCreatePreviewUrl(previewDoc);
}

/**
 * 生成 Annotation (註解) 的即時預覽 URL (高亮顯示所在位置)
 * @param {string} annotRefStr - 註解物件參照字串
 * @param {number} pageIndex - 頁面索引 (0-indexed)
 * @param {number} annotIndex - 註解在陣列中的索引
 * @returns {Promise<string>} Blob URL
 */
async function generateAnnotationPreviewUrl(annotRefStr, pageIndex, annotIndex) {
    try {
        const srcDoc = cachedPdfDocument || (await PDFDocument.load(cachedDecryptedBytes));
        const { previewDoc, page } = await createIsolatedPreviewDoc(srcDoc, pageIndex);
        const pageNode = page.node;

        const annots = pageNode.lookup(PDFName.of('Annots'));
        let targetRect = null;
        if (annots instanceof PDFArray) {
            const newAnnots = previewDoc.context.obj([]);
            for (let i = 0; i < annots.size(); i++) {
                const annotRef = annots.get(i);
                if (i === annotIndex) {
                    newAnnots.push(annotRef);
                    // 取得這個註解的 Rect 以便後續高亮標示
                    const annotDict = previewDoc.context.lookup(annotRef);
                    if (annotDict instanceof PDFDict) {
                        const rect = annotDict.lookup(PDFName.of('Rect'));
                        if (rect instanceof PDFArray && rect.size() === 4) {
                            targetRect = [
                                rect.get(0).value(),
                                rect.get(1).value(),
                                rect.get(2).value(),
                                rect.get(3).value(),
                            ];
                        }
                    }
                }
            }
            if (newAnnots.size() > 0) {
                pageNode.set(PDFName.of('Annots'), newAnnots);
            } else {
                pageNode.delete(PDFName.of('Annots'));
            }
        }

        let drawCommand = ' ';
        if (targetRect) {
            const x0 = Math.min(targetRect[0], targetRect[2]);
            const y0 = Math.min(targetRect[1], targetRect[3]);
            const w = Math.abs(targetRect[2] - targetRect[0]);
            const h = Math.abs(targetRect[3] - targetRect[1]);

            drawCommand = getPreviewHighlightRawCommand(previewDoc, page, x0, y0, w, h);
        }

        return await applyPreviewContentAndSave(previewDoc, page, drawCommand);
    } catch (error) {
        console.error('生成註解預覽時發生錯誤:', error);
        throw error;
    }
}

/**
 * 生成 Direct Content (頁面直接內容) 的即時預覽 URL
 * @param {string} streamRefStr - 串流參照字串
 * @param {number} pageIndex - 頁面索引 (0-indexed)
 * @param {number} streamIndex - 串流在 Contents 陣列中的索引
 * @returns {Promise<string>} Blob URL
 */
async function generateDirectContentPreviewUrl(streamRefStr, pageIndex, streamIndex) {
    const srcDoc = cachedPdfDocument || (await PDFDocument.load(cachedDecryptedBytes));
    const { previewDoc, page } = await createIsolatedPreviewDoc(srcDoc, pageIndex);

    const contentsKey = PDFName.of('Contents');
    const contents = previewDoc.context.lookup(page.node.get(contentsKey));
    if (contents instanceof PDFArray) {
        const newContents = previewDoc.context.obj([]);
        for (let i = 0; i < contents.size(); i++) {
            const streamRef = contents.get(i);
            if (i === streamIndex) {
                newContents.push(streamRef);
            }
        }
        page.node.set(contentsKey, newContents);
    }

    return await saveAndCreatePreviewUrl(previewDoc);
}

/**
 * 生成 TextBlocks (巨型文字區塊) 的即時預覽 URL
 * @param {number} pageIndex - 頁面索引 (0-indexed)
 * @returns {Promise<string>} Blob URL
 */
async function generateTextBlocksPreviewUrl(pageIndex) {
    const srcDoc = cachedPdfDocument || (await PDFDocument.load(cachedDecryptedBytes));
    const { previewDoc, page } = await createIsolatedPreviewDoc(srcDoc, pageIndex);

    // 套用 cleanContentStreams 僅移除此頁面的大型文字區塊
    if (typeof cleanContentStreams === 'function') {
        cleanContentStreams(previewDoc, page, [], [], [], true);
    }

    return await saveAndCreatePreviewUrl(previewDoc);
}

/**
 * 掃描完成後更新 UI：根據偵測結果顯示/隱藏策略列、自動勾選疑似浮水印策略，並給出掃描摘要提示。
 * @param {HTMLElement} optionsContainer - 策略選項容器 DOM 元素
 */
function updateScanResultUI(optionsContainer) {
    let anySuspected = false;

    STRATEGY_REGISTRY.forEach(({ rowId, map, destroyList, checkboxId }) => {
        // 根據偵測結果動態顯示或隱藏策略選項列
        document.getElementById(rowId).classList.toggle('hidden', map.size === 0);
        // 自動勾選：若有偵測到疑似浮水印的物件
        const checked = destroyList.length > 0;
        document.getElementById(checkboxId).checked = checked;
        if (checked) anySuspected = true;
    });

    // 顯示策略選項區塊
    optionsContainer.classList.remove('hidden');

    // 給出掃描結果摘要訊息
    if (!anySuspected) {
        addStatusMessage('掃描完成：未自動偵測到明顯的浮水印物件，您可以手動勾選合適的策略來嘗試清除。', 'info');
    } else {
        addStatusMessage('掃描完成：已自動勾選偵測到疑似浮水印的清除策略，您也可以手動調整。', 'success');
    }
}

/**
 * 讀取原始位元組，嘗試偵測是否有開啟密碼並進行解密
 * @param {File} file - 使用者上傳的原始 PDF 檔案
 * @returns {Promise<{previewBytes: Uint8Array, needsPassword: boolean, decryptedSuccessfully: boolean}>} 解密狀態與位元組結果
 */
async function loadAndDecryptPdf(file) {
    const rawBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);

    let previewBytes = rawBytes; // 預設使用原始位元組作為預覽來源
    let needsPassword = false;
    let decryptedSuccessfully = false;

    try {
        const testDoc = await PDFDocument.load(rawBytes, { updateMetadata: false });
        testDoc.getPageCount(); // 觸發 lazy-parsing
        cachedDecryptedBytes = rawBytes;
    } catch {
        try {
            const decrypted = await decryptWithQpdfWasm(rawBytes, '');
            cachedDecryptedBytes = decrypted;
            previewBytes = decrypted;
            addStatusMessage('⚠️ 偵測到編輯權限限制，已自動解除。', 'info');
        } catch {
            needsPassword = true;
        }
    }

    if (needsPassword) {
        if (lastSuccessPassword) {
            try {
                addStatusMessage('🔒 偵測到開啟密碼保護，嘗試套用前次成功解密的記憶體密碼...', 'info');
                const decrypted = await decryptWithQpdfWasm(rawBytes, lastSuccessPassword);
                const testDoc = await PDFDocument.load(decrypted, { updateMetadata: false });
                testDoc.getPageCount();

                cachedPassword = lastSuccessPassword;
                cachedDecryptedBytes = decrypted;
                previewBytes = decrypted;
                decryptedSuccessfully = true;
                addStatusMessage('🔓 已自動套用前次使用的密碼並解密成功！', 'success');
            } catch {
                addStatusMessage('⚠️ 前次密碼不適用於此檔案，請重新輸入密碼。', 'info');
            }
        }

        if (!decryptedSuccessfully) {
            addStatusMessage('🔒 此 PDF 設有開啟密碼，請輸入密碼以繼續。', 'info');
            let attempts = 0;
            const MAX_ATTEMPTS = 5;
            while (attempts < MAX_ATTEMPTS) {
                const pwd = await promptForPassword(attempts > 0);
                if (pwd === null) {
                    addStatusMessage('已取消密碼輸入。如需繼續處理，請重新選擇 PDF 並輸入密碼。', 'info');
                    break;
                }
                attempts++;
                try {
                    const decrypted = await decryptWithQpdfWasm(rawBytes, pwd);
                    const testDoc = await PDFDocument.load(decrypted, { updateMetadata: false });
                    testDoc.getPageCount();

                    cachedPassword = pwd;
                    lastSuccessPassword = pwd;
                    cachedDecryptedBytes = decrypted;
                    previewBytes = decrypted;
                    decryptedSuccessfully = true;
                    addStatusMessage('🔓 密碼驗證成功，已解除開啟密碼保護。', 'success');
                    break;
                } catch {
                    // 密碼錯誤，繼續迴圈
                }
            }

            if (!decryptedSuccessfully && attempts >= MAX_ATTEMPTS) {
                addStatusMessage(
                    `您已連續輸入錯誤密碼達 ${MAX_ATTEMPTS} 次，為保護效能與避免暴力破解，請重新選擇檔案再試。`,
                    'error'
                );
                // 關閉輸入彈窗（若仍顯示）
                const pwdModal = document.getElementById('passwordModal');
                if (pwdModal) pwdModal.classList.remove('active');
            }
        }
    }

    return { previewBytes, needsPassword, decryptedSuccessfully };
}

/**
 * 掃描並記錄 PDF 中的選擇性內容群組 (OCG)
 * @param {PDFDocument} scanDoc - 欲掃描的 PDFDocument 實例
 */
function scanOCG(scanDoc) {
    const catalogDict = scanDoc.catalog;

    const ocPropertiesRef = catalogDict.get(PDFName.of('OCProperties'));
    const ocProperties = scanDoc.context.lookup(ocPropertiesRef);
    if (!(ocProperties instanceof PDFDict)) return;

    const ocgsRef = ocProperties.get(PDFName.of('OCGs'));
    if (!ocgsRef) return;

    const ocgs = scanDoc.context.lookup(ocgsRef);
    if (!(ocgs instanceof PDFArray)) return;

    for (let i = 0; i < ocgs.size(); i += 1) {
        const ocgRef = ocgs.get(i);
        const ocgRefStr = ocgRef.toString();
        const ocg = scanDoc.context.lookup(ocgRef);
        if (ocg instanceof PDFDict) {
            const nameObject = ocg.lookup(PDFName.of('Name'));
            if (nameObject instanceof PDFString || nameObject instanceof PDFHexString) {
                const name = nameObject.decodeText();
                registerSuspectEntry(detectedOCGs, ocgRefStr, { name: name, ref: ocgRef }, isSuspectOCG, ocgsToDestroy);
            }
        }
    }
}

/**
 * 掃描並記錄指定頁面中的註解 (Annotations)
 * @param {PDFDocument} scanDoc - 欲掃描的 PDFDocument 實例
 * @param {PDFPage} page - 目標頁面物件
 * @param {number} pageIndex - 頁面索引 (0-based)
 */
function scanAnnotations(scanDoc, page, pageIndex) {
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (!(annots instanceof PDFArray)) return;

    for (let i = 0; i < annots.size(); i++) {
        const annotRef = annots.get(i);
        const annot = scanDoc.context.lookup(annotRef);
        if (annot instanceof PDFDict) {
            const subtype = scanDoc.context.lookup(annot.get(PDFName.of('Subtype')));
            if (subtype instanceof PDFName) {
                const subtypeStr = subtype.toString().replace(/^\//, '');
                const annotRefStr = annotRef.toString();

                registerSuspectEntry(
                    detectedAnnotations,
                    annotRefStr,
                    { subtype: subtypeStr, page: pageIndex + 1, ref: annotRef, annotIndex: i },
                    isSuspectAnnotation,
                    annotsToDestroy
                );
            }
        }
    }
}

/**
 * 輔助函式：註冊或更新跨頁的 XObject (共用於 Form 與 Image)
 * @param {Map} detectedMap - 目標偵測 Map
 * @param {string} refStr - 物件參照字串
 * @param {number} pageIndex - 當前頁面索引 (0-based)
 * @param {Function} createEntryFn - 建立新 entry 的回呼函式
 * @param {Function} isSuspectFn - 判斷是否為浮水印的回呼函式
 * @param {string[]} destroyList - 待刪除清單
 */
function registerOrUpdateXObject(detectedMap, refStr, pageIndex, createEntryFn, isSuspectFn, destroyList) {
    if (!detectedMap.has(refStr)) {
        const entry = createEntryFn();
        detectedMap.set(refStr, entry);
        if (isSuspectFn(entry)) {
            if (!destroyList.includes(refStr)) destroyList.push(refStr);
        }
    } else {
        const entry = detectedMap.get(refStr);
        if (entry && !entry.pages.includes(pageIndex + 1)) {
            entry.pages.push(pageIndex + 1);
        }
    }
}

/**
 * 輔助函式：註冊偵測到的物件並判斷是否為浮水印 (供單頁/全域物件共用)
 * @param {Map} detectedMap - 目標偵測 Map
 * @param {string} key - 物件鍵值或識別碼
 * @param {Object} entry - 物件資料實體
 * @param {Function} isSuspectFn - 判斷是否為浮水印的回呼函式
 * @param {string[]} destroyList - 待刪除清單
 */
function registerSuspectEntry(detectedMap, key, entry, isSuspectFn, destroyList) {
    detectedMap.set(key, entry);
    if (isSuspectFn(entry)) {
        if (!destroyList.includes(key)) destroyList.push(key);
    }
}

/**
 * 掃描並記錄指定頁面中的資源 (Resources)，包含 XObject 與 ExtGState
 * @param {PDFDocument} scanDoc - 欲掃描的 PDFDocument 實例
 * @param {PDFPage} page - 目標頁面物件
 * @param {number} pageIndex - 頁面索引 (0-based)
 */
function scanResources(scanDoc, page, pageIndex) {
    const scannedRefs = new Set();

    /**
     * 內部遞迴函式：深入遍歷 Resources 節點，找出並註冊可疑的 XObject 與 ExtGState 物件
     * @param {PDFObject|PDFDict} resourcesNode - 欲掃描的 Resources 節點
     * @returns {void}
     */
    function traverseResources(resourcesNode) {
        if (!resourcesNode) return;
        const resources = scanDoc.context.lookup(resourcesNode);
        if (!(resources instanceof PDFDict)) return;

        const xObjectsNode = resources.get(PDFName.of('XObject'));
        if (xObjectsNode) {
            const xObjects = scanDoc.context.lookup(xObjectsNode);
            if (xObjects instanceof PDFDict) {
                for (const key of xObjects.keys()) {
                    const xObjRef = xObjects.get(key);
                    if (!xObjRef) continue;

                    // 避免循環參照
                    if (scannedRefs.has(xObjRef)) continue;
                    scannedRefs.add(xObjRef);

                    const xObj = scanDoc.context.lookup(xObjRef);
                    const subtype =
                        xObj instanceof PDFRawStream
                            ? scanDoc.context.lookup(xObj.dict.get(PDFName.of('Subtype')))
                            : null;
                    if (subtype instanceof PDFName) {
                        const refStr = xObjRef.toString();
                        const keyName = key.value();

                        if (subtype.toString() === '/Form' && xObj instanceof PDFRawStream) {
                            try {
                                const data = getDecodedStreamContents(xObj);
                                const rawStr = decodeBinaryToText(data);

                                registerOrUpdateXObject(
                                    detectedFormXObjects,
                                    refStr,
                                    pageIndex,
                                    () => ({ keyName: keyName, pages: [pageIndex + 1], rawStr: rawStr, ref: xObjRef }),
                                    (entry) => isSuspectFormXObject(entry, rawStr),
                                    formXObjectsToDestroy
                                );

                                // 遞迴掃描巢狀 Form XObject 內部的 Resources
                                const formResourcesNode = xObj.dict.get(PDFName.of('Resources'));
                                if (formResourcesNode) {
                                    traverseResources(formResourcesNode);
                                }
                            } catch (e) {
                                console.debug('Form XObject 解碼失敗（可忽略）', e);
                            }
                        }
                        if (subtype.toString() === '/Image' && xObj instanceof PDFRawStream) {
                            const widthObj = scanDoc.context.lookup(xObj.dict.get(PDFName.of('Width')));
                            const heightObj = scanDoc.context.lookup(xObj.dict.get(PDFName.of('Height')));
                            const filterObj = scanDoc.context.lookup(xObj.dict.get(PDFName.of('Filter')));

                            const width = widthObj && typeof widthObj.value === 'function' ? widthObj.value() : '未知';
                            const height =
                                heightObj && typeof heightObj.value === 'function' ? heightObj.value() : '未知';
                            const filterStr = filterObj ? filterObj.toString() : 'RAW';

                            registerOrUpdateXObject(
                                detectedImages,
                                refStr,
                                pageIndex,
                                () => ({
                                    keyName: keyName,
                                    width: width,
                                    height: height,
                                    filterStr: filterStr,
                                    pages: [pageIndex + 1],
                                    ref: xObjRef,
                                    rawStream: xObj,
                                }),
                                (entry) => isSuspectKeyName(entry.keyName),
                                imagesToDestroy
                            );
                        }
                    }
                }
            }
        }

        const extGStateNode = resources.get(PDFName.of('ExtGState'));
        if (extGStateNode) {
            const extGState = scanDoc.context.lookup(extGStateNode);
            if (extGState instanceof PDFDict) {
                for (const key of extGState.keys()) {
                    const keyName = key.value();
                    const gsObj = scanDoc.context.lookup(extGState.get(key));

                    let details = [];
                    let fillOpacity = 1.0,
                        strokeOpacity = 1.0;
                    if (gsObj instanceof PDFDict) {
                        const ca = gsObj.get(PDFName.of('ca'));
                        const CA = gsObj.get(PDFName.of('CA'));
                        const BM = gsObj.get(PDFName.of('BM'));
                        if (ca !== undefined) {
                            details.push(`ca: ${ca.toString()}`);
                            if (typeof ca.value === 'function') fillOpacity = ca.value();
                        }
                        if (CA !== undefined) {
                            details.push(`CA: ${CA.toString()}`);
                            if (typeof CA.value === 'function') strokeOpacity = CA.value();
                        }
                        if (BM !== undefined) details.push(`BM: ${BM.toString()}`);
                    }
                    const detailText = details.length > 0 ? details.join(', ') : '無透明度細節設定';
                    const uniqueKey = `${pageIndex}:${keyName}`;

                    registerSuspectEntry(
                        detectedExtGStates,
                        uniqueKey,
                        {
                            keyName: keyName,
                            detailText: detailText,
                            page: pageIndex + 1,
                            ref: gsObj,
                            fillOpacity: fillOpacity,
                            strokeOpacity: strokeOpacity,
                        },
                        isSuspectExtGState,
                        extGStatesToDestroy
                    );
                }
            }
        }
    }

    // 啟動第一層的資源掃描
    traverseResources(page.node.lookup(PDFName.of('Resources')));
}

/**
 * 掃描並記錄指定頁面中的直接內容 (Direct Content)
 * @param {PDFDocument} scanDoc - 欲掃描的 PDFDocument 實例
 * @param {PDFPage} page - 目標頁面物件
 * @param {number} pageIndex - 頁面索引 (0-based)
 */
function scanDirectContent(scanDoc, page, pageIndex) {
    // page.node.lookup 已會自動解析 PDFRef，無需再外包一層 scanDoc.context.lookup (減少冗餘查詢)
    const contents = page.node.lookup(PDFName.of('Contents'));
    if (!contents) return;

    const streams = [];
    if (contents instanceof PDFArray) {
        for (let i = 0; i < contents.size(); i++) {
            streams.push({ item: scanDoc.context.lookup(contents.get(i)), index: i });
        }
    } else {
        streams.push({ item: contents, index: null });
    }

    streams.forEach((entry) => {
        const stream = entry.item;
        if (stream instanceof PDFRawStream) {
            let streamRef =
                contents instanceof PDFArray ? contents.get(entry.index) : page.node.get(PDFName.of('Contents'));
            if (streamRef) {
                const refStr = streamRef.toString();
                try {
                    const data = getDecodedStreamContents(stream);
                    const rawStr = decodeBinaryToText(data);

                    registerSuspectEntry(
                        detectedDirectContents,
                        refStr,
                        {
                            page: pageIndex + 1,
                            ref: streamRef,
                            rawText: rawStr,
                            streamIndex: entry.index,
                        },
                        isSuspectDirectContent,
                        directContentsToDestroy
                    );

                    // 策略 5：巨型文字區塊偵測
                    if (isSuspectTextBlock(rawStr)) {
                        const pageKey = `page_${pageIndex}`;
                        if (!detectedTextBlocks.has(pageKey)) {
                            detectedTextBlocks.set(pageKey, { page: pageIndex + 1 });
                            textBlocksToDestroy.push(pageKey); // 預設自動勾選
                        }
                    }
                } catch (e) {
                    console.error('Direct content parse error', e);
                }
            }
        }
    });
}

/**
 * 輔助函式：套用高頻特徵門檻 (Heuristic Threshold) 判定
 * 共用於 Form XObject 與 Image XObject 的智慧偵測
 * @param {Map} detectedMap - 偵測到的物件 Map
 * @param {string[]} destroyList - 待刪除的目標陣列
 * @param {number} threshold - 頻率門檻 (0~1)
 * @param {number} pageCount - 總頁數
 */
function applyHeuristicThreshold(detectedMap, destroyList, threshold, pageCount) {
    for (const [refStr, entry] of detectedMap.entries()) {
        if (entry.pages.length / pageCount >= threshold) {
            entry.isHeuristic = true;
            if (!destroyList.includes(refStr)) {
                destroyList.push(refStr);
            }
        }
    }
}

/**
 * 進行背景高速掃描以找出 PDF 中可能包含浮水印的物件
 * @param {PDFDocument} scanDoc - 欲掃描的 PDFDocument 實例
 */
async function performBackgroundScan(scanDoc) {
    scanOCG(scanDoc);

    const pageCount = scanDoc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
        const page = scanDoc.getPage(i);
        scanAnnotations(scanDoc, page, i);
        scanResources(scanDoc, page, i);
        scanDirectContent(scanDoc, page, i);

        // 每處理 5 頁讓出一次主執行緒 (Time Slicing)，避免大檔掃描時瀏覽器畫面凍結
        if (i > 0 && i % 5 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    // --- 啟發式高頻率出現智慧偵測 (Heuristic Auto-Detect) ---
    if (pageCount > 1) {
        const threshold = HEURISTIC_THRESHOLD;

        // 共用邏輯：套用高頻偵測於 Form 與 Image XObjects
        applyHeuristicThreshold(detectedFormXObjects, formXObjectsToDestroy, threshold, pageCount);
        applyHeuristicThreshold(detectedImages, imagesToDestroy, threshold, pageCount);
    }
}

/**
 * 載入新 PDF 後立即偵測加密狀態，若需要開啟密碼則向使用者詢問，
 * 並將解密後的位元組與密碼快取，最後顯示預覽。
 * @param {File} file - 使用者上傳的原始 PDF 檔案
 */
async function prepareScanContext(file) {
    // 0. 主動清空並重置所有舊狀態（含密碼快取）
    resetAllState();

    const { previewBytes, needsPassword, decryptedSuccessfully } = await loadAndDecryptPdf(file);

    // 進行背景高速掃描以找出 PDF 中可能包含浮水印的物件
    if (!needsPassword || decryptedSuccessfully) {
        try {
            // 將 scanDoc 快取至全域變數，供物件預覽時直接取用，節省反覆解析的時間
            cachedPdfDocument = await PDFDocument.load(previewBytes, { updateMetadata: false });
            await performBackgroundScan(cachedPdfDocument);
        } catch (scanErr) {
            console.error('背景掃描失敗', scanErr);
        }
    }

    // 更新 UI 選項顯示狀態
    if (!needsPassword || decryptedSuccessfully) {
        updateScanResultUI(optionsContainer);
    }

    return { previewBytes, needsPassword, decryptedSuccessfully };
}

/**
 * 將解密後的 PDF 內容轉為 Blob 並顯示於畫面上的預覽 iframe 中。
 * @param {Uint8Array} bytes - 欲預覽的 PDF 位元組陣列
 * @param {boolean} needsPassword - 原檔案是否需要密碼
 * @param {boolean} decryptedSuccessfully - 是否已成功解密
 */
function renderPreview(bytes, needsPassword, decryptedSuccessfully) {
    // 3. 建立 Blob URL 並顯示預覽
    const blob = new Blob([bytes], { type: 'application/pdf' });

    // 4. 顯示預覽容器，並隱藏上一次的「處理後」預覽窗格
    previewContainer.classList.remove('hidden');

    originalUrl = URL.createObjectURL(blob);
    originalPreview.src = originalUrl;

    // 5. 只有在無加密，或已成功解密的情況下，才顯示「開始清除浮水印」按鈕
    if (!needsPassword || decryptedSuccessfully) {
        processButton.classList.remove('hidden');
    }
}
