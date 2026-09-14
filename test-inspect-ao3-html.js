import fs from 'fs';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const epubBase64 = fs.readFileSync('Isekaied_to_Save_the.epub').toString('base64');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  const files = await page.evaluate(async (b64) => {
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes.buffer);
    
    return {
      f0: await zip.file('Isekaied_to_Save_the_split_000.xhtml').async('string'),
      f1: await zip.file('Isekaied_to_Save_the_split_001.xhtml').async('string'),
      f2: (await zip.file('Isekaied_to_Save_the_split_002.xhtml').async('string')).substring(0, 1000)
    };
  }, epubBase64);
  
  console.log('FILE 0:\n', files.f0);
  console.log('FILE 1:\n', files.f1);
  console.log('FILE 2 (HEAD):\n', files.f2);
  await browser.close();
})();
