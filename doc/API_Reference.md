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
<dt><a href="#previewUrlCache">previewUrlCache</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>預覽 Blob URL 快取（換檔時清除）</p>
</dd>
<dt><a href="#lastSuccessPassword">lastSuccessPassword</a> : <code>string</code> | <code>null</code></dt>
<dd><p>跨檔案成功解密的開啟密碼暫存（執行期記憶體快取，不落地儲存）</p>
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
<dt><a href="#detectedExtGStates">detectedExtGStates</a> : <code>Map.&lt;string, {keyName: string, page: number, ref: any, detailText: string, caVal: number, CAVal: number}&gt;</code></dt>
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
</dl>

## Constants

<dl>
<dt><a href="#DEFAULT_KEY_KEYWORDS">DEFAULT_KEY_KEYWORDS</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>預設的資源鍵名與圖層名稱關鍵字</p>
</dd>
<dt><a href="#DEFAULT_CONTENT_KEYWORDS">DEFAULT_CONTENT_KEYWORDS</a> : <code>Array.&lt;string&gt;</code></dt>
<dd><p>預設的實際內容文字關鍵字</p>
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
<dt><a href="#chkRemoveFormXObject">chkRemoveFormXObject</a> : <code>HTMLInputElement</code></dt>
<dd><p>是否移除表單外部物件 (Form XObject) 的核取方塊</p>
</dd>
<dt><a href="#chkRemoveAnnotations">chkRemoveAnnotations</a> : <code>HTMLInputElement</code></dt>
<dd><p>是否移除註解 (Annotations) 的核取方塊</p>
</dd>
<dt><a href="#chkRemoveDirectContent">chkRemoveDirectContent</a> : <code>HTMLInputElement</code></dt>
<dd><p>是否移除頁面直接內容 (Direct Content) 的核取方塊</p>
</dd>
<dt><a href="#chkRemoveImageXObject">chkRemoveImageXObject</a> : <code>HTMLInputElement</code></dt>
<dd><p>是否移除影像外部物件 (Image XObject) 的核取方塊</p>
</dd>
<dt><a href="#chkRemoveExtGState">chkRemoveExtGState</a> : <code>HTMLInputElement</code></dt>
<dd><p>是否移除延伸圖形狀態 (ExtGState) 的核取方塊</p>
</dd>
<dt><a href="#chkRemoveOCG">chkRemoveOCG</a> : <code>HTMLInputElement</code></dt>
<dd><p>是否移除選擇性內容群組 (OCG) 的核取方塊</p>
</dd>
<dt><a href="#annotSubtypeMeta">annotSubtypeMeta</a> : <code>Object.&lt;string, {label: string, defaultDestroy: boolean, color: string}&gt;</code></dt>
<dd><p>註解 (Annotation) 子類型元資料設定</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#buildFinalContentKeywords">buildFinalContentKeywords()</a></dt>
<dd><p>根據目前的 WATERMARK_CONTENT_KEYWORDS 建立最終的多重編碼比對特徵碼陣列</p>
</dd>
<dt><a href="#loadGlobalKeywords">loadGlobalKeywords()</a></dt>
<dd><p>載入並初始化全域關鍵字設定（從 localStorage 讀取或使用預設值）</p>
</dd>
<dt><a href="#saveGlobalKeywords">saveGlobalKeywords(keysArray, contentsArray, threshold, heuristicThreshold)</a></dt>
<dd><p>儲存全域設定至 localStorage</p>
</dd>
<dt><a href="#addStatusMessage">addStatusMessage(text, type)</a></dt>
<dd><p>追加一條狀態日誌到控制台面板中，並自動滾動到最下方</p>
</dd>
<dt><a href="#clearStatusMessages">clearStatusMessages()</a></dt>
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
<dt><a href="#resetAllState">resetAllState()</a></dt>
<dd><p>重置所有狀態與暫存，確保新檔案載入時不殘留舊狀態</p>
</dd>
<dt><a href="#clearPreviewUrlCache">clearPreviewUrlCache()</a></dt>
<dd><p>釋放並清空預覽用的 Blob URL 快取，避免記憶體洩漏</p>
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
<dt><a href="#isSuspectFormXObject">isSuspectFormXObject(entry)</a> ⇒ <code>boolean</code></dt>
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
<dt><a href="#compileToBig5Latin1">compileToBig5Latin1()</a></dt>
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
<dt><a href="#decompressFlateDecode">decompressFlateDecode(data)</a> ⇒ <code>Promise.&lt;Uint8Array&gt;</code></dt>
<dd><p>輔助函式：將 Uint8Array 以 zlib/deflate 解壓縮
PDF 的 FlateDecode 為標準 zlib 格式，瀏覽器對應的 DecompressionStream 格式為 &quot;deflate&quot;。
若失敗則嘗試 &quot;deflate-raw&quot;（無 zlib header 的 raw deflate）。</p>
</dd>
<dt><a href="#extractXObjectDrawBlock">extractXObjectDrawBlock(srcDoc, pageIndex, cleanKeyName)</a> ⇒ <code>Promise.&lt;(string|null)&gt;</code></dt>
<dd><p>從頁面的 Contents Stream 中，提取呼叫指定 XObject 前完整的繪圖指令區塊（含 cm 矩陣）</p>
</dd>
<dt><a href="#getPreviewHighlightRawCommand">getPreviewHighlightRawCommand(previewDoc, page, x, y, width, height)</a></dt>
<dd><p>產生共用的預覽標示紅框原始繪圖指令 (供 XObject 預覽使用)</p>
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
<dt><a href="#scanResources">scanResources(scanDoc, page, pageIndex)</a></dt>
<dd><p>掃描並記錄指定頁面中的資源 (Resources)，包含 XObject 與 ExtGState</p>
</dd>
<dt><a href="#scanDirectContent">scanDirectContent(scanDoc, page, pageIndex)</a></dt>
<dd><p>掃描並記錄指定頁面中的直接內容 (Direct Content)</p>
</dd>
<dt><a href="#performBackgroundScan">performBackgroundScan(scanDoc)</a></dt>
<dd><p>進行背景高速掃描以找出 PDF 中可能包含浮水印的物件</p>
</dd>
<dt><a href="#showOriginalPreview">showOriginalPreview(file)</a></dt>
<dd><p>載入新 PDF 後立即偵測加密狀態，若需要開啟密碼則向使用者詢問，
並將解密後的位元組與密碼快取，最後顯示預覽。</p>
</dd>
<dt><a href="#escapeRegex">escapeRegex(str)</a> ⇒ <code>string</code></dt>
<dd><p>將字串中的正則表達式特殊字元進行跳脫，以安全地嵌入 RegExp 建構式</p>
</dd>
<dt><a href="#cleanContentStreams">cleanContentStreams(pdfDoc, page, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys)</a></dt>
<dd><p>清理 content stream 中對已刪除資源的參考，防止 Acrobat Reader 報錯</p>
</dd>
<dt><a href="#processPdf">processPdf(pdfDoc, options)</a> ⇒ <code>Object</code></dt>
<dd><p>核心重構清除引擎：遍歷 PDF 物件樹並執行浮水印置換</p>
<p>為了防止直接刪除 PDF 字典物件導致內部資源樹引用斷裂（引發 PDF 檔損毀打不開），
本清除引擎採用「無損清除技術」—— 將需要清除的物件從資源字典中移除，
並主動清理 Content Stream 中的參照 (如 <code>Do</code>, <code>gs</code>)，確保 PDF 結構完整，防止 Acrobat Reader 報錯。
同時執行單頁資源隔離複製，確保頁面間的修改不互相干擾。</p>
</dd>
<dt><a href="#removeFormXObjects">removeFormXObjects(pdfDoc, resources)</a> ⇒ <code>Object</code></dt>
<dd><p>策略一：清除 Form XObject 浮水印
 Form XObject 是 PDF 用來儲存可重複使用之圖形或背景向量文字的獨立封裝物件。
 大部分的文字浮水印和灰色對角斜線浮水印都屬於此類別。
 逐一檢視 Resources 下的所有 XObject，若符合條件則將其從資源字典中移除。</p>
