import fs from 'fs';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const epubBase64 = fs.readFileSync('Isekaied_to_Save_the.epub').toString('base64');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  const res = await page.evaluate(async (b64) => {
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes.buffer);
    
    // Test TOC parsing
    const parser = new DOMParser();
    const ncx = await zip.file('toc.ncx')?.async('string');
    const ncxDoc = parser.parseFromString(ncx, 'application/xml');
    const navPoints = ncxDoc.getElementsByTagName('navPoint');
    const tocMap = {};
    for (let i = 0; i < navPoints.length; i++) {
      const label = navPoints[i].getElementsByTagName('text')[0]?.textContent?.trim();
      const src = navPoints[i].getElementsByTagName('content')[0]?.getAttribute('src') || '';
      tocMap[src.split('#')[0]] = label;
    }

    return tocMap;
  }, epubBase64);

  console.log('TOC MAP:', res);
  await browser.close();
})();
