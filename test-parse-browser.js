import fs from 'fs';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const epubBase64 = fs.readFileSync('Isekaied_to_Save_the.epub').toString('base64');
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  const result = await page.evaluate(async (b64) => {
    // Decode base64 to array buffer
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Check if JSZip is on window or import it
    const JSZip = window.JSZip || (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes.buffer);
    
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXml, 'application/xml');
    const rootPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
    
    const opfContent = await zip.file(rootPath)?.async('string');
    const opfDoc = parser.parseFromString(opfContent, 'application/xml');
    
    const title = opfDoc.getElementsByTagName('dc:title')[0]?.textContent || 'Untitled';
    const creator = opfDoc.getElementsByTagName('dc:creator')[0]?.textContent || 'Unknown';
    const description = opfDoc.getElementsByTagName('dc:description')[0]?.textContent || '';
    
    // Check ncx
    const ncxContent = await zip.file('toc.ncx')?.async('string');
    let tocEntries = [];
    if (ncxContent) {
      const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
      const navPoints = ncxDoc.getElementsByTagName('navPoint');
      for (let i = 0; i < navPoints.length; i++) {
        const text = navPoints[i].getElementsByTagName('text')[0]?.textContent;
        const src = navPoints[i].getElementsByTagName('content')[0]?.getAttribute('src');
        tocEntries.push({ text, src });
      }
    }
    
    const spine = [];
    const manifest = new Map();
    const items = opfDoc.getElementsByTagName('item');
    for (let i = 0; i < items.length; i++) {
      manifest.set(items[i].getAttribute('id'), items[i].getAttribute('href'));
    }
    const itemrefs = opfDoc.getElementsByTagName('itemref');
    for (let i = 0; i < itemrefs.length; i++) {
      const href = manifest.get(itemrefs[i].getAttribute('idref'));
      if (href) spine.push(href);
    }
    
    const filePreviews = [];
    for (const href of spine) {
      const html = await zip.file(href)?.async('string');
      const doc = parser.parseFromString(html, 'text/html');
      const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, .heading, .title')).map(h => ({
        tag: h.tagName,
        cls: h.className,
        text: h.textContent.trim()
      }));
      filePreviews.push({
        href,
        length: html ? html.length : 0,
        headings,
        snippet: doc.body.textContent.trim().substring(0, 150)
      });
    }

    return { title, creator, description, tocEntries, spine, filePreviews };
  }, epubBase64);
  
  console.log('EPUB RESULT:', JSON.stringify(result, null, 2));
  await browser.close();
})();