</dd>
<dt><a href="#removeAnnotations">removeAnnotations(page)</a> ⇒ <code>number</code></dt>
<dd><p>策略二：清除註解 (Annotation)
Annots 是蓋在 PDF 正文上方的附加元件（包括電子簽章、印章、批註等）。
直接在 page.node 中將 /Annots 字典鍵值物理刪除即可，此操作不會損害 PDF 頁面結構。</p>
</dd>
<dt><a href="#removeDirectContent">removeDirectContent(pdfDoc, page)</a> ⇒ <code>number</code></dt>
<dd><p>策略三：檢查並清空可疑內容流
某些 PDF 會直接在 Contents 內容流中以明文字串寫出浮水印文字（例如：/Tj &quot;CONFIDENTIAL&quot;）。
由於 PDF 串流通常已被壓縮（FlateDecode），此處透過 getDecodedStreamContents() 在記憶體中解壓縮，
轉為 UTF-8 明文字串比對特徵關鍵字。若命中，則清空該內容流。</p>
</dd>
<dt><a href="#removeExtGState">removeExtGState(pdfDoc, resources, pageIndex)</a> ⇒ <code>Object</code></dt>
<dd><p>策略五：清理 ExtGState 半透明狀態
 ExtGState 用於綁定半透明效果的透明度設定。某些浮水印會在這裡綁定名稱含 watermark 的透明組態。
 遍歷 Resources 中的 ExtGState 資源，若命名相符，則以空的 ExtGState 物件重置之。</p>
