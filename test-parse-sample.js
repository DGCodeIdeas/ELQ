import fs from 'fs';
import JSZip from 'jszip';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
const DOMParser = dom.window.DOMParser;
const XMLSerializer = dom.window.XMLSerializer;

async function parseEpub(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  
  // 1. Locate rootfile
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  console.log('container.xml:', containerXml);
  
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const rootPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
  console.log('rootPath:', rootPath);
  
  const opfContent = await zip.file(rootPath)?.async('string');
  const opfDoc = parser.parseFromString(opfContent, 'application/xml');
  
  const titleNodes = opfDoc.getElementsByTagName('dc:title');
  console.log('titleNodes length:', titleNodes.length, titleNodes[0]?.textContent);
  
  const manifest = new Map();
  const items = opfDoc.getElementsByTagName('item');
  for (let i = 0; i < items.length; i++) {
    manifest.set(items[i].getAttribute('id') || '', items[i].getAttribute('href') || '');
  }

  // TOC checking
  const ncxContent = await zip.file('toc.ncx')?.async('string');
  if (ncxContent) {
    const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
    const navPoints = ncxDoc.getElementsByTagName('navPoint');
    console.log('navPoints in toc.ncx:', navPoints.length);
    for (let i = 0; i < navPoints.length; i++) {
      const np = navPoints[i];
      const navLabel = np.getElementsByTagName('text')[0]?.textContent;
      const contentSrc = np.getElementsByTagName('content')[0]?.getAttribute('src');
      console.log(`  TOC [${i}]: "${navLabel}" -> src="${contentSrc}"`);
    }
  }

  const spineRefs = [];
  const itemrefs = opfDoc.getElementsByTagName('itemref');
  for (let i = 0; i < itemrefs.length; i++) {
    const id = itemrefs[i].getAttribute('idref') || '';
    const href = manifest.get(id);
    if (href) spineRefs.push(href);
  }
  console.log('spineRefs:', spineRefs);

  for (let i = 0; i < spineRefs.length; i++) {
    const href = spineRefs[i];
    const htmlContent = await zip.file(href)?.async('string');
    console.log(`\n--- Spine item [${i}] ${href} (length ${htmlContent?.length}) ---`);
    if (htmlContent) {
      const doc = parser.parseFromString(htmlContent, 'text/html');
      console.log('First 300 chars of body:', doc.body.innerHTML.substring(0, 300));
    }
  }
}

const buf = fs.readFileSync('Isekaied_to_Save_the.epub');
parseEpub(buf).catch(console.error);
