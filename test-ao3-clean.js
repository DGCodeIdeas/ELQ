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
    
    const parser = new DOMParser();
    const raw = await zip.file('Isekaied_to_Save_the_split_002.xhtml').async('string');
    const doc = parser.parseFromString(raw, 'text/html');
    
    const userstuff = doc.querySelector('.userstuff, .userstuff2, #chapters');
    const heading = doc.querySelector('h1, h2, h3, .heading');
    const title = heading ? heading.textContent.trim() : 'Chapter';
    
    // Remove the heading from the content so it is not duplicated
    if (heading) heading.remove();
    
    // Clean nodes
    const target = userstuff || doc.body;
    const paragraphs = [];
    target.querySelectorAll('p, blockquote, hr, h3, h4').forEach(el => {
      // Clean attributes
      el.removeAttribute('class');
      el.removeAttribute('id');
      el.removeAttribute('style');
      el.querySelectorAll('*').forEach(child => {
        child.removeAttribute('class');
        child.removeAttribute('id');
        child.removeAttribute('style');
      });
      const text = el.textContent?.trim() || '';
      if (el.tagName.toLowerCase() === 'hr' || text.length > 0) {
        paragraphs.push(el.outerHTML);
      }
    });

    return {
      title,
      paragraphCount: paragraphs.length,
      sampleFirstPara: paragraphs[0],
      sampleSecondPara: paragraphs[1]
    };
  }, epubBase64);

  console.log('CLEAN CHAPTER RESULT:', JSON.stringify(res, null, 2));
  await browser.close();
})();