</dd>
<dt><a href="#removeOCGs">removeOCGs(pdfDoc, resources)</a> ⇒ <code>Object</code></dt>
<dd><p>策略六（頁面層級）：清理 OCG 圖層浮水印相關的 Properties 與 XObject 資源
 針對頁面 Resources 中帶有 /OC 屬性且關聯到待刪除 OCG 的 Properties 與 XObject 進行移除。</p>
</dd>
<dt><a href="#removeOCG">removeOCG(pdfDoc)</a> ⇒ <code>number</code></dt>
<dd><p>策略六（全域層級）：針對全域 OCG (圖層) 進行徹底刪除（從 Catalog 中移除）</p>
</dd>
<dt><a href="#removeImageXObjects">removeImageXObjects(pdfDoc, resources, pageIndex)</a> ⇒ <code>Object</code></dt>
<dd><p>策略四：清除圖片型浮水印 (Image XObject)
 當浮水印是由圖片（如公司 LOGO、透明圖片章）組成時，其在資源樹中為 /Image。
 我們會檢查圖片元件的命名與頁面索引的結合鍵是否在 imagesToDestroy 中。
 若符合，則將其從資源字典中移除。</p>
</dd>
<dt><a href="#openObjectPreview">openObjectPreview(strategyType, key, entry)</a></dt>
<dd><p>開啟物件即時預覽彈窗</p>
</dd>
<dt><a href="#closeObjectPreview">closeObjectPreview()</a></dt>
<dd><p>關閉物件即時預覽彈窗，並即時釋放該預覽 PDF 的 Blob URL 以防止記憶體洩漏</p>
</dd>
<dt><a href="#handleFileSelected">handleFileSelected(file)</a></dt>
<dd><p>共用輔助函式：當使用者選取檔案後，統一執行 UI 更新與背景掃描</p>
</dd>
<dt><a href="#formatBytes">formatBytes(bytes)</a> ⇒ <code>string</code></dt>
<dd><p>輔助函式：格式化檔案大小單位</p>
</dd>
<dt><a href="#updateFileAreaDisplay">updateFileAreaDisplay()</a></dt>
<dd><p>依據目前選取的 selectedFile 更新拖曳上傳區域的文字顯示。</p>
</dd>
<dt><a href="#getOptions">getOptions()</a> ⇒ <code>Object</code></dt>
<dd><p>取得目前畫面中 checkbox 勾選的清理選項</p>
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
<a name="previewUrlCache"></a>

## previewUrlCache : <code>Array.&lt;string&gt;</code>
預覽 Blob URL 快取（換檔時清除）

**Kind**: global variable  
<a name="lastSuccessPassword"></a>

## lastSuccessPassword : <code>string</code> \| <code>null</code>
跨檔案成功解密的開啟密碼暫存（執行期記憶體快取，不落地儲存）

