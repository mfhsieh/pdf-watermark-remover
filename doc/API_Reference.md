# PDF Watermark Remover 核心模組 API 文件

## Classes

<dl>
<dt><a href="#WatermarkStrategyModal">WatermarkStrategyModal</a></dt>
<dd><p>浮水印清除策略設定彈出視窗 (Modal) 抽象化通用管理類別</p>
<p>此類別採用統一的封裝設計，負責管理 6 種不同清除策略的彈出設定視窗，
包含視窗開關、條列式 Checkbox 的動態渲染、回復預設值、套用設定以及與主畫面勾選狀態的雙向連動。</p>
</dd>
</dl>

## Members

<dl>
<dt><a href="#WATERMARK_KEY_KEYWORDS">WATERMARK_KEY_KEYWORDS</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>全域資源鍵名關鍵字清單</p>
</dd>
<dt><a href="#WATERMARK_CONTENT_KEYWORDS">WATERMARK_CONTENT_KEYWORDS</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>全域內容文字關鍵字清單</p>
</dd>
<dt><a href="#FINAL_CONTENT_KEYWORDS">FINAL_CONTENT_KEYWORDS</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>編譯後的最終高精度比對字串庫</p>
</dd>
<dt><a href="#TRANSPARENCY_THRESHOLD">TRANSPARENCY_THRESHOLD</a> : <code>number</code></dt>
<dd><p>全域高透明度特徵門檻</p>
</dd>
<dt><a href="#HEURISTIC_THRESHOLD">HEURISTIC_THRESHOLD</a> : <code>number</code></dt>
<dd><p>高頻率出現門檻 (0~1)</p>
</dd>
<dt><a href="#selectedFile">selectedFile</a> : <code>File</code> | <code>null</code></dt>
<dd><p>目前使用者選取上傳的 PDF 檔案實體 (File)</p>
</dd>
<dt><a href="#originalUrl">originalUrl</a> : <code>string</code> | <code>null</code></dt>
<dd><p>原始 PDF 於瀏覽器端動態建立的 Blob URL</p>
</dd>
<dt><a href="#processedUrl">processedUrl</a> : <code>string</code> | <code>null</code></dt>
<dd><p>處理後 PDF 於瀏覽器端動態建立的 Blob URL</p>
</dd>
<dt><a href="#cachedPassword">cachedPassword</a> : <code>string</code> | <code>null</code></dt>
<dd><p>本次選檔後使用者輸入的開啟密碼快取（換檔時清除）</p>
</dd>
<dt><a href="#cachedDecryptedBytes">cachedDecryptedBytes</a> : <code>Uint8Array</code> | <code>null</code></dt>
<dd><p>使用密碼解密後的 PDF 位元組快取（換檔時清除）</p>
</dd>
<dt><a href="#cachedPdfDocument">cachedPdfDocument</a> : <code>PDFDocument</code> | <code>null</code></dt>
<dd><p>解析完成的原始 PDFDocument 實例快取（提升預覽效能）</p>
</dd>
<dt><a href="#previewUrlCache">previewUrlCache</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>預覽 Blob URL 快取（換檔時清除）</p>
</dd>
<dt><a href="#lastSuccessPassword">lastSuccessPassword</a> : <code>string</code> | <code>null</code></dt>
<dd><p>跨檔案成功解密的開啟密碼暫存（執行期記憶體快取，不落地儲存）</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#DEFAULT_KEY_KEYWORDS">DEFAULT_KEY_KEYWORDS</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>預設的資源鍵名與圖層名稱關鍵字</p>
</dd>
<dt><a href="#DEFAULT_CONTENT_KEYWORDS">DEFAULT_CONTENT_KEYWORDS</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>預設的實際內容文字關鍵字</p>
</dd>
<dt><a href="#detectedFormXObjects">detectedFormXObjects</a> : <code>Map.&lt;string, string&gt;</code></dt>
<dd><p>偵測到的表單外部物件 (key = raw stream text, value = extracted display string)</p>
</dd>
<dt><a href="#formXObjectsToDestroy">formXObjectsToDestroy</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>儲存使用者勾選要刪除的 raw stream text</p>
</dd>
<dt><a href="#detectedAnnotations">detectedAnnotations</a> : <code>Map.&lt;string, any&gt;</code></dt>
<dd><p>當前 PDF 檔案中偵測到的所有註解實例（key = annotRefStr）</p>
</dd>
<dt><a href="#annotsToDestroy">annotsToDestroy</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>要刪除的特定註解參照 (annotRefStr) 清單</p>
</dd>
<dt><a href="#detectedDirectContents">detectedDirectContents</a> : <code>Map.&lt;string, {page: number, ref: any, rawText: string, streamIndex: number}&gt;</code></dt>
<dd><p>頁面直接內容狀態（key = streamRefStr）</p>
</dd>
<dt><a href="#directContentsToDestroy">directContentsToDestroy</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>儲存選定要清空的頁面直接內容參照字串</p>
</dd>
<dt><a href="#detectedImages">detectedImages</a> : <code>Map.&lt;string, {keyName: string, pages: Array.&lt;number&gt;, ref: any, rawStream: string, width: number, height: number, filterStr: string}&gt;</code></dt>
<dd><p>影像外部物件狀態（key = refStr）</p>
</dd>
<dt><a href="#imagesToDestroy">imagesToDestroy</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>儲存選定要清除的影像外部物件鍵值</p>
</dd>
<dt><a href="#detectedExtGStates">detectedExtGStates</a> : <code>Map.&lt;string, {keyName: string, page: number, ref: any, detailText: string, fillOpacity: number, strokeOpacity: number}&gt;</code></dt>
<dd><p>延伸圖形狀態（key = <code>${page}:${name}</code>）</p>
</dd>
<dt><a href="#extGStatesToDestroy">extGStatesToDestroy</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>儲存選定要清除的延伸圖形狀態鍵值</p>
</dd>
<dt><a href="#detectedOCGs">detectedOCGs</a> : <code>Map.&lt;string, {name: string, ref: any}&gt;</code></dt>
<dd><p>選擇性內容群組狀態（key = ocgRefStr）</p>
</dd>
<dt><a href="#ocgsToDestroy">ocgsToDestroy</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>儲存選定要隱藏的 OCG 參照字串</p>
</dd>
<dt><a href="#STRATEGY_REGISTRY">STRATEGY_REGISTRY</a></dt>
<dd><p>STRATEGY_REGISTRY 將各種清理策略封裝註冊。
注意：由於是以參照(Reference)方式綁定 <code>map</code> 與 <code>destroyList</code>，
這些陣列和 Map 必須定義為 <code>const</code>，在清空時使用 <code>.clear()</code> 或 <code>.length = 0</code>，
絕對不可重新賦值（如 <code>map = new Map()</code>），否則會導致此處的參照斷裂。</p>
</dd>
<dt><a href="#annotSubtypeMeta">annotSubtypeMeta</a> : <code>Object.&lt;string, {label: string, color: string}&gt;</code></dt>
<dd><p>註解 (Annotation) 子類型元資料設定</p>
</dd>
<dt><a href="#fileInput">fileInput</a> : <code>HTMLInputElement</code></dt>
<dd><p>檔案輸入元素</p>
</dd>
<dt><a href="#fileArea">fileArea</a> : <code>HTMLElement</code></dt>
<dd><p>檔案拖曳與顯示區域</p>
</dd>
<dt><a href="#fileAreaInner">fileAreaInner</a> : <code>HTMLElement</code></dt>
<dd><p>檔案區域內部容器</p>
</dd>
<dt><a href="#statusEl">statusEl</a> : <code>HTMLElement</code></dt>
<dd><p>狀態訊息顯示區塊</p>
</dd>
<dt><a href="#processButton">processButton</a> : <code>HTMLButtonElement</code></dt>
<dd><p>執行處理按鈕</p>
</dd>
<dt><a href="#downloadArea">downloadArea</a> : <code>HTMLElement</code></dt>
<dd><p>下載區域區塊</p>
</dd>
<dt><a href="#downloadLink">downloadLink</a> : <code>HTMLAnchorElement</code></dt>
<dd><p>下載連結元素</p>
</dd>
<dt><a href="#optionsContainer">optionsContainer</a> : <code>HTMLElement</code></dt>
<dd><p>清理選項容器</p>
</dd>
<dt><a href="#previewContainer">previewContainer</a> : <code>HTMLElement</code></dt>
<dd><p>雙欄預覽容器</p>
</dd>
<dt><a href="#originalPreview">originalPreview</a> : <code>HTMLIFrameElement</code></dt>
<dd><p>原始 PDF 預覽 iframe</p>
</dd>
<dt><a href="#processedPreviewBox">processedPreviewBox</a> : <code>HTMLElement</code></dt>
<dd><p>處理後預覽區塊容器</p>
</dd>
<dt><a href="#processedPreview">processedPreview</a> : <code>HTMLIFrameElement</code></dt>
<dd><p>處理後 PDF 預覽 iframe</p>
</dd>
<dt><a href="#objectPreviewModal">objectPreviewModal</a> : <code>HTMLElement</code></dt>
<dd><p>物件預覽彈窗元素</p>
</dd>
<dt><a href="#objectPreviewTitle">objectPreviewTitle</a> : <code>HTMLElement</code></dt>
<dd><p>物件預覽彈窗標題</p>
</dd>
<dt><a href="#objectPreviewSpinner">objectPreviewSpinner</a> : <code>HTMLElement</code></dt>
<dd><p>物件預覽載入中指示器</p>
</dd>
<dt><a href="#objectPreviewIframe">objectPreviewIframe</a> : <code>HTMLIFrameElement</code></dt>
<dd><p>物件預覽 iframe</p>
</dd>
<dt><a href="#streamDecodeCache">streamDecodeCache</a> : <code>WeakMap.&lt;PDFRawStream, Uint8Array&gt;</code></dt>
<dd><p>內容串流解碼快取，用於降低大檔重複掃描的效能開銷</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#verifyPdfMagicNumber">verifyPdfMagicNumber(file)</a> ⇒ <code>Promise.&lt;boolean&gt;</code></dt>
<dd><p>驗證檔案是否為 PDF (透過檢查 Magic Number)</p>
</dd>
<dt><a href="#handleFileSelected">handleFileSelected(file)</a> ⇒ <code>void</code></dt>
<dd><p>共用輔助函式：當使用者選取檔案後，統一執行 UI 更新與背景掃描</p>
</dd>
<dt><a href="#formatBytes">formatBytes(bytes)</a> ⇒ <code>string</code></dt>
<dd><p>輔助函式：格式化檔案大小單位</p>
</dd>
<dt><a href="#updateFileAreaDisplay">updateFileAreaDisplay()</a> ⇒ <code>void</code></dt>
<dd><p>依據目前選取的 selectedFile 更新拖曳上傳區域的文字顯示。</p>
</dd>
<dt><a href="#getOptions">getOptions()</a> ⇒ <code>Object.&lt;string, boolean&gt;</code></dt>
<dd><p>取得目前畫面中 checkbox 勾選的清理選項</p>
</dd>
<dt><a href="#buildFinalContentKeywords">buildFinalContentKeywords()</a> ⇒ <code>void</code></dt>
<dd><p>根據目前的 WATERMARK_CONTENT_KEYWORDS 建立最終的多重編碼比對特徵碼陣列</p>
</dd>
<dt><a href="#loadGlobalKeywords">loadGlobalKeywords()</a> ⇒ <code>void</code></dt>
<dd><p>載入並初始化全域關鍵字設定（從 localStorage 讀取或使用預設值）</p>
</dd>
<dt><a href="#saveGlobalKeywords">saveGlobalKeywords(keysArray, contentsArray, threshold, heuristicThreshold)</a> ⇒ <code>void</code></dt>
<dd><p>儲存全域設定至 localStorage</p>
</dd>
<dt><a href="#safeRemoveFromDictionary">safeRemoveFromDictionary(pdfDoc, resources, dictKey, targetDict, targetRef, keysToRemove)</a> ⇒ <code>void</code></dt>
<dd><p>安全地從 PDFDict 資源字典中移除指定鍵值
若原字典已被多頁共用，會先進行 clone 以隔離修改。</p>
</dd>
<dt><a href="#removeDeletedReferencesFromText">removeDeletedReferencesFromText(text, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys)</a> ⇒ <code>Object</code></dt>
<dd><p>共用的字串置換輔助函式，用於從 Content Stream 中移除對已刪除資源的參照 (如 Do, gs, OCG)</p>
</dd>
<dt><a href="#rebuildStreamWithoutReferences">rebuildStreamWithoutReferences(pdfDoc, stream, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys)</a> ⇒ <code>PDFRawStream</code> | <code>null</code></dt>
<dd><p>共用串流重構邏輯：解碼二進位串流，抹除已刪除資源的參照指令，並重構為新的 PDFRawStream。
若內容有被修改，則回傳重構後的新串流，否則回傳 null。</p>
</dd>
<dt><a href="#cleanContentStreams">cleanContentStreams(pdfDoc, page, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys)</a> ⇒ <code>void</code></dt>
<dd><p>清理 content stream 中對已刪除資源的參考，防止 Acrobat Reader 報錯</p>
</dd>
<dt><a href="#processPdf">processPdf(pdfDoc, options)</a> ⇒ <code>Object</code></dt>
<dd><p>核心重構清除引擎：遍歷 PDF 物件樹並執行浮水印置換</p>
<p>為了防止直接刪除 PDF 字典物件導致內部資源樹引用斷裂（引發 PDF 檔損毀打不開），
本清除引擎採用「無損清除技術」—— 將需要清除的物件從資源字典中移除，
並主動清理 Content Stream 中的參照 (如 <code>Do</code>, <code>gs</code>)，確保 PDF 結構完整，防止 Acrobat Reader 報錯。
同時執行單頁資源隔離複製，確保頁面間的修改不互相干擾。</p>
</dd>
<dt><a href="#cleanResourcesRecursively">cleanResourcesRecursively(pdfDoc, resources, pageIndex, options, destroySets, allDeletedXObjectKeys, allDeletedExtGStateKeys, allDeletedOcgKeys)</a> ⇒ <code>number</code></dt>
<dd><p>遞迴清理 Resources (支援巢狀 Form XObject)</p>
</dd>
<dt><a href="#cleanFormXObjectStream">cleanFormXObjectStream(pdfDoc, xObjRef, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys)</a> ⇒ <code>void</code></dt>
<dd><p>專門用於清理 Form XObject 內部 Content Stream 的函式</p>
</dd>
<dt><a href="#removeDictEntries">removeDictEntries(pdfDoc, resources, dictKeyName, shouldDeleteFn)</a> ⇒ <code>Object</code></dt>
<dd><p>共用清除邏輯：依據條件動態移除 Resources 字典下的特定項目
適用於 XObject, ExtGState, Properties 等資源字典。</p>
</dd>
<dt><a href="#removeArrayItems">removeArrayItems(pdfArray, shouldDeleteFn)</a> ⇒ <code>number</code></dt>
<dd><p>共用清除邏輯：依據條件動態移除 PDF 陣列中的特定項目
採用反向迴圈確保安全移除元素而不影響未處理的索引。</p>
</dd>
<dt><a href="#removeXObjects">removeXObjects(pdfDoc, resources, targetSubtype, targetDestroySet)</a> ⇒ <code>Object</code></dt>
<dd><p>共用清除邏輯：清除指定的 XObject (支援 Form 與 Image)
 根據提供的 Subtype 與欲刪除的參照清單，逐一檢視 Resources 下的 XObject，
 若符合條件則將其從資源字典中無損移除。</p>
