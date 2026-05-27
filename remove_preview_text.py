import re

with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip_mode = False

for line in lines:
    # Remove extractPreviewTextFromRawStream
    if "function extractPreviewTextFromRawStream" in line:
        skip_mode = True
        continue
    
    if skip_mode:
        if "return previewText;" in line:
            skip_mode = False
        continue

    # Remove previewText from maps
    line = line.replace(" previewText, ", " ")
    
    # Remove from isSuspect checks
    line = line.replace("isSuspectedWatermark(entry.previewText) || ", "")
    
    # Remove from UI rendering
    line = re.sub(r'\(\$\{entry\.previewText\}\)\s*', '', line)
    line = line.replace('entry.previewText + ', '')
    line = line.replace('const contentDisplay = entry.previewText ? ` "${entry.previewText}"` : "";', 'const contentDisplay = "";')
    line = line.replace('return annotA.previewText.localeCompare(annotB.previewText);', 'return 0;')
    if "getSortCompare:" in line and "previewText" in line:
        line = line.replace('a[1].previewText.localeCompare(b[1].previewText)', '0')
    if "let labelText = entry.previewText.startsWith" in line:
        line = '                let labelText = `[頁面直接內容] (第 ${entry.page} 頁)`;\n'
    if "previewText:" in line:
        if "keyName: keyName, previewText: previewText, pages: [i + 1]" in line:
            line = line.replace("previewText: previewText,", "")
        else:
            continue # drop lines that are just `previewText: ...`
            
    if "let previewText =" in line or "previewText =" in line:
        if "extractPreviewTextFromRawStream" in line:
            continue
        if "decodeText" in line or "toString" in line:
            continue
        if "previewText.substring" in line or "previewText.length" in line:
            continue
        if "details.length > 0" in line:
            continue
        continue

    # 2484: let previewText = "";
    # 2488: previewText = contentsObj.decodeText();
    # 2490: previewText = contentsObj.toString();
    # 2495: if (previewText.length > 50) {
    # 2496: previewText = previewText.substring(0, 50) + "...";
    
    if "isSuspectedWatermark(previewText) ||" in line:
        line = line.replace("isSuspectedWatermark(previewText) || ", "")
        
    new_lines.append(line)

with open('index_new.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
    
print(f"Original lines: {len(lines)}")
print(f"New lines: {len(new_lines)}")