**Kind**: global variable  
<a name="detectedFormXObjects"></a>

## detectedFormXObjects : <code>Map.&lt;string, string&gt;</code>
偵測到的表單外部物件 (key = raw stream text, value = extracted display string)

**Kind**: global variable  
<a name="formXObjectsToDestroy"></a>

## formXObjectsToDestroy : <code>Array.&lt;string&gt;</code>
儲存使用者勾選要刪除的 raw stream text

**Kind**: global variable  
<a name="detectedAnnotations"></a>

## detectedAnnotations : <code>Map.&lt;string, any&gt;</code>
當前 PDF 檔案中偵測到的所有註解實例（key = annotRefStr）

**Kind**: global variable  
<a name="annotsToDestroy"></a>

## annotsToDestroy : <code>Array.&lt;string&gt;</code>
要刪除的特定註解參照 (annotRefStr) 清單

**Kind**: global variable  
<a name="detectedDirectContents"></a>

## detectedDirectContents : <code>Map.&lt;string, {page: number, ref: any, rawText: string, streamIndex: number}&gt;</code>
頁面直接內容狀態（key = streamRefStr）

**Kind**: global variable  
<a name="directContentsToDestroy"></a>

## directContentsToDestroy : <code>Array.&lt;string&gt;</code>
儲存選定要清空的頁面直接內容參照字串

**Kind**: global variable  
<a name="detectedImages"></a>

## detectedImages : <code>Map.&lt;string, {keyName: string, pages: Array.&lt;number&gt;, ref: any, rawStream: string, width: number, height: number, filterStr: string}&gt;</code>
影像外部物件狀態（key = refStr）

**Kind**: global variable  
<a name="imagesToDestroy"></a>

## imagesToDestroy : <code>Array.&lt;string&gt;</code>
儲存選定要清除的影像外部物件鍵值

**Kind**: global variable  
<a name="detectedExtGStates"></a>

## detectedExtGStates : <code>Map.&lt;string, {keyName: string, page: number, ref: any, detailText: string, caVal: number, CAVal: number}&gt;</code>
延伸圖形狀態（key = `${page}:${name}`）

**Kind**: global variable  
<a name="extGStatesToDestroy"></a>

## extGStatesToDestroy : <code>Array.&lt;string&gt;</code>
儲存選定要清除的延伸圖形狀態鍵值

**Kind**: global variable  
<a name="detectedOCGs"></a>

## detectedOCGs : <code>Map.&lt;string, {name: string, ref: any}&gt;</code>
選擇性內容群組狀態（key = ocgRefStr）

**Kind**: global variable  
<a name="ocgsToDestroy"></a>

## ocgsToDestroy : <code>Array.&lt;string&gt;</code>
儲存選定要隱藏的 OCG 參照字串

**Kind**: global variable  
<a name="DEFAULT_KEY_KEYWORDS"></a>

## DEFAULT\_KEY\_KEYWORDS : <code>Array.&lt;string&gt;</code>
預設的資源鍵名與圖層名稱關鍵字

**Kind**: global constant  
<a name="DEFAULT_CONTENT_KEYWORDS"></a>

## DEFAULT\_CONTENT\_KEYWORDS : <code>Array.&lt;string&gt;</code>
預設的實際內容文字關鍵字

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
<a name="chkRemoveFormXObject"></a>

## chkRemoveFormXObject : <code>HTMLInputElement</code>
是否移除表單外部物件 (Form XObject) 的核取方塊

**Kind**: global constant  
<a name="chkRemoveAnnotations"></a>

## chkRemoveAnnotations : <code>HTMLInputElement</code>
是否移除註解 (Annotations) 的核取方塊

**Kind**: global constant  
<a name="chkRemoveDirectContent"></a>

## chkRemoveDirectContent : <code>HTMLInputElement</code>
是否移除頁面直接內容 (Direct Content) 的核取方塊

**Kind**: global constant  
<a name="chkRemoveImageXObject"></a>

## chkRemoveImageXObject : <code>HTMLInputElement</code>
是否移除影像外部物件 (Image XObject) 的核取方塊

**Kind**: global constant  
<a name="chkRemoveExtGState"></a>