</dd>
<dt><a href="#removeAnnotations">removeAnnotations(page, annotsSet)</a> ⇒ <code>number</code></dt>
<dd><p>策略二：清除註解 (Annotation)
Annots 是蓋在 PDF 正文上方的附加元件（包括電子簽章、印章、批註等）。
直接在 page.node 中將 /Annots 字典鍵值物理刪除即可，此操作不會損害 PDF 頁面結構。</p>
</dd>
<dt><a href="#removeDirectContent">removeDirectContent(pdfDoc, page, directContentsSet)</a> ⇒ <code>number</code></dt>
<dd><p>策略三：檢查並清空可疑內容流
某些 PDF 會直接在 Contents 內容流中以明文字串寫出浮水印文字（例如：/Tj &quot;CONFIDENTIAL&quot;）。
由於 PDF 串流通常已被壓縮（FlateDecode），此處透過 getDecodedStreamContents() 在記憶體中解壓縮，
轉為 UTF-8 明文字串比對特徵關鍵字。若命中，則清空該內容流。</p>
</dd>
<dt><a href="#removeExtGState">removeExtGState(pdfDoc, resources, pageIndex, extGStatesSet)</a> ⇒ <code>Object</code></dt>
<dd><p>策略五：清理 ExtGState 半透明狀態
 ExtGState 用於綁定半透明效果的透明度設定。某些浮水印會在這裡綁定名稱含 watermark 的透明組態。
 遍歷 Resources 中的 ExtGState 資源，若命名相符，則以空的 ExtGState 物件重置之。</p>
</dd>
<dt><a href="#removeOCGs">removeOCGs(pdfDoc, resources, ocgsSet)</a> ⇒ <code>Object</code></dt>
<dd><p>策略六（頁面層級）：清理 OCG 圖層浮水印相關的 Properties 與 XObject 資源
 針對頁面 Resources 中帶有 /OC 屬性且關聯到待刪除 OCG 的 Properties 與 XObject 進行移除。</p>
