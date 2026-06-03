const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Evaluate a script where we load text-encoding natively
    await page.goto('about:blank');
    const result = await page.evaluate(async () => {
        // Load text-encoding without touching window.TextEncoder
        await new Promise((resolve) => {
            const script1 = document.createElement('script');
            script1.src = 'https://cdn.jsdelivr.net/npm/text-encoding@0.7.0/lib/encoding-indexes.js';
            document.head.appendChild(script1);
            script1.onload = resolve;
        });
        await new Promise((resolve) => {
            const script2 = document.createElement('script');
            script2.src = 'https://cdn.jsdelivr.net/npm/text-encoding@0.7.0/lib/encoding.min.js';
            document.head.appendChild(script2);
            script2.onload = resolve;
        });
        
        // Now check if TextEncoder exposes something else?
        const hasTextEncoding = typeof window.TextEncoding !== 'undefined';
        const isNative = window.TextEncoder.toString().includes('native code');
        return { hasTextEncoding, isNative, keys: Object.keys(window).filter(k => k.toLowerCase().includes('textenc')) };
    });
    
    console.log(result);
    await browser.close();
})();