## chkRemoveExtGState : <code>HTMLInputElement</code>
是否移除延伸圖形狀態 (ExtGState) 的核取方塊

**Kind**: global constant  
<a name="chkRemoveOCG"></a>

## chkRemoveOCG : <code>HTMLInputElement</code>
是否移除選擇性內容群組 (OCG) 的核取方塊

**Kind**: global constant  
<a name="annotSubtypeMeta"></a>

## annotSubtypeMeta : <code>Object.&lt;string, {label: string, defaultDestroy: boolean, color: string}&gt;</code>
註解 (Annotation) 子類型元資料設定

**Kind**: global constant  
<a name="buildFinalContentKeywords"></a>

## buildFinalContentKeywords()
根據目前的 WATERMARK_CONTENT_KEYWORDS 建立最終的多重編碼比對特徵碼陣列

**Kind**: global function  
<a name="loadGlobalKeywords"></a>

## loadGlobalKeywords()
載入並初始化全域關鍵字設定（從 localStorage 讀取或使用預設值）

**Kind**: global function  
<a name="saveGlobalKeywords"></a>

## saveGlobalKeywords(keysArray, contentsArray, threshold, heuristicThreshold)
儲存全域設定至 localStorage

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| keysArray | <code>Array.&lt;string&gt;</code> | 資源鍵名關鍵字陣列 |
| contentsArray | <code>Array.&lt;string&gt;</code> | 內容文字關鍵字陣列 |
| threshold | <code>number</code> | 透明度門檻值 |
| heuristicThreshold | <code>number</code> | 智慧偵測高頻率門檻 |

<a name="addStatusMessage"></a>

## addStatusMessage(text, type)
追加一條狀態日誌到控制台面板中，並自動滾動到最下方

**Kind**: global function  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| text | <code>string</code> |  | 日誌文字內容 |
| type | <code>string</code> | <code>&quot;info&quot;</code> | 日誌類型 ('info', 'success', 'error') |

<a name="clearStatusMessages"></a>

## clearStatusMessages()
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

## resetAllState()
重置所有狀態與暫存，確保新檔案載入時不殘留舊狀態

**Kind**: global function  
<a name="clearPreviewUrlCache"></a>

## clearPreviewUrlCache()
釋放並清空預覽用的 Blob URL 快取，避免記憶體洩漏

**Kind**: global function  
<a name="isSuspectKeyName"></a>

## isSuspectKeyName(text) ⇒ <code>boolean</code>
判定資源鍵名或圖層名稱是否含有疑似浮水印的特徵

**Kind**: global function  

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

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | 內容流文字（以 Latin1 解碼的二進位字串） |

<a name="isSuspectFormXObject"></a>

## isSuspectFormXObject(entry) ⇒ <code>boolean</code>
策略 1: 表單外部物件 (Form XObject) 判定

**Kind**: global function  
**Returns**: <code>boolean</code> - 是否為疑似浮水印  

| Param | Type | Description |
| --- | --- | --- |
| entry | <code>Object</code> | 表單外部物件偵測 Entry |

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

| Param | Type |
| --- | --- |
| data | <code>Uint8Array</code> | 

<a name="compileToBig5Latin1"></a>

## compileToBig5Latin1()
將字串動態編譯為 Big5 格式的 Latin1 字串
依賴 text-encoding polyfill (NONSTANDARD_allowLegacyEncoding)

**Kind**: global function  
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

<a name="decompressFlateDecode"></a>

## decompressFlateDecode(data) ⇒ <code>Promise.&lt;Uint8Array&gt;</code>
輔助函式：將 Uint8Array 以 zlib/deflate 解壓縮
PDF 的 FlateDecode 為標準 zlib 格式，瀏覽器對應的 DecompressionStream 格式為 "deflate"。
若失敗則嘗試 "deflate-raw"（無 zlib header 的 raw deflate）。

**Kind**: global function  
**Returns**: <code>Promise.&lt;Uint8Array&gt;</code> - 解壓縮後的位元組  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Uint8Array</code> | 壓縮後的原始位元組 |

<a name="decompressFlateDecode..tryDecompress"></a>

### decompressFlateDecode~tryDecompress(format)
使用指定格式進行解壓縮的內部實作