</dd>
<dt><a href="#removeOCG">removeOCG(pdfDoc, ocgsSet)</a> ⇒ <code>number</code></dt>
<dd><p>策略六（全域層級）：針對全域 OCG (圖層) 進行徹底刪除（從 Catalog 中移除）</p>
</dd>
<dt><a href="#getPageResources">getPageResources(node)</a> ⇒ <code>PDFDict</code> | <code>null</code></dt>
<dd><p>取得頁面或節點的 Resources 字典，支援從 Parent Pages 樹狀結構遞迴繼承</p>
</dd>
<dt><a href="#getCTMForXObject">getCTMForXObject(ownerDoc, streamOrPage, cleanKeyName, [targetRefStr], [baseCTM], [parentResourcesDict])</a> ⇒ <code>Array.&lt;number&gt;</code> | <code>null</code></dt>
<dd><p>從頁面或 Form XObject 中精確計算呼叫目標 XObject 時的累積變換矩陣 (CTM)
支援跨越巢狀 Form XObject 進行深層搜尋。</p>
</dd>
<dt><a href="#findFormXObjectInResources">findFormXObjectInResources(resourcesNode, cleanKeyName, ownerDoc, [visited])</a> ⇒ <code>Object</code> | <code>null</code></dt>
<dd><p>在指定 Resources 中遞迴搜尋目標 Form XObject</p>
</dd>
<dt><a href="#ensurePreviewHighlightExtGState">ensurePreviewHighlightExtGState(previewDoc, page, extGStateName)</a></dt>
<dd><p>共用輔助函式：確保頁面資源中存在預覽高亮專用的 ExtGState，用以設定紅框半透明度</p>
</dd>
<dt><a href="#buildHighlightCommand">buildHighlightCommand(previewDoc, page, x, y, width, height)</a> ⇒ <code>string</code></dt>
<dd><p>產生共用的預覽標示紅框原始繪圖指令 (供 XObject 預覽使用)</p>
</dd>
<dt><a href="#getPreviewHighlightPolygonCmd">getPreviewHighlightPolygonCmd(previewDoc, page, pts)</a> ⇒ <code>string</code></dt>
<dd><p>產生精準貼合的變換矩陣多邊形紅框 (支援任意旋轉與傾斜預覽)</p>
</dd>
<dt><a href="#saveAndCreatePreviewUrl">saveAndCreatePreviewUrl(previewDoc)</a> ⇒ <code>Promise.&lt;string&gt;</code></dt>
<dd><p>儲存預覽 PDF 文件並建立 Blob URL 以供即時預覽，同時將其加入快取清單以防記憶體洩漏</p>
</dd>
<dt><a href="#createIsolatedPreviewDoc">createIsolatedPreviewDoc(srcDoc, pageIndex)</a> ⇒ <code>Promise.&lt;{previewDoc: PDFDocument, page: PDFPage, pageResources: PDFDict, xObjects: PDFDict}&gt;</code></dt>
<dd><p>建立供即時預覽用的隔離單頁 PDF 文件，並回傳對應的頁面資源與 XObject 字典</p>
</dd>
<dt><a href="#applyPreviewContentAndSave">applyPreviewContentAndSave(previewDoc, page, drawCommand)</a> ⇒ <code>Promise.&lt;string&gt;</code></dt>
<dd><p>將預覽繪圖指令套用至頁面，並產出 Blob URL</p>
</dd>
<dt><a href="#formatMatrixToCm">formatMatrixToCm(matrix)</a> ⇒ <code>string</code></dt>
<dd><p>將矩陣陣列轉換為 PDF cm 指令字串</p>
</dd>
<dt><a href="#generateFormXObjectPreviewUrl">generateFormXObjectPreviewUrl(keyName, pageIndex)</a> ⇒ <code>Promise.&lt;string&gt;</code></dt>
<dd><p>生成 Form XObject 的即時預覽 URL</p>
</dd>
<dt><a href="#generateImageXObjectPreviewUrl">generateImageXObjectPreviewUrl(keyName, rawStream, pageIndex)</a> ⇒ <code>Promise.&lt;string&gt;</code></dt>
<dd><p>生成 Image XObject 的即時預覽 URL</p>
</dd>
<dt><a href="#generateOCGPreviewUrl">generateOCGPreviewUrl(ocgRefStr)</a> ⇒ <code>Promise.&lt;string&gt;</code></dt>
<dd><p>生成 OCG (圖層) 隱藏效果的即時預覽 URL</p>
</dd>
<dt><a href="#generateAnnotationPreviewUrl">generateAnnotationPreviewUrl(annotRefStr, pageIndex, annotIndex)</a> ⇒ <code>Promise.&lt;string&gt;</code></dt>
<dd><p>生成 Annotation (註解) 的即時預覽 URL (高亮顯示所在位置)</p>
</dd>
<dt><a href="#generateDirectContentPreviewUrl">generateDirectContentPreviewUrl(streamRefStr, pageIndex, streamIndex)</a> ⇒ <code>Promise.&lt;string&gt;</code></dt>
<dd><p>生成 Direct Content (頁面直接內容) 的即時預覽 URL</p>
</dd>
<dt><a href="#updateScanResultUI">updateScanResultUI(optionsContainer)</a></dt>
<dd><p>掃描完成後更新 UI：根據偵測結果顯示/隱藏策略列、自動勾選疑似浮水印策略，並給出掃描摘要提示。</p>
</dd>
<dt><a href="#loadAndDecryptPdf">loadAndDecryptPdf(file)</a> ⇒ <code>Promise.&lt;{previewBytes: Uint8Array, needsPassword: boolean, decryptedSuccessfully: boolean}&gt;</code></dt>
<dd><p>讀取原始位元組，嘗試偵測是否有開啟密碼並進行解密</p>
</dd>
<dt><a href="#scanOCG">scanOCG(scanDoc)</a></dt>
<dd><p>掃描並記錄 PDF 中的選擇性內容群組 (OCG)</p>
</dd>
<dt><a href="#scanAnnotations">scanAnnotations(scanDoc, page, pageIndex)</a></dt>
<dd><p>掃描並記錄指定頁面中的註解 (Annotations)</p>
</dd>
<dt><a href="#registerOrUpdateXObject">registerOrUpdateXObject(detectedMap, refStr, pageIndex, createEntryFn, isSuspectFn, destroyList)</a></dt>
<dd><p>輔助函式：註冊或更新跨頁的 XObject (共用於 Form 與 Image)</p>
</dd>
<dt><a href="#registerSuspectEntry">registerSuspectEntry(detectedMap, key, entry, isSuspectFn, destroyList)</a></dt>
<dd><p>輔助函式：註冊偵測到的物件並判斷是否為浮水印 (供單頁/全域物件共用)</p>
</dd>
<dt><a href="#scanResources">scanResources(scanDoc, page, pageIndex)</a></dt>
<dd><p>掃描並記錄指定頁面中的資源 (Resources)，包含 XObject 與 ExtGState</p>
</dd>
<dt><a href="#scanDirectContent">scanDirectContent(scanDoc, page, pageIndex)</a></dt>
<dd><p>掃描並記錄指定頁面中的直接內容 (Direct Content)</p>
</dd>
<dt><a href="#applyHeuristicThreshold">applyHeuristicThreshold(detectedMap, destroyList, threshold, pageCount)</a></dt>
<dd><p>輔助函式：套用高頻特徵門檻 (Heuristic Threshold) 判定
共用於 Form XObject 與 Image XObject 的智慧偵測</p>
</dd>
<dt><a href="#performBackgroundScan">performBackgroundScan(scanDoc)</a></dt>
<dd><p>進行背景高速掃描以找出 PDF 中可能包含浮水印的物件</p>
</dd>
<dt><a href="#prepareScanContext">prepareScanContext(file)</a></dt>
<dd><p>載入新 PDF 後立即偵測加密狀態，若需要開啟密碼則向使用者詢問，
並將解密後的位元組與密碼快取，最後顯示預覽。</p>
</dd>
<dt><a href="#renderPreview">renderPreview(bytes, needsPassword, decryptedSuccessfully)</a></dt>
<dd><p>將解密後的 PDF 內容轉為 Blob 並顯示於畫面上的預覽 iframe 中。</p>
</dd>
<dt><a href="#addStatusMessage">addStatusMessage(text, type)</a> ⇒ <code>void</code></dt>
<dd><p>追加一條狀態日誌到控制台面板中，並自動滾動到最下方</p>
</dd>
<dt><a href="#clearStatusMessages">clearStatusMessages()</a> ⇒ <code>void</code></dt>
<dd><p>清空控制台面板的所有日誌</p>
</dd>
<dt><a href="#decryptWithQpdfWasm">decryptWithQpdfWasm(pdfBytes, password)</a> ⇒ <code>Promise.&lt;Uint8Array&gt;</code></dt>
<dd><p>使用 qpdf-wasm 引擎解密加密的 PDF 文件</p>
<p>此函式採用「延遲載入 (Lazy Load)」策略，僅在遇到有開啟密碼或編輯限制的 PDF 時，
才會從高速 CDN 載入約 1.8MB 的 QPDF WebAssembly 模組，節省初始頁面載入頻寬。
支援所有標準的 PDF 加密演算法（AES-256、AES-128、RC4 等），並能正確修復損壞的 XRef 與 Object Stream。</p>
</dd>
<dt><a href="#promptForPassword">promptForPassword([isRetry])</a> ⇒ <code>Promise.&lt;(string|null)&gt;</code></dt>
<dd><p>顯示密碼彈窗並等待使用者輸入</p>
</dd>
<dt><a href="#resetAllState">resetAllState()</a> ⇒ <code>void</code></dt>
<dd><p>重置所有狀態與暫存，確保新檔案載入時不殘留舊狀態</p>
</dd>
<dt><a href="#clearPreviewUrlCache">clearPreviewUrlCache()</a> ⇒ <code>void</code></dt>
<dd><p>釋放並清空預覽用的 Blob URL 快取，避免記憶體洩漏</p>
</dd>
<dt><a href="#customConfirm">customConfirm(message)</a> ⇒ <code>Promise.&lt;boolean&gt;</code></dt>
<dd><p>顯示自訂的確認彈窗 (Custom Confirm Modal)
取代瀏覽器原生的 confirm()，提供更一致的 UI 體驗</p>
</dd>
<dt><a href="#appendHeuristicBadge">appendHeuristicBadge(parentEl)</a></dt>
<dd><p>輔助函式：為 UI 標籤加上高頻偵測的視覺徽章
共用於 Form XObject 與 Image XObject</p>
</dd>
<dt><a href="#openObjectPreview">openObjectPreview(strategyType, key, entry)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>輔助函式：安全地跳脫 HTML 特殊字元，防止 XSS
開啟物件即時預覽彈窗</p>
</dd>
<dt><a href="#closeObjectPreview">closeObjectPreview()</a> ⇒ <code>void</code></dt>
<dd><p>關閉物件即時預覽彈窗，並即時釋放該預覽 PDF 的 Blob URL 以防止記憶體洩漏</p>
</dd>
<dt><a href="#escapeHTML">escapeHTML(str)</a> ⇒ <code>string</code></dt>
<dd><p>將使用者輸入字串進行 HTML 跳脫，防止 XSS (Cross-Site Scripting) 攻擊</p>
</dd>
<dt><a href="#escapeRegex">escapeRegex(str)</a> ⇒ <code>string</code></dt>
<dd><p>將字串中的正則表達式特殊字元進行跳脫，以安全地嵌入 RegExp 建構式</p>
</dd>
<dt><a href="#isSuspectKeyName">isSuspectKeyName(text)</a> ⇒ <code>boolean</code></dt>
<dd><p>判定資源鍵名或圖層名稱是否含有疑似浮水印的特徵</p>
</dd>
<dt><a href="#isSuspectContentText">isSuspectContentText(text)</a> ⇒ <code>boolean</code></dt>
<dd><p>判定實際內容文字流中是否含有疑似浮水印的特徵</p>
<p>注意：FINAL_CONTENT_KEYWORDS 同時包含：</p>
<ol>
<li>可讀的英文/中文字串（toLowerCase 比對）</li>
<li>UTF-16BE Latin1 / Big5 的二進位特徵碼（不可 toLowerCase，否則會破壞位元組值）
因此必須對兩類分別比對：英文全小寫比對，二進位直接對原始 text 比對。</li>
</ol>
</dd>
<dt><a href="#isSuspectFormXObject">isSuspectFormXObject(entry, [rawStr])</a> ⇒ <code>boolean</code></dt>
<dd><p>策略 1: 表單外部物件 (Form XObject) 判定</p>
</dd>
<dt><a href="#isSuspectAnnotation">isSuspectAnnotation(entry)</a> ⇒ <code>boolean</code></dt>
<dd><p>策略 2: 註解 (Annotation) 判定</p>
</dd>
<dt><a href="#isSuspectDirectContent">isSuspectDirectContent(entry)</a> ⇒ <code>boolean</code></dt>
<dd><p>策略 3: 頁面直接內容 (Direct Content) 判定</p>
</dd>
<dt><a href="#isSuspectImageXObject">isSuspectImageXObject(entry)</a> ⇒ <code>boolean</code></dt>
<dd><p>策略 4: 影像外部物件 (Image XObject) 判定</p>
</dd>
<dt><a href="#isSuspectExtGState">isSuspectExtGState(entry)</a> ⇒ <code>boolean</code></dt>
<dd><p>策略 5: 延伸圖形狀態 (ExtGState) 判定</p>
</dd>
<dt><a href="#isSuspectOCG">isSuspectOCG(entry)</a> ⇒ <code>boolean</code></dt>
<dd><p>策略 6: 選擇性內容群組 (OCG) 判定</p>
</dd>
<dt><a href="#decodeBinaryToText">decodeBinaryToText(data)</a> ⇒ <code>string</code></dt>
<dd><p>將 Uint8Array 以二進位字串的方式精確轉換（避免 TextDecoder 將非 UTF-8 字元變成亂碼）</p>
</dd>
<dt><a href="#encodeTextToBinary">encodeTextToBinary(text)</a> ⇒ <code>Uint8Array</code></dt>
<dd><p>將二進位 Latin1 字串安全地轉換回 Uint8Array 位元組陣列</p>
</dd>
<dt><a href="#compileToBig5Latin1">compileToBig5Latin1(str)</a> ⇒ <code>string</code></dt>
<dd><p>將字串動態編譯為 Big5 格式的 Latin1 字串
依賴 text-encoding polyfill (NONSTANDARD_allowLegacyEncoding)</p>
</dd>
<dt><a href="#compileToUTF16BELatin1">compileToUTF16BELatin1(str)</a> ⇒ <code>string</code></dt>
<dd><p>將正規 UTF-8 字串動態編譯為 PDF 標準中文字型 UTF-16BE 在 Latin1 解碼流下的二進位特徵碼</p>
</dd>
<dt><a href="#decodeHexStringsInText">decodeHexStringsInText(text)</a> ⇒ <code>string</code></dt>
<dd><p>將內容文字流中可能含有的 PDF 十六進位字串 &lt;...&gt; 萃取並還原為 Latin1 字串</p>
</dd>
<dt><a href="#getDecodedStreamContents">getDecodedStreamContents(stream)</a> ⇒ <code>Uint8Array</code></dt>
<dd><p>安全地獲取並解壓縮 PDFRawStream 的二進位內容</p>
</dd>
</dl>

