import fs from 'fs';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const epubBase64 = fs.readFileSync('Isekaied_to_Save_the.epub').toString('base64');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  const result = await page.evaluate(async (b64) => {
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes.buffer);
    
    const parser = new DOMParser();
    
    // 1. Container
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) throw new Error('Missing container.xml');
    const containerDoc = parser.parseFromString(containerXml, 'application/xml');
    const rootPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') || 'content.opf';
    const rootDir = rootPath.includes('/') ? rootPath.substring(0, rootPath.lastIndexOf('/') + 1) : '';
    
    // 2. OPF
    const opfXml = await zip.file(rootPath)?.async('string');
    if (!opfXml) throw new Error('Missing OPF');
    const opfDoc = parser.parseFromString(opfXml, 'application/xml');
    
    const getMeta = (tag) => {
      const el = opfDoc.getElementsByTagName(tag)[0] || 
                 opfDoc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', tag.replace('dc:', ''))[0];
      return el ? el.textContent?.trim() : '';
    };

    let bookTitle = getMeta('dc:title') || 'Untitled Book';
    const creator = getMeta('dc:creator') || 'Unknown Author';
    const description = getMeta('dc:description') || '';
    
    // Manifest & Spine
    const manifest = new Map();
    const items = opfDoc.getElementsByTagName('item');
    for (let i = 0; i < items.length; i++) {
      manifest.set(items[i].getAttribute('id') || '', items[i].getAttribute('href') || '');
    }
    
    // TOC
    const tocMap = new Map();
    const ncxCandidates = [rootDir + 'toc.ncx', 'toc.ncx', rootDir + 'toc.xhtml', 'toc.xhtml'];
    for (const cand of ncxCandidates) {
      const content = await zip.file(cand)?.async('string');
      if (content) {
        if (cand.endsWith('.ncx')) {
          const ncxDoc = parser.parseFromString(content, 'application/xml');
          const navPoints = ncxDoc.getElementsByTagName('navPoint');
          for (let i = 0; i < navPoints.length; i++) {
            const text = navPoints[i].getElementsByTagName('text')[0]?.textContent?.trim();
            const src = navPoints[i].getElementsByTagName('content')[0]?.getAttribute('src') || '';
            const cleanSrc = src.split('#')[0];
            if (text && cleanSrc) tocMap.set(cleanSrc, text);
          }
        }
        break;
      }
    }
    
    const spineHrefs = [];
    const itemrefs = opfDoc.getElementsByTagName('itemref');
    for (let i = 0; i < itemrefs.length; i++) {
      const id = itemrefs[i].getAttribute('idref') || '';
      const href = manifest.get(id);
      if (href) spineHrefs.push(href);
    }

    // Load file contents
    const spineFiles = [];
    let isAO3 = false;
    let ao3Url = '';
    let ao3Tags = {};
    let ao3Author = creator;
    let ao3Summary = description;

    for (const href of spineHrefs) {
      const cleanHref = decodeURIComponent(href);
      const fullPath = rootDir + cleanHref;
      let raw = await zip.file(fullPath)?.async('string');
      if (!raw) raw = await zip.file(rootDir + href)?.async('string');
      if (!raw) continue;
      
      const doc = parser.parseFromString(raw, 'text/html');
      const filename = href.split('/').pop() || href;
      spineFiles.push({ href, filename, doc, raw });
      
      if (raw.includes('archiveofourown.org') || doc.querySelector('.userstuff, .userstuff1, .userstuff2, dl.tags')) {
        isAO3 = true;
      }
      const link = doc.querySelector('a[href*="archiveofourown.org/works/"]');
      if (link && !ao3Url) ao3Url = link.getAttribute('href') || '';
      
      const dlTags = doc.querySelector('dl.tags');
      if (dlTags) {
        const dts = dlTags.querySelectorAll('dt');
        const dds = dlTags.querySelectorAll('dd');
        for (let j = 0; j < Math.min(dts.length, dds.length); j++) {
          const key = dts[j].textContent?.replace(':', '').trim() || '';
          const val = dds[j].textContent?.trim() || '';
          if (key && val) ao3Tags[key] = val;
        }
      }
      
      const byline = doc.querySelector('.byline');
      if (byline && byline.textContent) {
        ao3Author = byline.textContent.replace(/^by\s+/i, '').trim();
      }
      
      const sum = doc.querySelector('blockquote.userstuff');
      if (sum && !ao3Summary) {
        ao3Summary = sum.innerHTML.trim();
      }
    }

    const chapters = [];

    const cleanElementHtml = (el) => {
      const clone = el.cloneNode(true);
      const stripAttrs = (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node;
          const toRemove = [];
          for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i].name;
            if (attr.startsWith('on') || attr.startsWith('mso-') || attr === 'style' || attr === 'class' || attr === 'id') {
              toRemove.push(attr);
            }
          }
          toRemove.forEach(a => element.removeAttribute(a));
          element.childNodes.forEach(stripAttrs);
        }
      };
      stripAttrs(clone);
      return clone.innerHTML.trim();
    };

    if (isAO3) {
      // Build a rich Preface chapter
      let prefaceHtml = `
        <div class="ao3-preface-container space-y-6 pb-6 border-b border-gray-200">
          <div class="text-center space-y-2">
            <h1 class="text-3xl font-bold font-serif text-gray-900">${bookTitle}</h1>
            <p class="text-base text-gray-600 font-medium">by <span class="text-purple-700 font-semibold">${ao3Author}</span></p>
            ${ao3Url ? `<p class="text-xs text-purple-600 hover:underline"><a href="${ao3Url}" target="_blank" rel="noopener noreferrer">View Original on Archive of Our Own ↗</a></p>` : ''}
          </div>

          <!-- AO3 Tags Metadata Grid -->
          <div class="bg-gray-50/90 rounded-2xl p-5 border border-gray-200 text-xs space-y-3 font-sans">
            ${ao3Tags['Rating'] ? `
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0">Rating:</span>
                <span class="px-2.5 py-0.5 rounded-full font-bold ${
                  ao3Tags['Rating'].includes('General') ? 'bg-emerald-100 text-emerald-800' :
                  ao3Tags['Rating'].includes('Teen') ? 'bg-amber-100 text-amber-800' :
                  ao3Tags['Rating'].includes('Mature') ? 'bg-orange-100 text-orange-800' :
                  'bg-rose-100 text-rose-800'
                }">${ao3Tags['Rating']}</span>
              </div>
            ` : ''}

            ${ao3Tags['Archive Warning'] ? `
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0">Warnings:</span>
                <span class="px-2.5 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">${ao3Tags['Archive Warning']}</span>
              </div>
            ` : ''}

            ${ao3Tags['Categories'] ? `
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0">Categories:</span>
                <span class="font-semibold text-gray-800">${ao3Tags['Categories']}</span>
              </div>
            ` : ''}

            ${ao3Tags['Fandom'] ? `
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0">Fandom:</span>
                <span class="px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-800 font-semibold">${ao3Tags['Fandom']}</span>
              </div>
            ` : ''}

            ${ao3Tags['Relationships'] ? `
              <div class="flex items-start gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0 mt-0.5">Relationships:</span>
                <div class="flex flex-wrap gap-1.5">
                  ${ao3Tags['Relationships'].split(',').map(r => `<span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100 font-medium">${r.trim()}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            ${ao3Tags['Additional Tags'] ? `
              <div class="flex items-start gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0 mt-0.5">Tags:</span>
                <div class="flex flex-wrap gap-1">
                  ${ao3Tags['Additional Tags'].split(',').map(t => `<span class="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-[11px]">${t.trim()}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            ${ao3Tags['Stats'] ? `
              <div class="pt-2 border-t border-gray-200 flex flex-wrap gap-4 text-[11px] text-gray-500 font-mono">
                ${ao3Tags['Stats'].replace(/\s+/g, ' ')}
              </div>
            ` : ''}
          </div>

          <!-- Summary Block -->
          ${ao3Summary ? `
            <div class="space-y-2">
              <h3 class="text-xs font-bold uppercase tracking-wider text-gray-400 font-sans">Summary</h3>
              <blockquote class="p-4 bg-purple-50/50 border-l-4 border-purple-500 text-gray-800 italic rounded-r-xl leading-relaxed">
                ${ao3Summary}
              </blockquote>
            </div>
          ` : ''}
        </div>
      `.trim();

      chapters.push({
        id: crypto.randomUUID(),
        title: 'Work Info & Preface',
        content: prefaceHtml,
        lastModified: Date.now()
      });

      // Now process each story chapter
      for (const item of spineFiles) {
        // Skip split_000 and split_001 if they are the metadata/cover pages
        const isPrefaceOrCover = item.doc.querySelector('dl.tags') || 
                                (item.doc.querySelector('.byline') && item.doc.querySelector('blockquote.userstuff') && !item.doc.querySelector('.userstuff2'));
        if (isPrefaceOrCover) continue;

        // Chapter title from TOC or heading
        let chapterTitle = tocMap.get(item.filename) || tocMap.get(item.href) || '';
        const headingEl = item.doc.querySelector('h1, h2.heading, h2, h3.heading, h3');
        if (!chapterTitle && headingEl) {
          chapterTitle = headingEl.textContent?.trim() || '';
        }
        if (!chapterTitle) {
          chapterTitle = `Chapter ${chapters.length}`;
        }

        // Remove the duplicated heading element from content
        if (headingEl) headingEl.remove();

        // Check for chapter notes
        let notesHtml = '';
        const notesEl = item.doc.querySelector('.notes, .endnote-link');
        if (notesEl) {
          const notesText = notesEl.textContent?.trim();
          if (notesText && notesText.length > 5) {
            notesHtml = `<div class="p-3 my-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-sans"><strong>Chapter Notes:</strong> ${notesEl.innerHTML.trim()}</div>`;
          }
          notesEl.remove();
        }

        // Extract main content container
        const mainContainer = item.doc.querySelector('.userstuff2, .userstuff, #chapters, body');
        const paragraphs = [];
        if (mainContainer) {
          mainContainer.querySelectorAll('p, blockquote, hr').forEach(el => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'hr') {
              paragraphs.push('<hr class="my-8 border-gray-300" />');
            } else {
              const text = el.textContent?.trim() || '';
              if (text.length > 0) {
                const cleanedHtml = cleanElementHtml(el);
                paragraphs.push(`<${tag}>${cleanedHtml}</${tag}>`);
              }
            }
          });
        }

        const chapterContent = (notesHtml + paragraphs.join('')).trim() || '<p>No content in chapter.</p>';

        chapters.push({
          id: crypto.randomUUID(),
          title: chapterTitle,
          content: chapterContent,
          lastModified: Date.now()
        });
      }
    }

    return {
      title: bookTitle,
      chapterCount: chapters.length,
      chapterTitles: chapters.map(c => c.title)
    };
  }, epubBase64);

  console.log('PARSED AO3 BOOK:', JSON.stringify(result, null, 2));
  await browser.close();
})();