**Kind**: inner method of [<code>decompressFlateDecode</code>](#decompressFlateDecode)  

| Param | Type | Description |
| --- | --- | --- |
| format | <code>string</code> | 'deflate' 或 'deflate-raw' |

<a name="extractXObjectDrawBlock"></a>

## extractXObjectDrawBlock(srcDoc, pageIndex, cleanKeyName) ⇒ <code>Promise.&lt;(string\|null)&gt;</code>
從頁面的 Contents Stream 中，提取呼叫指定 XObject 前完整的繪圖指令區塊（含 cm 矩陣）

**Kind**: global function  
**Returns**: <code>Promise.&lt;(string\|null)&gt;</code> - 提取出的繪圖指令字串，若找不到則回傳 null  

| Param | Type | Description |
| --- | --- | --- |
| srcDoc | <code>PDFDocument</code> | 原始 PDF 文件物件 |
| pageIndex | <code>number</code> | 頁面索引 (0-indexed) |
| cleanKeyName | <code>string</code> | 資源鍵名 (不含前綴斜線) |

<a name="getPreviewHighlightRawCommand"></a>

## getPreviewHighlightRawCommand(previewDoc, page, x, y, width, height)
產生共用的預覽標示紅框原始繪圖指令 (供 XObject 預覽使用)

**Kind**: global function  

| Param | Type |
| --- | --- |
| previewDoc | <code>PDFDocument</code> | 
| page | <code>PDFPage</code> | 
| x | <code>number</code> | 
| y | <code>number</code> | 
| width | <code>number</code> | 
| height | <code>number</code> | 

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

| Param | Type |
| --- | --- |
| file | <code>File</code> | 

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

<a name="scanResources"></a>

## scanResources(scanDoc, page, pageIndex)
掃描並記錄指定頁面中的資源 (Resources)，包含 XObject 與 ExtGState

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| scanDoc | <code>PDFDocument</code> | 欲掃描的 PDFDocument 實例 |
| page | <code>PDFPage</code> | 目標頁面物件 |
| pageIndex | <code>number</code> | 頁面索引 (0-based) |

<a name="scanDirectContent"></a>

## scanDirectContent(scanDoc, page, pageIndex)
掃描並記錄指定頁面中的直接內容 (Direct Content)

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| scanDoc | <code>PDFDocument</code> | 欲掃描的 PDFDocument 實例 |
| page | <code>PDFPage</code> | 目標頁面物件 |
| pageIndex | <code>number</code> | 頁面索引 (0-based) |

<a name="performBackgroundScan"></a>

## performBackgroundScan(scanDoc)
進行背景高速掃描以找出 PDF 中可能包含浮水印的物件

**Kind**: global function  

| Param | Type |
| --- | --- |
| scanDoc | <code>PDFDocument</code> | 

<a name="showOriginalPreview"></a>

## showOriginalPreview(file)
載入新 PDF 後立即偵測加密狀態，若需要開啟密碼則向使用者詢問，
並將解密後的位元組與密碼快取，最後顯示預覽。

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| file | <code>File</code> | 使用者上傳的原始 PDF 檔案 |

<a name="escapeRegex"></a>

## escapeRegex(str) ⇒ <code>string</code>
將字串中的正則表達式特殊字元進行跳脫，以安全地嵌入 RegExp 建構式

**Kind**: global function  
**Returns**: <code>string</code> - 跳脫後的字串  

| Param | Type | Description |
| --- | --- | --- |
| str | <code>string</code> | 需要跳脫的原始字串 |

<a name="cleanContentStreams"></a>

## cleanContentStreams(pdfDoc, page, deletedXObjKeys, deletedExtGStateKeys, deletedOcgKeys)
清理 content stream 中對已刪除資源的參考，防止 Acrobat Reader 報錯

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| page | <code>PDFPage</code> | 頁面物件 |
| deletedXObjKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 XObject 鍵名清單 |
| deletedExtGStateKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 ExtGState 鍵名清單 |
| deletedOcgKeys | <code>Array.&lt;string&gt;</code> | 被刪除的 OCG 鍵名清單 |

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

<a name="removeFormXObjects"></a>

## removeFormXObjects(pdfDoc, resources) ⇒ <code>Object</code>
策略一：清除 Form XObject 浮水印
 Form XObject 是 PDF 用來儲存可重複使用之圖形或背景向量文字的獨立封裝物件。
 大部分的文字浮水印和灰色對角斜線浮水印都屬於此類別。
 逐一檢視 Resources 下的所有 XObject，若符合條件則將其從資源字典中移除。

**Kind**: global function  
**Returns**: <code>Object</code> - 清除統計與被刪除的鍵名清單  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| resources | <code>PDFDict</code> | 頁面資源字典 |

<a name="removeAnnotations"></a>

## removeAnnotations(page) ⇒ <code>number</code>
策略二：清除註解 (Annotation)
Annots 是蓋在 PDF 正文上方的附加元件（包括電子簽章、印章、批註等）。
直接在 page.node 中將 /Annots 字典鍵值物理刪除即可，此操作不會損害 PDF 頁面結構。

**Kind**: global function  
**Returns**: <code>number</code> - 實際清除的註解數量  

| Param | Type | Description |
| --- | --- | --- |
| page | <code>PDFPage</code> | 目標頁面物件 |

<a name="removeDirectContent"></a>

## removeDirectContent(pdfDoc, page) ⇒ <code>number</code>
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

<a name="removeExtGState"></a>

## removeExtGState(pdfDoc, resources, pageIndex) ⇒ <code>Object</code>
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

<a name="removeOCGs"></a>

## removeOCGs(pdfDoc, resources) ⇒ <code>Object</code>
策略六（頁面層級）：清理 OCG 圖層浮水印相關的 Properties 與 XObject 資源
 針對頁面 Resources 中帶有 /OC 屬性且關聯到待刪除 OCG 的 Properties 與 XObject 進行移除。

**Kind**: global function  
**Returns**: <code>Object</code> - 清除統計  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |
| resources | <code>PDFDict</code> | 頁面資源字典 |

<a name="removeOCG"></a>

## removeOCG(pdfDoc) ⇒ <code>number</code>
策略六（全域層級）：針對全域 OCG (圖層) 進行徹底刪除（從 Catalog 中移除）

**Kind**: global function  
**Returns**: <code>number</code> - 清除的 OCG 圖層數量  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | PDF 文件物件 |

<a name="removeImageXObjects"></a>

## removeImageXObjects(pdfDoc, resources, pageIndex) ⇒ <code>Object</code>
策略四：清除圖片型浮水印 (Image XObject)
 當浮水印是由圖片（如公司 LOGO、透明圖片章）組成時，其在資源樹中為 /Image。
 我們會檢查圖片元件的命名與頁面索引的結合鍵是否在 imagesToDestroy 中。
 若符合，則將其從資源字典中移除。

**Kind**: global function  
**Returns**: <code>Object</code> - 清除統計與被刪除的鍵名清單  

| Param | Type | Description |
| --- | --- | --- |
| pdfDoc | <code>PDFDocument</code> | 文件物件 |
| resources | <code>PDFDict</code> | 頁面資源字典 |
| pageIndex | <code>number</code> | 當前處理頁面的 0-indexed 索引 |

<a name="openObjectPreview"></a>

## openObjectPreview(strategyType, key, entry)
開啟物件即時預覽彈窗

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| strategyType | <code>string</code> | 策略類型 (如 'formXObjectItem', 'imageXObjectItem', 'directContentItem', 'annotItem', 'ocgItem') |
| key | <code>string</code> | 物件鍵值或識別碼 |
| entry | <code>Object</code> | 物件資料實體 |

<a name="closeObjectPreview"></a>

## closeObjectPreview()
關閉物件即時預覽彈窗，並即時釋放該預覽 PDF 的 Blob URL 以防止記憶體洩漏

**Kind**: global function  
<a name="handleFileSelected"></a>

## handleFileSelected(file)
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

## updateFileAreaDisplay()
依據目前選取的 selectedFile 更新拖曳上傳區域的文字顯示。

**Kind**: global function  
<a name="getOptions"></a>

## getOptions() ⇒ <code>Object</code>
取得目前畫面中 checkbox 勾選的清理選項

**Kind**: global function  
**Returns**: <code>Object</code> - 清理選項物件  