<a name="WatermarkStrategyModal"></a>

## WatermarkStrategyModal
浮水印清除策略設定彈出視窗 (Modal) 抽象化通用管理類別

此類別採用統一的封裝設計，負責管理 6 種不同清除策略的彈出設定視窗，
包含視窗開關、條列式 Checkbox 的動態渲染、回復預設值、套用設定以及與主畫面勾選狀態的雙向連動。

**Kind**: global class  

* [WatermarkStrategyModal](#WatermarkStrategyModal)
    * [new WatermarkStrategyModal(config)](#new_WatermarkStrategyModal_new)
    * [.initEvents()](#WatermarkStrategyModal+initEvents)
    * [.render()](#WatermarkStrategyModal+render)

<a name="new_WatermarkStrategyModal_new"></a>

### new WatermarkStrategyModal(config)
建構式：初始化 Modal 實例並選取關聯的 DOM 元素


| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | Modal 設定物件 |

<a name="WatermarkStrategyModal+initEvents"></a>

### watermarkStrategyModal.initEvents()
初始化 DOM 元素事件監聽器

**Kind**: instance method of [<code>WatermarkStrategyModal</code>](#WatermarkStrategyModal)  
<a name="WatermarkStrategyModal+render"></a>

### watermarkStrategyModal.render()
渲染彈出視窗內的選項列表

**Kind**: instance method of [<code>WatermarkStrategyModal</code>](#WatermarkStrategyModal)  
<a name="WATERMARK_KEY_KEYWORDS"></a>

## WATERMARK\_KEY\_KEYWORDS : <code>Array.&lt;string&gt;</code>
全域資源鍵名關鍵字清單

**Kind**: global variable  
<a name="WATERMARK_CONTENT_KEYWORDS"></a>

## WATERMARK\_CONTENT\_KEYWORDS : <code>Array.&lt;string&gt;</code>
全域內容文字關鍵字清單

**Kind**: global variable  
<a name="FINAL_CONTENT_KEYWORDS"></a>

## FINAL\_CONTENT\_KEYWORDS : <code>Array.&lt;string&gt;</code>
編譯後的最終高精度比對字串庫

**Kind**: global variable  
<a name="TRANSPARENCY_THRESHOLD"></a>

## TRANSPARENCY\_THRESHOLD : <code>number</code>
全域高透明度特徵門檻

**Kind**: global variable  
<a name="HEURISTIC_THRESHOLD"></a>

## HEURISTIC\_THRESHOLD : <code>number</code>
高頻率出現門檻 (0~1)

**Kind**: global variable  
<a name="selectedFile"></a>

## selectedFile : <code>File</code> \| <code>null</code>
目前使用者選取上傳的 PDF 檔案實體 (File)

**Kind**: global variable  
<a name="originalUrl"></a>

## originalUrl : <code>string</code> \| <code>null</code>
原始 PDF 於瀏覽器端動態建立的 Blob URL

**Kind**: global variable  
<a name="processedUrl"></a>

## processedUrl : <code>string</code> \| <code>null</code>
處理後 PDF 於瀏覽器端動態建立的 Blob URL

**Kind**: global variable  
<a name="cachedPassword"></a>

## cachedPassword : <code>string</code> \| <code>null</code>
本次選檔後使用者輸入的開啟密碼快取（換檔時清除）

**Kind**: global variable  
<a name="cachedDecryptedBytes"></a>

## cachedDecryptedBytes : <code>Uint8Array</code> \| <code>null</code>
使用密碼解密後的 PDF 位元組快取（換檔時清除）

**Kind**: global variable  
<a name="cachedPdfDocument"></a>

## cachedPdfDocument : <code>PDFDocument</code> \| <code>null</code>
解析完成的原始 PDFDocument 實例快取（提升預覽效能）

**Kind**: global variable  
<a name="previewUrlCache"></a>

## previewUrlCache : <code>Array.&lt;string&gt;</code>
預覽 Blob URL 快取（換檔時清除）

**Kind**: global variable  
<a name="lastSuccessPassword"></a>

## lastSuccessPassword : <code>string</code> \| <code>null</code>
跨檔案成功解密的開啟密碼暫存（執行期記憶體快取，不落地儲存）

**Kind**: global variable  
<a name="DEFAULT_KEY_KEYWORDS"></a>

## DEFAULT\_KEY\_KEYWORDS : <code>Array.&lt;string&gt;</code>
預設的資源鍵名與圖層名稱關鍵字

**Kind**: global constant  
<a name="DEFAULT_CONTENT_KEYWORDS"></a>

## DEFAULT\_CONTENT\_KEYWORDS : <code>Array.&lt;string&gt;</code>
預設的實際內容文字關鍵字

**Kind**: global constant  
<a name="detectedFormXObjects"></a>

## detectedFormXObjects : <code>Map.&lt;string, string&gt;</code>
偵測到的表單外部物件 (key = raw stream text, value = extracted display string)

**Kind**: global constant  
<a name="formXObjectsToDestroy"></a>

## formXObjectsToDestroy : <code>Array.&lt;string&gt;</code>
儲存使用者勾選要刪除的 raw stream text

**Kind**: global constant  
<a name="detectedAnnotations"></a>

## detectedAnnotations : <code>Map.&lt;string, any&gt;</code>
當前 PDF 檔案中偵測到的所有註解實例（key = annotRefStr）

**Kind**: global constant  
<a name="annotsToDestroy"></a>

## annotsToDestroy : <code>Array.&lt;string&gt;</code>
要刪除的特定註解參照 (annotRefStr) 清單

**Kind**: global constant  
<a name="detectedDirectContents"></a>

## detectedDirectContents : <code>Map.&lt;string, {page: number, ref: any, rawText: string, streamIndex: number}&gt;</code>
頁面直接內容狀態（key = streamRefStr）

**Kind**: global constant  
<a name="directContentsToDestroy"></a>

## directContentsToDestroy : <code>Array.&lt;string&gt;</code>
儲存選定要清空的頁面直接內容參照字串

**Kind**: global constant  
<a name="detectedImages"></a>

## detectedImages : <code>Map.&lt;string, {keyName: string, pages: Array.&lt;number&gt;, ref: any, rawStream: string, width: number, height: number, filterStr: string}&gt;</code>
影像外部物件狀態（key = refStr）

**Kind**: global constant  
<a name="imagesToDestroy"></a>

## imagesToDestroy : <code>Array.&lt;string&gt;</code>
儲存選定要清除的影像外部物件鍵值

**Kind**: global constant  
<a name="detectedExtGStates"></a>

## detectedExtGStates : <code>Map.&lt;string, {keyName: string, page: number, ref: any, detailText: string, fillOpacity: number, strokeOpacity: number}&gt;</code>
延伸圖形狀態（key = `${page}:${name}`）

**Kind**: global constant  
<a name="extGStatesToDestroy"></a>

## extGStatesToDestroy : <code>Array.&lt;string&gt;</code>
儲存選定要清除的延伸圖形狀態鍵值

**Kind**: global constant  
<a name="detectedOCGs"></a>

## detectedOCGs : <code>Map.&lt;string, {name: string, ref: any}&gt;</code>
選擇性內容群組狀態（key = ocgRefStr）

**Kind**: global constant  
<a name="ocgsToDestroy"></a>

## ocgsToDestroy : <code>Array.&lt;string&gt;</code>
儲存選定要隱藏的 OCG 參照字串

**Kind**: global constant  
<a name="STRATEGY_REGISTRY"></a>

## STRATEGY\_REGISTRY
STRATEGY_REGISTRY 將各種清理策略封裝註冊。
注意：由於是以參照(Reference)方式綁定 `map` 與 `destroyList`，
這些陣列和 Map 必須定義為 `const`，在清空時使用 `.clear()` 或 `.length = 0`，
絕對不可重新賦值（如 `map = new Map()`），否則會導致此處的參照斷裂。

**Kind**: global constant  
**Read only**: true  
<a name="annotSubtypeMeta"></a>

## annotSubtypeMeta : <code>Object.&lt;string, {label: string, color: string}&gt;</code>
註解 (Annotation) 子類型元資料設定

**Kind**: global constant  
<a name="fileInput"></a>

## fileInput : <code>HTMLInputElement</code>
檔案輸入元素

**Kind**: global constant  
<a name="fileArea"></a>

## fileArea : <code>HTMLElement</code>
檔案拖曳與顯示區域

**Kind**: global constant  
<a name="fileAreaInner"></a>

## fileAreaInner : <code>HTMLElement</code>
檔案區域內部容器

**Kind**: global constant  
<a name="statusEl"></a>

## statusEl : <code>HTMLElement</code>
狀態訊息顯示區塊

**Kind**: global constant  
<a name="processButton"></a>

## processButton : <code>HTMLButtonElement</code>
執行處理按鈕

**Kind**: global constant  
<a name="downloadArea"></a>

## downloadArea : <code>HTMLElement</code>
下載區域區塊

**Kind**: global constant  
<a name="downloadLink"></a>

## downloadLink : <code>HTMLAnchorElement</code>
下載連結元素

**Kind**: global constant  
<a name="optionsContainer"></a>

## optionsContainer : <code>HTMLElement</code>
清理選項容器

**Kind**: global constant  
<a name="previewContainer"></a>

## previewContainer : <code>HTMLElement</code>
雙欄預覽容器

**Kind**: global constant  
<a name="originalPreview"></a>

## originalPreview : <code>HTMLIFrameElement</code>
原始 PDF 預覽 iframe

**Kind**: global constant  
<a name="processedPreviewBox"></a>

## processedPreviewBox : <code>HTMLElement</code>
處理後預覽區塊容器

**Kind**: global constant  
<a name="processedPreview"></a>

## processedPreview : <code>HTMLIFrameElement</code>
處理後 PDF 預覽 iframe

**Kind**: global constant  
<a name="objectPreviewModal"></a>

## objectPreviewModal : <code>HTMLElement</code>
物件預覽彈窗元素

**Kind**: global constant  
<a name="objectPreviewTitle"></a>

## objectPreviewTitle : <code>HTMLElement</code>
物件預覽彈窗標題

**Kind**: global constant  
<a name="objectPreviewSpinner"></a>

## objectPreviewSpinner : <code>HTMLElement</code>
物件預覽載入中指示器

**Kind**: global constant  
<a name="objectPreviewIframe"></a>

## objectPreviewIframe : <code>HTMLIFrameElement</code>
物件預覽 iframe

**Kind**: global constant  
<a name="streamDecodeCache"></a>

## streamDecodeCache : <code>WeakMap.&lt;PDFRawStream, Uint8Array&gt;</code>
內容串流解碼快取，用於降低大檔重複掃描的效能開銷

**Kind**: global constant  
<a name="verifyPdfMagicNumber"></a>

## verifyPdfMagicNumber(file) ⇒ <code>Promise.&lt;boolean&gt;</code>
驗證檔案是否為 PDF (透過檢查 Magic Number)

**Kind**: global function  

| Param | Type |
| --- | --- |
| file | <code>File</code> | 

<a name="handleFileSelected"></a>

## handleFileSelected(file) ⇒ <code>void</code>
共用輔助函式：當使用者選取檔案後，統一執行 UI 更新與背景掃描

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| file | <code>File</code> | 使用者選取的 PDF 檔案 |

<a name="formatBytes"></a>

## formatBytes(bytes) ⇒ <code>string</code>
輔助函式：格式化檔案大小單位

**Kind**: global function  
**Returns**: <code>string</code> - 可讀性佳的格式化檔案大小 (如 1.25 MB)  

| Param | Type | Description |
| --- | --- | --- |
| bytes | <code>number</code> | 檔案位元組大小 |

<a name="updateFileAreaDisplay"></a>

## updateFileAreaDisplay() ⇒ <code>void</code>
依據目前選取的 selectedFile 更新拖曳上傳區域的文字顯示。

**Kind**: global function  
<a name="getOptions"></a>

## getOptions() ⇒ <code>Object.&lt;string, boolean&gt;</code>
取得目前畫面中 checkbox 勾選的清理選項

**Kind**: global function  
**Returns**: <code>Object.&lt;string, boolean&gt;</code> - 清理選項物件  
<a name="buildFinalContentKeywords"></a>

## buildFinalContentKeywords() ⇒ <code>void</code>
根據目前的 WATERMARK_CONTENT_KEYWORDS 建立最終的多重編碼比對特徵碼陣列

**Kind**: global function  
<a name="loadGlobalKeywords"></a>

## loadGlobalKeywords() ⇒ <code>void</code>
載入並初始化全域關鍵字設定（從 localStorage 讀取或使用預設值）

**Kind**: global function  
<a name="saveGlobalKeywords"></a>

## saveGlobalKeywords(keysArray, contentsArray, threshold, heuristicThreshold) ⇒ <code>void</code>
儲存全域設定至 localStorage

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| keysArray | <code>Array.&lt;string&gt;</code> | 資源鍵名關鍵字陣列 |
| contentsArray | <code>Array.&lt;string&gt;</code> | 內容文字關鍵字陣列 |
| threshold | <code>number</code> | 透明度門檻值 |
| heuristicThreshold | <code>number</code> | 智慧偵測高頻率門檻 |

<a name="safeRemoveFromDictionary"></a>

## safeRemoveFromDictionary(pdfDoc, resources, dictKey, targetDict, targetRef, keysToRemove) ⇒ <code>void</code>
安全地從 PDFDict 資源字典中移除指定鍵值
若原字典已被多頁共用，會先進行 clone 以隔離修改。

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| resources | <code>PDFDict</code> | 頁面的 Resources 字典 |
| dictKey | <code>PDFName</code> | 目標字典在 Resources 中的鍵名 (如 PDFName.of('XObject')) |
| targetDict | <code>PDFDict</code> | 目標字典 |
| targetRef | <code>PDFRef</code> \| <code>null</code> | 目標字典的參照物件 (如果有) |
| keysToRemove | <code>Array.&lt;PDFName&gt;</code> | 準備移除的鍵名陣列 |

<a name="removeDeletedReferencesFromText"></a>

## removeDeletedReferencesFromText(text, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys) ⇒ <code>Object</code>
共用的字串置換輔助函式，用於從 Content Stream 中移除對已刪除資源的參照 (如 Do, gs, OCG)

**Kind**: global function  
**Returns**: <code>Object</code> - 置換後的文字與是否被修改的布林值  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | 原始內容流文字 |
| deletedXObjKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 XObject 鍵名清單 |
| deletedExtGStateKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 ExtGState 鍵名清單 |
| deletedOcgKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 OCG 鍵名清單 |

<a name="rebuildStreamWithoutReferences"></a>

## rebuildStreamWithoutReferences(pdfDoc, stream, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys) ⇒ <code>PDFRawStream</code> \| <code>null</code>
共用串流重構邏輯：解碼二進位串流，抹除已刪除資源的參照指令，並重構為新的 PDFRawStream。
若內容有被修改，則回傳重構後的新串流，否則回傳 null。

**Kind**: global function  
**Returns**: <code>PDFRawStream</code> \| <code>null</code> - 重構後的新串流物件  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| stream | <code>PDFRawStream</code> | 原始二進位串流 |
| deletedXObjKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 XObject 鍵名清單 |
| deletedExtGStateKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 ExtGState 鍵名清單 |
| deletedOcgKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 OCG 鍵名清單 |

<a name="cleanContentStreams"></a>

## cleanContentStreams(pdfDoc, page, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys) ⇒ <code>void</code>
清理 content stream 中對已刪除資源的參考，防止 Acrobat Reader 報錯

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| page | <code>PDFPage</code> | 頁面物件 |
| deletedXObjKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 XObject 鍵名清單 |
| deletedExtGStateKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 ExtGState 鍵名清單 |
| deletedOcgKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 OCG 鍵名清單 |

<a name="cleanContentStreams..processStream"></a>

### cleanContentStreams~processStream(streamRef, idxOrKey, contentsArray) ⇒ <code>void</code>
內部輔助函式：處理單一內容流，進行參照指令抹除與重新打包

**Kind**: inner method of [<code>cleanContentStreams</code>](#cleanContentStreams)  

| Param | Type | Description |
| --- | --- | --- |
| streamRef | <code>PDFRef</code> | 串流參照 |
| idxOrKey | <code>number</code> \| <code>null</code> | 在陣列中的索引，或單一參照的 null |
| contentsArray | <code>PDFArray</code> \| <code>null</code> | 若有多個內容流，此為父陣列 |

<a name="processPdf"></a>

## processPdf(pdfDoc, options) ⇒ <code>Object</code>
核心重構清除引擎：遍歷 PDF 物件樹並執行浮水印置換

為了防止直接刪除 PDF 字典物件導致內部資源樹引用斷裂（引發 PDF 檔損毀打不開），
本清除引擎採用「無損清除技術」—— 將需要清除的物件從資源字典中移除，
並主動清理 Content Stream 中的參照 (如 `Do`, `gs`)，確保 PDF 結構完整，防止 Acrobat Reader 報錯。
同時執行單頁資源隔離複製，確保頁面間的修改不互相干擾。

**Kind**: global function  
**Returns**: <code>Object</code> - 包含 modifiedObjects (已被修改/置換的物件總數) 的統計物件  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | pdf-lib 的 PDF 文件物件 |
| options | <code>Object</code> | 包含 6 大清理策略勾選狀態的布林值物件 |

<a name="cleanResourcesRecursively"></a>

## cleanResourcesRecursively(pdfDoc, resources, pageIndex, options, destroySets, allDeletedXObjectKeys, allDeletedExtGStateKeys, allDeletedOcgKeys) ⇒ <code>number</code>
遞迴清理 Resources (支援巢狀 Form XObject)

**Kind**: global function  
**Returns**: <code>number</code> - 實際清理的物件總數  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| resources | <code>PDFDict</code> | 資源字典物件 |
| pageIndex | <code>number</code> | 當前處理頁面的 0-indexed 索引 |
| options | <code>Object</code> | 包含清理策略的選項物件 |
| destroySets | <code>Object</code> | 轉換為 Set 的清理目標名單 |
| allDeletedXObjectKeys | <code>Array.&lt;string&gt;</code> | 收集被刪除的 XObject 鍵名 |
| allDeletedExtGStateKeys | <code>Array.&lt;string&gt;</code> | 收集被刪除的 ExtGState 鍵名 |
| allDeletedOcgKeys | <code>Array.&lt;string&gt;</code> | 收集被刪除的 OCG 鍵名 |

<a name="cleanFormXObjectStream"></a>

## cleanFormXObjectStream(pdfDoc, xObjRef, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys) ⇒ <code>void</code>
專門用於清理 Form XObject 內部 Content Stream 的函式

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| xObjRef | <code>PDFRef</code> | Form XObject 的參照物件 |
| deletedXObjKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 XObject 鍵名清單 |
| deletedExtGStateKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 ExtGState 鍵名清單 |
| deletedOcgKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 OCG 鍵名清單 |

<a name="removeDictEntries"></a>

## removeDictEntries(pdfDoc, resources, dictKeyName, shouldDeleteFn) ⇒ <code>Object</code>
共用清除邏輯：依據條件動態移除 Resources 字典下的特定項目
適用於 XObject, ExtGState, Properties 等資源字典。

**Kind**: global function  
**Returns**: <code>Object</code> - 清除統計與被刪除的鍵名清單  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| resources | <code>PDFDict</code> | 頁面資源字典 |
| dictKeyName | <code>string</code> | 目標字典的鍵名 (如 'XObject') |
| shouldDeleteFn | <code>function</code> | 判斷是否應刪除的回呼函式 (key: PDFName, objRef: PDFRef) => boolean |

<a name="removeArrayItems"></a>

## removeArrayItems(pdfArray, shouldDeleteFn) ⇒ <code>number</code>
共用清除邏輯：依據條件動態移除 PDF 陣列中的特定項目
採用反向迴圈確保安全移除元素而不影響未處理的索引。

**Kind**: global function  
**Returns**: <code>number</code> - 實際刪除的數量  

| Param | Type | Description |
| --- | --- | --- |
| pdfArray | <code>PDFArray</code> | 目標 PDF 陣列物件 |
| shouldDeleteFn | <code>function</code> | 判斷是否應刪除的回呼函式 (item: any) => boolean |

<a name="removeXObjects"></a>

## removeXObjects(pdfDoc, resources, targetSubtype, targetDestroySet) ⇒ <code>Object</code>
共用清除邏輯：清除指定的 XObject (支援 Form 與 Image)
 根據提供的 Subtype 與欲刪除的參照清單，逐一檢視 Resources 下的 XObject，
 若符合條件則將其從資源字典中無損移除。

**Kind**: global function  
**Returns**: <code>Object</code> - 清除統計與被刪除的鍵名清單  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| resources | <code>PDFDict</code> | 頁面資源字典 |
| targetSubtype | <code>string</code> | 目標 XObject 的子類型 (如 '/Form' 或 '/Image') |
| targetDestroySet | <code>Set.&lt;string&gt;</code> | 待刪除的目標物件參照字串 Set |

<a name="removeAnnotations"></a>

## removeAnnotations(page, annotsSet) ⇒ <code>number</code>
策略二：清除註解 (Annotation)
Annots 是蓋在 PDF 正文上方的附加元件（包括電子簽章、印章、批註等）。
直接在 page.node 中將 /Annots 字典鍵值物理刪除即可，此操作不會損害 PDF 頁面結構。

**Kind**: global function  
**Returns**: <code>number</code> - 實際清除的註解數量  

| Param | Type | Description |
| --- | --- | --- |
| page | <code>PDFPage</code> | 目標頁面物件 |
| annotsSet | <code>Set.&lt;string&gt;</code> | 待刪除的註解參照 Set |

<a name="removeDirectContent"></a>

## removeDirectContent(pdfDoc, page, directContentsSet) ⇒ <code>number</code>
策略三：檢查並清空可疑內容流
某些 PDF 會直接在 Contents 內容流中以明文字串寫出浮水印文字（例如：/Tj "CONFIDENTIAL"）。
由於 PDF 串流通常已被壓縮（FlateDecode），此處透過 getDecodedStreamContents() 在記憶體中解壓縮，
轉為 UTF-8 明文字串比對特徵關鍵字。若命中，則清空該內容流。

**Kind**: global function  
**Returns**: <code>number</code> - 處理掉的頁面直接內容 (Direct Content) 數量  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | 文件物件 |
| page | <code>PDFPage</code> | 頁面物件 |
| directContentsSet | <code>Set.&lt;string&gt;</code> | 待刪除的直接內容參照 Set |

<a name="removeExtGState"></a>

## removeExtGState(pdfDoc, resources, pageIndex, extGStatesSet) ⇒ <code>Object</code>
策略五：清理 ExtGState 半透明狀態
 ExtGState 用於綁定半透明效果的透明度設定。某些浮水印會在這裡綁定名稱含 watermark 的透明組態。
 遍歷 Resources 中的 ExtGState 資源，若命名相符，則以空的 ExtGState 物件重置之。

**Kind**: global function  
**Returns**: <code>Object</code> - 清除統計與被刪除的鍵名清單  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | 文件物件 |
| resources | <code>PDFDict</code> | 資源字典 |
| pageIndex | <code>number</code> | 當前處理頁面的 0-indexed 索引 |
| extGStatesSet | <code>Set.&lt;string&gt;</code> | 待刪除的 ExtGState 參照 Set |

<a name="removeOCGs"></a>

## removeOCGs(pdfDoc, resources, ocgsSet) ⇒ <code>Object</code>
策略六（頁面層級）：清理 OCG 圖層浮水印相關的 Properties 與 XObject 資源
 針對頁面 Resources 中帶有 /OC 屬性且關聯到待刪除 OCG 的 Properties 與 XObject 進行移除。

**Kind**: global function  
**Returns**: <code>Object</code> - 清除統計  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| resources | <code>PDFDict</code> | 頁面資源字典 |
| ocgsSet | <code>Set.&lt;string&gt;</code> | 待刪除的 OCG 參照 Set |

<a name="removeOCG"></a>

## removeOCG(pdfDoc, ocgsSet) ⇒ <code>number</code>
策略六（全域層級）：針對全域 OCG (圖層) 進行徹底刪除（從 Catalog 中移除）

**Kind**: global function  
**Returns**: <code>number</code> - 清除的 OCG 圖層數量  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| ocgsSet | <code>Set.&lt;string&gt;</code> | 待刪除的 OCG 參照 Set |

<a name="getPageResources"></a>

## getPageResources(node) ⇒ <code>PDFDict</code> \| <code>null</code>
取得頁面或節點的 Resources 字典，支援從 Parent Pages 樹狀結構遞迴繼承

**Kind**: global function  
**Returns**: <code>PDFDict</code> \| <code>null</code> - 解析出的 Resources 字典  

| Param | Type | Description |
| --- | --- | --- |
| node | <code>PDFDict</code> | 頁面或表單節點 |

<a name="getCTMForXObject"></a>

## getCTMForXObject(ownerDoc, streamOrPage, cleanKeyName, [targetRefStr], [baseCTM], [parentResourcesDict]) ⇒ <code>Array.&lt;number&gt;</code> \| <code>null</code>
從頁面或 Form XObject 中精確計算呼叫目標 XObject 時的累積變換矩陣 (CTM)
支援跨越巢狀 Form XObject 進行深層搜尋。

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> \| <code>null</code> - 計算出的 6 個元素的 CTM 陣列，若找不到則回傳 null  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| ownerDoc | <code>PDFDocument</code> |  | 擁有該物件的 PDFDocument 實例 |
| streamOrPage | <code>PDFPage</code> \| <code>PDFRawStream</code> |  | 起始掃描的頁面或 Form XObject 串流 |
| cleanKeyName | <code>string</code> |  | 目標物件的資源鍵名 (不含前綴斜線) |
| [targetRefStr] | <code>string</code> \| <code>null</code> | <code>null</code> | 目標物件的特定參照字串 (可選) |
| [baseCTM] | <code>Array.&lt;number&gt;</code> | <code>[1, 0, 0, 1, 0, 0]</code> | 初始基準變換矩陣 |
| [parentResourcesDict] | <code>PDFDict</code> \| <code>null</code> | <code></code> | 父層級的資源字典 |

<a name="findFormXObjectInResources"></a>

## findFormXObjectInResources(resourcesNode, cleanKeyName, ownerDoc, [visited]) ⇒ <code>Object</code> \| <code>null</code>
在指定 Resources 中遞迴搜尋目標 Form XObject

**Kind**: global function  
**Returns**: <code>Object</code> \| <code>null</code> - 找到的參照與物件，若無則回傳 null  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| resourcesNode | <code>PDFObject</code> \| <code>PDFDict</code> |  | 欲搜尋的 Resources 節點 |
| cleanKeyName | <code>string</code> |  | 目標 Form XObject 的鍵名 (不含斜線) |
| ownerDoc | <code>PDFDocument</code> |  | 擁有該資源的 PDFDocument 實例 |
| [visited] | <code>Set.&lt;string&gt;</code> | <code>new Set()</code> | 用於防止循環參照的已訪問集合 |

<a name="ensurePreviewHighlightExtGState"></a>

## ensurePreviewHighlightExtGState(previewDoc, page, extGStateName)
共用輔助函式：確保頁面資源中存在預覽高亮專用的 ExtGState，用以設定紅框半透明度

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| previewDoc | <code>PDFDocument</code> | 預覽用的 PDF 文件物件 |
| page | <code>PDFPage</code> | 欲繪製紅框的頁面物件 |
| extGStateName | <code>string</code> | 預期的 ExtGState 鍵名 |

<a name="buildHighlightCommand"></a>

## buildHighlightCommand(previewDoc, page, x, y, width, height) ⇒ <code>string</code>
產生共用的預覽標示紅框原始繪圖指令 (供 XObject 預覽使用)

**Kind**: global function  
**Returns**: <code>string</code> - 繪製矩形紅框的 PDF 內容流指令字串  

| Param | Type | Description |
| --- | --- | --- |
| previewDoc | <code>PDFDocument</code> | 預覽用的 PDF 文件物件 |
| page | <code>PDFPage</code> | 欲繪製紅框的頁面物件 |
| x | <code>number</code> | 矩形左下角 X 座標 |
| y | <code>number</code> | 矩形左下角 Y 座標 |
| width | <code>number</code> | 矩形寬度 |
| height | <code>number</code> | 矩形高度 |

<a name="getPreviewHighlightPolygonCmd"></a>

## getPreviewHighlightPolygonCmd(previewDoc, page, pts) ⇒ <code>string</code>
產生精準貼合的變換矩陣多邊形紅框 (支援任意旋轉與傾斜預覽)

**Kind**: global function  
**Returns**: <code>string</code> - 繪製多邊形紅框的 PDF 內容流指令字串  

| Param | Type | Description |
| --- | --- | --- |
| previewDoc | <code>PDFDocument</code> | 預覽用的 PDF 文件物件 |
| page | <code>PDFPage</code> | 欲繪製紅框的頁面物件 |
| pts | <code>Array.&lt;{x: number, y: number}&gt;</code> | 多邊形的四個頂點座標陣列 (依序連接) |

<a name="saveAndCreatePreviewUrl"></a>

## saveAndCreatePreviewUrl(previewDoc) ⇒ <code>Promise.&lt;string&gt;</code>
儲存預覽 PDF 文件並建立 Blob URL 以供即時預覽，同時將其加入快取清單以防記憶體洩漏

**Kind**: global function  
**Returns**: <code>Promise.&lt;string&gt;</code> - Blob URL 網址  

| Param | Type | Description |
| --- | --- | --- |
| previewDoc | <code>PDFDocument</code> | 已產生好預覽畫面的 PDF 文件物件 |

<a name="createIsolatedPreviewDoc"></a>

## createIsolatedPreviewDoc(srcDoc, pageIndex) ⇒ <code>Promise.&lt;{previewDoc: PDFDocument, page: PDFPage, pageResources: PDFDict, xObjects: PDFDict}&gt;</code>
建立供即時預覽用的隔離單頁 PDF 文件，並回傳對應的頁面資源與 XObject 字典

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| srcDoc | <code>PDFDocument</code> | 原始 PDF 文件 |
| pageIndex | <code>number</code> | 欲複製的頁面索引 |

<a name="applyPreviewContentAndSave"></a>

## applyPreviewContentAndSave(previewDoc, page, drawCommand) ⇒ <code>Promise.&lt;string&gt;</code>
將預覽繪圖指令套用至頁面，並產出 Blob URL

**Kind**: global function  
**Returns**: <code>Promise.&lt;string&gt;</code> - Blob URL  

| Param | Type | Description |
| --- | --- | --- |
| previewDoc | <code>PDFDocument</code> | 預覽用的 PDF 文件 |
| page | <code>PDFPage</code> | 目標頁面 |
| drawCommand | <code>string</code> | PDF 內容流繪製指令 |

<a name="formatMatrixToCm"></a>

## formatMatrixToCm(matrix) ⇒ <code>string</code>
將矩陣陣列轉換為 PDF cm 指令字串

**Kind**: global function  
**Returns**: <code>string</code> - PDF cm 指令  

| Param | Type | Description |
| --- | --- | --- |
| matrix | <code>Array.&lt;number&gt;</code> | 變換矩陣陣列 |

<a name="generateFormXObjectPreviewUrl"></a>

## generateFormXObjectPreviewUrl(keyName, pageIndex) ⇒ <code>Promise.&lt;string&gt;</code>
生成 Form XObject 的即時預覽 URL

**Kind**: global function  
**Returns**: <code>Promise.&lt;string&gt;</code> - Blob URL  

| Param | Type | Description |
| --- | --- | --- |
| keyName | <code>string</code> | 資源鍵名 |
| pageIndex | <code>number</code> | 頁面索引 (0-indexed) |

<a name="generateImageXObjectPreviewUrl"></a>

## generateImageXObjectPreviewUrl(keyName, rawStream, pageIndex) ⇒ <code>Promise.&lt;string&gt;</code>
生成 Image XObject 的即時預覽 URL

**Kind**: global function  
**Returns**: <code>Promise.&lt;string&gt;</code> - Blob URL  

| Param | Type | Description |
| --- | --- | --- |
| keyName | <code>string</code> | 資源鍵名 |
| rawStream | <code>PDFRawStream</code> | 原始影像串流 |
| pageIndex | <code>number</code> | 頁面索引 (0-indexed) |

<a name="generateOCGPreviewUrl"></a>

## generateOCGPreviewUrl(ocgRefStr) ⇒ <code>Promise.&lt;string&gt;</code>
生成 OCG (圖層) 隱藏效果的即時預覽 URL

**Kind**: global function  
**Returns**: <code>Promise.&lt;string&gt;</code> - Blob URL  

| Param | Type | Description |
| --- | --- | --- |
| ocgRefStr | <code>string</code> | OCG 物件參照字串 |

<a name="generateAnnotationPreviewUrl"></a>

## generateAnnotationPreviewUrl(annotRefStr, pageIndex, annotIndex) ⇒ <code>Promise.&lt;string&gt;</code>
生成 Annotation (註解) 的即時預覽 URL (高亮顯示所在位置)

**Kind**: global function  
**Returns**: <code>Promise.&lt;string&gt;</code> - Blob URL  

| Param | Type | Description |
| --- | --- | --- |
| annotRefStr | <code>string</code> | 註解物件參照字串 |
| pageIndex | <code>number</code> | 頁面索引 (0-indexed) |
| annotIndex | <code>number</code> | 註解在陣列中的索引 |

<a name="generateDirectContentPreviewUrl"></a>

## generateDirectContentPreviewUrl(streamRefStr, pageIndex, streamIndex) ⇒ <code>Promise.&lt;string&gt;</code>
生成 Direct Content (頁面直接內容) 的即時預覽 URL

**Kind**: global function  
**Returns**: <code>Promise.&lt;string&gt;</code> - Blob URL  

| Param | Type | Description |
| --- | --- | --- |
| streamRefStr | <code>string</code> | 串流參照字串 |
| pageIndex | <code>number</code> | 頁面索引 (0-indexed) |
| streamIndex | <code>number</code> | 串流在 Contents 陣列中的索引 |

<a name="updateScanResultUI"></a>

## updateScanResultUI(optionsContainer)
掃描完成後更新 UI：根據偵測結果顯示/隱藏策略列、自動勾選疑似浮水印策略，並給出掃描摘要提示。

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| optionsContainer | <code>HTMLElement</code> | 策略選項容器 DOM 元素 |

<a name="loadAndDecryptPdf"></a>

## loadAndDecryptPdf(file) ⇒ <code>Promise.&lt;{previewBytes: Uint8Array, needsPassword: boolean, decryptedSuccessfully: boolean}&gt;</code>
讀取原始位元組，嘗試偵測是否有開啟密碼並進行解密

**Kind**: global function  
**Returns**: <code>Promise.&lt;{previewBytes: Uint8Array, needsPassword: boolean, decryptedSuccessfully: boolean}&gt;</code> - 解密狀態與位元組結果  

| Param | Type | Description |
| --- | --- | --- |
| file | <code>File</code> | 使用者上傳的原始 PDF 檔案 |

<a name="scanOCG"></a>

## scanOCG(scanDoc)
掃描並記錄 PDF 中的選擇性內容群組 (OCG)

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| scanDoc | <code>PDFDocument</code> | 欲掃描的 PDFDocument 實例 |

<a name="scanAnnotations"></a>

## scanAnnotations(scanDoc, page, pageIndex)
掃描並記錄指定頁面中的註解 (Annotations)

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| scanDoc | <code>PDFDocument</code> | 欲掃描的 PDFDocument 實例 |
| page | <code>PDFPage</code> | 目標頁面物件 |
| pageIndex | <code>number</code> | 頁面索引 (0-based) |

<a name="registerOrUpdateXObject"></a>

## registerOrUpdateXObject(detectedMap, refStr, pageIndex, createEntryFn, isSuspectFn, destroyList)
輔助函式：註冊或更新跨頁的 XObject (共用於 Form 與 Image)

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| detectedMap | <code>Map</code> | 目標偵測 Map |
| refStr | <code>string</code> | 物件參照字串 |
| pageIndex | <code>number</code> | 當前頁面索引 (0-based) |
| createEntryFn | <code>function</code> | 建立新 entry 的回呼函式 |
| isSuspectFn | <code>function</code> | 判斷是否為浮水印的回呼函式 |
| destroyList | <code>Array.&lt;string&gt;</code> | 待刪除清單 |

<a name="registerSuspectEntry"></a>

## registerSuspectEntry(detectedMap, key, entry, isSuspectFn, destroyList)
輔助函式：註冊偵測到的物件並判斷是否為浮水印 (供單頁/全域物件共用)

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| detectedMap | <code>Map</code> | 目標偵測 Map |
| key | <code>string</code> | 物件鍵值或識別碼 |
| entry | <code>Object</code> | 物件資料實體 |
| isSuspectFn | <code>function</code> | 判斷是否為浮水印的回呼函式 |
| destroyList | <code>Array.&lt;string&gt;</code> | 待刪除清單 |

<a name="scanResources"></a>

## scanResources(scanDoc, page, pageIndex)
掃描並記錄指定頁面中的資源 (Resources)，包含 XObject 與 ExtGState

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| scanDoc | <code>PDFDocument</code> | 欲掃描的 PDFDocument 實例 |
| page | <code>PDFPage</code> | 目標頁面物件 |
| pageIndex | <code>number</code> | 頁面索引 (0-based) |

<a name="scanResources..traverseResources"></a>

### scanResources~traverseResources(resourcesNode) ⇒ <code>void</code>
內部遞迴函式：深入遍歷 Resources 節點，找出並註冊可疑的 XObject 與 ExtGState 物件

**Kind**: inner method of [<code>scanResources</code>](#scanResources)  

| Param | Type | Description |
| --- | --- | --- |
| resourcesNode | <code>PDFObject</code> \| <code>PDFDict</code> | 欲掃描的 Resources 節點 |

<a name="scanDirectContent"></a>

## scanDirectContent(scanDoc, page, pageIndex)
掃描並記錄指定頁面中的直接內容 (Direct Content)

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| scanDoc | <code>PDFDocument</code> | 欲掃描的 PDFDocument 實例 |
| page | <code>PDFPage</code> | 目標頁面物件 |
| pageIndex | <code>number</code> | 頁面索引 (0-based) |

<a name="applyHeuristicThreshold"></a>

## applyHeuristicThreshold(detectedMap, destroyList, threshold, pageCount)
輔助函式：套用高頻特徵門檻 (Heuristic Threshold) 判定
共用於 Form XObject 與 Image XObject 的智慧偵測

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| detectedMap | <code>Map</code> | 偵測到的物件 Map |
| destroyList | <code>Array.&lt;string&gt;</code> | 待刪除的目標陣列 |
| threshold | <code>number</code> | 頻率門檻 (0~1) |
| pageCount | <code>number</code> | 總頁數 |

<a name="performBackgroundScan"></a>

## performBackgroundScan(scanDoc)
進行背景高速掃描以找出 PDF 中可能包含浮水印的物件

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| scanDoc | <code>PDFDocument</code> | 欲掃描的 PDFDocument 實例 |

<a name="prepareScanContext"></a>

## prepareScanContext(file)
載入新 PDF 後立即偵測加密狀態，若需要開啟密碼則向使用者詢問，
並將解密後的位元組與密碼快取，最後顯示預覽。

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| file | <code>File</code> | 使用者上傳的原始 PDF 檔案 |

<a name="renderPreview"></a>

## renderPreview(bytes, needsPassword, decryptedSuccessfully)
將解密後的 PDF 內容轉為 Blob 並顯示於畫面上的預覽 iframe 中。

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| bytes | <code>Uint8Array</code> | 欲預覽的 PDF 位元組陣列 |
| needsPassword | <code>boolean</code> | 原檔案是否需要密碼 |
| decryptedSuccessfully | <code>boolean</code> | 是否已成功解密 |

<a name="addStatusMessage"></a>

## addStatusMessage(text, type) ⇒ <code>void</code>
追加一條狀態日誌到控制台面板中，並自動滾動到最下方

**Kind**: global function  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| text | <code>string</code> |  | 日誌文字內容 |
| type | <code>string</code> | <code>&quot;info&quot;</code> | 日誌類型 ('info', 'success', 'error') |

<a name="clearStatusMessages"></a>

## clearStatusMessages() ⇒ <code>void</code>
清空控制台面板的所有日誌

**Kind**: global function  
<a name="decryptWithQpdfWasm"></a>

## decryptWithQpdfWasm(pdfBytes, password) ⇒ <code>Promise.&lt;Uint8Array&gt;</code>
使用 qpdf-wasm 引擎解密加密的 PDF 文件

此函式採用「延遲載入 (Lazy Load)」策略，僅在遇到有開啟密碼或編輯限制的 PDF 時，
才會從高速 CDN 載入約 1.8MB 的 QPDF WebAssembly 模組，節省初始頁面載入頻寬。
支援所有標準的 PDF 加密演算法（AES-256、AES-128、RC4 等），並能正確修復損壞的 XRef 與 Object Stream。

**Kind**: global function  
**Returns**: <code>Promise.&lt;Uint8Array&gt;</code> - - 解密完成後乾淨的 PDF 二進位位元組陣列  

| Param | Type | Description |
| --- | --- | --- |
| pdfBytes | <code>Uint8Array</code> | 原始加密 PDF 的二進位位元組陣列 |
| password | <code>string</code> | 使用者輸入的解密密碼（若僅有編輯限制則傳入空字串 ""） |

<a name="promptForPassword"></a>

## promptForPassword([isRetry]) ⇒ <code>Promise.&lt;(string\|null)&gt;</code>
顯示密碼彈窗並等待使用者輸入

**Kind**: global function  
**Returns**: <code>Promise.&lt;(string\|null)&gt;</code> - 回傳解決為密碼字串或 null (取消)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [isRetry] | <code>boolean</code> | <code>false</code> | 是否為重試輸入密碼 |

<a name="resetAllState"></a>

## resetAllState() ⇒ <code>void</code>
重置所有狀態與暫存，確保新檔案載入時不殘留舊狀態

**Kind**: global function  
<a name="clearPreviewUrlCache"></a>

## clearPreviewUrlCache() ⇒ <code>void</code>
釋放並清空預覽用的 Blob URL 快取，避免記憶體洩漏

**Kind**: global function  
<a name="customConfirm"></a>

## customConfirm(message) ⇒ <code>Promise.&lt;boolean&gt;</code>
顯示自訂的確認彈窗 (Custom Confirm Modal)
取代瀏覽器原生的 confirm()，提供更一致的 UI 體驗

**Kind**: global function  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - 使用者點擊確定回傳 true，取消回傳 false  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | 要顯示的確認訊息 |

<a name="appendHeuristicBadge"></a>

## appendHeuristicBadge(parentEl)
輔助函式：為 UI 標籤加上高頻偵測的視覺徽章
共用於 Form XObject 與 Image XObject

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| parentEl | <code>HTMLElement</code> | 要附加徽章的父元素 |

<a name="openObjectPreview"></a>

## openObjectPreview(strategyType, key, entry) ⇒ <code>Promise.&lt;void&gt;</code>
輔助函式：安全地跳脫 HTML 特殊字元，防止 XSS
開啟物件即時預覽彈窗

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| strategyType | <code>string</code> | 策略類型 (如 'formXObjectItem', 'imageXObjectItem', 'directContentItem', 'annotItem', 'ocgItem') |
| key | <code>string</code> | 物件鍵值或識別碼 |
| entry | <code>Object</code> | 物件資料實體 |

<a name="closeObjectPreview"></a>

## closeObjectPreview() ⇒ <code>void</code>
關閉物件即時預覽彈窗，並即時釋放該預覽 PDF 的 Blob URL 以防止記憶體洩漏

**Kind**: global function  
<a name="escapeHTML"></a>

## escapeHTML(str) ⇒ <code>string</code>
將使用者輸入字串進行 HTML 跳脫，防止 XSS (Cross-Site Scripting) 攻擊

**Kind**: global function  
**Returns**: <code>string</code> - 跳脫後的字串  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | 原始字串 |

<a name="escapeRegex"></a>

## escapeRegex(str) ⇒ <code>string</code>
將字串中的正則表達式特殊字元進行跳脫，以安全地嵌入 RegExp 建構式

**Kind**: global function  
**Returns**: <code>string</code> - 跳脫後的字串  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | 需要跳脫的原始字串 |

<a name="isSuspectKeyName"></a>

## isSuspectKeyName(text) ⇒ <code>boolean</code>
判定資源鍵名或圖層名稱是否含有疑似浮水印的特徵

**Kind**: global function  
**Returns**: <code>boolean</code> - 若包含浮水印特徵則回傳 true，否則回傳 false  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | 鍵名或圖層名稱 |

<a name="isSuspectContentText"></a>

## isSuspectContentText(text) ⇒ <code>boolean</code>
判定實際內容文字流中是否含有疑似浮水印的特徵

注意：FINAL_CONTENT_KEYWORDS 同時包含：
  1. 可讀的英文/中文字串（toLowerCase 比對）
  2. UTF-16BE Latin1 / Big5 的二進位特徵碼（不可 toLowerCase，否則會破壞位元組值）
因此必須對兩類分別比對：英文全小寫比對，二進位直接對原始 text 比對。

**Kind**: global function  
**Returns**: <code>boolean</code> - 若包含浮水印特徵則回傳 true，否則回傳 false  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | 內容流文字（以 Latin1 解碼的二進位字串） |

<a name="isSuspectFormXObject"></a>

## isSuspectFormXObject(entry, [rawStr]) ⇒ <code>boolean</code>
策略 1: 表單外部物件 (Form XObject) 判定

**Kind**: global function  
**Returns**: <code>boolean</code> - 是否為疑似浮水印  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| entry | <code>Object</code> |  | 表單外部物件偵測 Entry |
| [rawStr] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | 原始內容流文字 (可選) |

<a name="isSuspectAnnotation"></a>

## isSuspectAnnotation(entry) ⇒ <code>boolean</code>
策略 2: 註解 (Annotation) 判定

**Kind**: global function  
**Returns**: <code>boolean</code> - 是否為疑似浮水印  

| Param | Type | Description |
| --- | --- | --- |
| entry | <code>Object</code> | 註解偵測 Entry |

<a name="isSuspectDirectContent"></a>

## isSuspectDirectContent(entry) ⇒ <code>boolean</code>
策略 3: 頁面直接內容 (Direct Content) 判定

**Kind**: global function  
**Returns**: <code>boolean</code> - 是否為疑似浮水印  

| Param | Type | Description |
| --- | --- | --- |
| entry | <code>Object</code> | 頁面直接內容偵測 Entry |

<a name="isSuspectImageXObject"></a>

## isSuspectImageXObject(entry) ⇒ <code>boolean</code>
策略 4: 影像外部物件 (Image XObject) 判定

**Kind**: global function  
**Returns**: <code>boolean</code> - 是否為疑似浮水印  

| Param | Type | Description |
| --- | --- | --- |
| entry | <code>Object</code> | 影像外部物件偵測 Entry |

<a name="isSuspectExtGState"></a>

## isSuspectExtGState(entry) ⇒ <code>boolean</code>
策略 5: 延伸圖形狀態 (ExtGState) 判定

**Kind**: global function  
**Returns**: <code>boolean</code> - 是否為疑似浮水印  

| Param | Type | Description |
| --- | --- | --- |
| entry | <code>Object</code> | 延伸圖形狀態偵測 Entry |

<a name="isSuspectOCG"></a>

## isSuspectOCG(entry) ⇒ <code>boolean</code>
策略 6: 選擇性內容群組 (OCG) 判定

**Kind**: global function  
**Returns**: <code>boolean</code> - 是否為疑似浮水印  

| Param | Type | Description |
| --- | --- | --- |
| entry | <code>Object</code> | 選擇性內容群組偵測 Entry |

<a name="decodeBinaryToText"></a>

## decodeBinaryToText(data) ⇒ <code>string</code>
將 Uint8Array 以二進位字串的方式精確轉換（避免 TextDecoder 將非 UTF-8 字元變成亂碼）

**Kind**: global function  
**Returns**: <code>string</code> - 轉換後的字串  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Uint8Array</code> | 二進位資料陣列 |

<a name="encodeTextToBinary"></a>

## encodeTextToBinary(text) ⇒ <code>Uint8Array</code>
將二進位 Latin1 字串安全地轉換回 Uint8Array 位元組陣列

**Kind**: global function  
**Returns**: <code>Uint8Array</code> - 轉換後的位元組陣列  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | Latin1 格式的二進位字串 |

<a name="compileToBig5Latin1"></a>

## compileToBig5Latin1(str) ⇒ <code>string</code>
將字串動態編譯為 Big5 格式的 Latin1 字串
依賴 text-encoding polyfill (NONSTANDARD_allowLegacyEncoding)

**Kind**: global function  
**Returns**: <code>string</code> - Big5 編碼的 Latin1 字串，若失敗則回傳空字串  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | 輸入字串 |

<a name="compileToUTF16BELatin1"></a>

## compileToUTF16BELatin1(str) ⇒ <code>string</code>
將正規 UTF-8 字串動態編譯為 PDF 標準中文字型 UTF-16BE 在 Latin1 解碼流下的二進位特徵碼

**Kind**: global function  
**Returns**: <code>string</code> - Latin1 格式的特徵碼  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | 輸入中文 |

<a name="decodeHexStringsInText"></a>

## decodeHexStringsInText(text) ⇒ <code>string</code>
將內容文字流中可能含有的 PDF 十六進位字串 <...> 萃取並還原為 Latin1 字串

**Kind**: global function  
**Returns**: <code>string</code> - 包含已還原之十六進位內容的完整文字字串  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | 原始內容文字流 |

<a name="getDecodedStreamContents"></a>

## getDecodedStreamContents(stream) ⇒ <code>Uint8Array</code>
安全地獲取並解壓縮 PDFRawStream 的二進位內容

**Kind**: global function  
**Returns**: <code>Uint8Array</code> - 解密解壓後的二進位資料  

| Param | Type | Description |
| --- | --- | --- |
| stream | <code>PDFRawStream</code> | PDF 原始二進位串流 |

