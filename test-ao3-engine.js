import fs from 'fs';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const epubBase64 = fs.readFileSync('Isekaied_to_Save_the.epub').toString('base64');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  const parsed = await page.evaluate(async (b64) => {
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes.buffer);
    
    const parser = new DOMParser();
    
    // 1. Locate rootfile
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    const containerDoc = parser.parseFromString(containerXml, 'application/xml');
    const rootPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') || 'content.opf';
    const rootDir = rootPath.includes('/') ? rootPath.substring(0, rootPath.lastIndexOf('/') + 1) : '';
    
    const opfContent = await zip.file(rootPath)?.async('string');
    const opfDoc = parser.parseFromString(opfContent, 'application/xml');
    
    // Metadata extraction
    const getMeta = (tag) => {
      const el = opfDoc.getElementsByTagName(tag)[0] || 
                 opfDoc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', tag.replace('dc:', ''))[0];
      return el ? el.textContent?.trim() : '';
    };

    const docTitle = getMeta('dc:title') || 'Untitled Book';
    const creator = getMeta('dc:creator') || 'Unknown Author';
    const description = getMeta('dc:description') || '';
    
    // Manifest & Spine
    const manifest = new Map();
    const items = opfDoc.getElementsByTagName('item');
    for (let i = 0; i < items.length; i++) {
      manifest.set(items[i].getAttribute('id') || '', items[i].getAttribute('href') || '');
    }
    
    // TOC
    const tocMap = new Map(); // href -> title
    const ncxContent = await zip.file(rootDir + 'toc.ncx')?.async('string') || await zip.file('toc.ncx')?.async('string');
    if (ncxContent) {
      const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
      const navPoints = ncxDoc.getElementsByTagName('navPoint');
      for (let i = 0; i < navPoints.length; i++) {
        const text = navPoints[i].getElementsByTagName('text')[0]?.textContent?.trim();
        const src = navPoints[i].getElementsByTagName('content')[0]?.getAttribute('src') || '';
        const cleanSrc = src.split('#')[0];
        if (text && cleanSrc) {
          tocMap.set(cleanSrc, text);
        }
      }
    }
    
    const spineHrefs = [];
    const itemrefs = opfDoc.getElementsByTagName('itemref');
    for (let i = 0; i < itemrefs.length; i++) {
      const id = itemrefs[i].getAttribute('idref') || '';
      const href = manifest.get(id);
      if (href) spineHrefs.push(href);
    }

    // Check if this is an AO3 work
    let isAO3 = false;
    let ao3WorkUrl = '';
    let ao3Tags = {};
    let ao3Summary = description;
    let ao3Author = creator;
    
    // First pass: scan files for AO3 characteristics
    const fileDocs = [];
    for (const href of spineHrefs) {
      const fullPath = rootDir + decodeURIComponent(href);
      let content = await zip.file(fullPath)?.async('string') || await zip.file(rootDir + href)?.async('string');
      if (!content) continue;
      
      const doc = parser.parseFromString(content, 'text/html');
      fileDocs.push({ href, doc, raw: content });
      
      if (content.includes('archiveofourown.org') || doc.querySelector('.userstuff, .userstuff1, .userstuff2, dl.tags')) {
        isAO3 = true;
      }
      
      // Look for AO3 work URL
      const link = doc.querySelector('a[href*="archiveofourown.org/works/"]');
      if (link) ao3WorkUrl = link.getAttribute('href');
      
      // Look for dl.tags
      const dlTags = doc.querySelector('dl.tags');
      if (dlTags) {
        const dts = dlTags.querySelectorAll('dt');
        const dds = dlTags.querySelectorAll('dd');
        for (let j = 0; j < Math.min(dts.length, dds.length); j++) {
          const key = dts[j].textContent?.replace(':', '').trim();
          const val = dds[j].textContent?.trim();
          if (key && val) ao3Tags[key] = val;
        }
      }
      
      // Look for author byline
      const byline = doc.querySelector('.byline');
      if (byline) ao3Author = byline.textContent.replace(/^by\s+/i, '').trim();
      
      // Look for summary blockquote
      const summaryBlock = doc.querySelector('blockquote.userstuff');
      if (summaryBlock && !ao3Summary) {
        ao3Summary = summaryBlock.innerHTML.trim();
      }
    }

    return {
      isAO3,
      docTitle,
      ao3Author,
      ao3WorkUrl,
      ao3Tags,
      spineCount: spineHrefs.length,
      tocEntries: Array.from(tocMap.entries())
    };
  }, epubBase64);

  console.log('AO3 DETECTION RESULT:', JSON.stringify(parsed, null, 2));
  await browser.close();
})();
