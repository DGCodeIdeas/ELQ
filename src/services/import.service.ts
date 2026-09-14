import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { Chapter } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class ImportService {

  async importFile(file: File): Promise<{ title: string, chapters: Chapter[] }> {
    if (file.name.endsWith('.txt')) {
      return this.importTxt(file);
    } else if (file.name.endsWith('.epub')) {
      return this.importEpub(file);
    } else {
      throw new Error('Unsupported file type');
    }
  }

  private async importTxt(file: File): Promise<{ title: string, chapters: Chapter[] }> {
    const text = await file.text();
    const title = file.name.replace('.txt', '');
    
    // Convert to simple HTML paragraphs
    const content = text.split(/\n\s*\n/)
        .filter(p => p.trim().length > 0)
        .map(p => `<p>${p.trim()}</p>`)
        .join('');

    const chapter: Chapter = {
        id: crypto.randomUUID(),
        title: title,
        content: content,
        lastModified: Date.now()
    };

    return { title, chapters: [chapter] };
  }

  private async importEpub(file: File): Promise<{ title: string, chapters: Chapter[] }> {
    const zip = await JSZip.loadAsync(file);
    
    // 1. Locate rootfile
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) throw new Error('Invalid EPUB: missing container.xml');
    
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXml, 'application/xml');
    const rootPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') || 'content.opf';
    const rootDir = rootPath.includes('/') ? rootPath.substring(0, rootPath.lastIndexOf('/') + 1) : '';
    
    // 2. Read OPF
    const opfContent = await zip.file(rootPath)?.async('string');
    if (!opfContent) throw new Error('Invalid EPUB: OPF file missing');
    
    const opfDoc = parser.parseFromString(opfContent, 'application/xml');
    
    const getMeta = (tag: string): string => {
      const el = opfDoc.getElementsByTagName(tag)[0] || 
                 opfDoc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', tag.replace('dc:', ''))[0];
      return el ? el.textContent?.trim() || '' : '';
    };

    let title = getMeta('dc:title') || file.name.replace('.epub', '');
    const creator = getMeta('dc:creator') || 'Unknown Author';
    const description = getMeta('dc:description') || '';

    // Manifest: ID -> Href
    const manifest = new Map<string, string>();
    const items = opfDoc.getElementsByTagName('item');
    for (let i = 0; i < items.length; i++) {
      manifest.set(items[i].getAttribute('id') || '', items[i].getAttribute('href') || '');
    }

    // TOC mapping (src -> Chapter Title)
    const tocMap = new Map<string, string>();
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
            if (text && cleanSrc) {
              tocMap.set(cleanSrc, text);
            }
          }
        }
        break;
      }
    }

    const spineRefs: string[] = [];
    const itemrefs = opfDoc.getElementsByTagName('itemref');
    for (let i = 0; i < itemrefs.length; i++) {
      const id = itemrefs[i].getAttribute('idref') || '';
      const href = manifest.get(id);
      if (href) spineRefs.push(href);
    }

    // Scan all files to detect AO3 and extract metadata
    const fileEntries: { href: string; filename: string; doc: Document; raw: string }[] = [];
    let isAO3 = false;
    let ao3Url = '';
    const ao3Tags: Record<string, string> = {};
    let ao3Author = creator;
    let ao3Summary = description;

    for (const href of spineRefs) {
      const cleanHref = decodeURIComponent(href);
      const fullPath = rootDir + cleanHref;
      let raw = await zip.file(fullPath)?.async('string');
      if (!raw) raw = await zip.file(rootDir + href)?.async('string');
      if (!raw) continue;

      const doc = parser.parseFromString(raw, 'text/html');
      const filename = href.split('/').pop() || href;
      fileEntries.push({ href, filename, doc, raw });

      if (raw.includes('archiveofourown.org') || doc.querySelector('.userstuff, .userstuff1, .userstuff2, dl.tags')) {
        isAO3 = true;
      }

      const link = doc.querySelector('a[href*="archiveofourown.org/works/"]');
      if (link && !ao3Url) {
        ao3Url = link.getAttribute('href') || '';
      }

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

    const chapters: Chapter[] = [];

    const cleanElementInnerHtml = (el: Element): string => {
      const clone = el.cloneNode(true) as Element;
      const stripAttrs = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const elem = node as HTMLElement;
          const toRemove: string[] = [];
          for (let i = 0; i < elem.attributes.length; i++) {
            const attr = elem.attributes[i].name;
            if (attr.startsWith('on') || attr.startsWith('mso-') || attr === 'style' || attr === 'class' || attr === 'id') {
              toRemove.push(attr);
            }
          }
          toRemove.forEach(a => elem.removeAttribute(a));
          elem.childNodes.forEach(stripAttrs);
        }
      };
      stripAttrs(clone);
      return clone.innerHTML.trim();
    };

    if (isAO3) {
      // 1. Build an official AO3 Work Info & Preface Chapter
      const rating = ao3Tags['Rating'] || '';
      const warnings = ao3Tags['Archive Warning'] || '';
      const categories = ao3Tags['Categories'] || '';
      const fandom = ao3Tags['Fandom'] || '';
      const relationships = ao3Tags['Relationships'] || '';
      const tags = ao3Tags['Additional Tags'] || '';
      const stats = ao3Tags['Stats'] || '';

      const ratingBadgeClass = rating.includes('General') 
        ? 'bg-emerald-100 text-emerald-800' 
        : rating.includes('Teen') 
        ? 'bg-amber-100 text-amber-800' 
        : rating.includes('Mature') 
        ? 'bg-orange-100 text-orange-800' 
        : 'bg-rose-100 text-rose-800';

      let prefaceHtml = `
        <div class="ao3-preface-container space-y-6 pb-6">
          <div class="text-center space-y-2 border-b border-gray-100 pb-5">
            <h1 class="text-3xl font-bold font-serif text-gray-900">${title}</h1>
            <p class="text-base text-gray-600 font-medium">by <span class="text-purple-700 font-semibold">${ao3Author}</span></p>
            ${ao3Url ? `<p class="text-xs text-purple-600 hover:underline"><a href="${ao3Url}" target="_blank" rel="noopener noreferrer">View Original on Archive of Our Own ↗</a></p>` : ''}
          </div>

          <!-- AO3 Tags Metadata Grid -->
          <div class="bg-gray-50/90 rounded-2xl p-5 border border-gray-200 text-xs space-y-3 font-sans shadow-2xs">
            ${rating ? `
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0">Rating:</span>
                <span class="px-2.5 py-0.5 rounded-full font-bold ${ratingBadgeClass}">${rating}</span>
              </div>
            ` : ''}

            ${warnings ? `
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0">Warnings:</span>
                <span class="px-2.5 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">${warnings}</span>
              </div>
            ` : ''}

            ${categories ? `
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0">Categories:</span>
                <span class="font-semibold text-gray-800">${categories}</span>
              </div>
            ` : ''}

            ${fandom ? `
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0">Fandom:</span>
                <span class="px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-800 font-semibold">${fandom}</span>
              </div>
            ` : ''}

            ${relationships ? `
              <div class="flex items-start gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0 mt-0.5">Relationships:</span>
                <div class="flex flex-wrap gap-1.5">
                  ${relationships.split(',').map(r => `<span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100 font-medium">${r.trim()}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            ${tags ? `
              <div class="flex items-start gap-2">
                <span class="font-bold text-gray-500 w-24 shrink-0 mt-0.5">Tags:</span>
                <div class="flex flex-wrap gap-1">
                  ${tags.split(',').map(t => `<span class="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-[11px]">${t.trim()}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            ${stats ? `
              <div class="pt-2 border-t border-gray-200 flex flex-wrap gap-4 text-[11px] text-gray-500 font-mono">
                ${stats.replace(/\s+/g, ' ')}
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

      // 2. Process each subsequent story chapter
      for (const item of fileEntries) {
        // Skip metadata/preface/cover files
        const isPrefaceOrCover = item.doc.querySelector('dl.tags') || 
          (item.doc.querySelector('.byline') && item.doc.querySelector('blockquote.userstuff') && !item.doc.querySelector('.userstuff2'));
        if (isPrefaceOrCover) continue;

        let chapterTitle = tocMap.get(item.filename) || tocMap.get(item.href) || '';
        const headingEl = item.doc.querySelector('h1, h2.heading, h2, h3.heading, h3');
        if (!chapterTitle && headingEl) {
          chapterTitle = headingEl.textContent?.trim() || '';
        }
        if (!chapterTitle) {
          chapterTitle = `Chapter ${chapters.length}`;
        }

        // Remove heading so it is not duplicated in editor
        if (headingEl) headingEl.remove();

        // Check for Chapter Notes
        let notesHtml = '';
        const notesEl = item.doc.querySelector('.notes, .endnote-link');
        if (notesEl) {
          const notesText = notesEl.textContent?.trim();
          if (notesText && notesText.length > 5) {
            notesHtml = `<div class="p-3 my-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-sans"><strong>Chapter Notes:</strong> ${cleanElementInnerHtml(notesEl)}</div>`;
          }
          notesEl.remove();
        }

        // Clean paragraphs
        const mainContainer = item.doc.querySelector('.userstuff2, .userstuff, #chapters, body');
        const paragraphs: string[] = [];
        if (mainContainer) {
          mainContainer.querySelectorAll('p, blockquote, hr').forEach(el => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'hr') {
              paragraphs.push('<hr class="my-8 border-gray-300" />');
            } else {
              const text = el.textContent?.trim() || '';
              if (text.length > 0) {
                const cleanedHtml = cleanElementInnerHtml(el);
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
    } else {
      // Standard Non-AO3 EPUB
      for (let i = 0; i < fileEntries.length; i++) {
        const item = fileEntries[i];
        let chapterTitle = tocMap.get(item.filename) || tocMap.get(item.href) || '';
        const headingEl = item.doc.querySelector('h1, h2, h3');
        if (!chapterTitle && headingEl) {
          chapterTitle = headingEl.textContent?.trim() || '';
        }
        if (!chapterTitle) {
          chapterTitle = `Chapter ${i + 1}`;
        }
        if (headingEl) headingEl.remove();

        const paragraphs: string[] = [];
        const body = item.doc.body || item.doc;
        body.querySelectorAll('p, blockquote, hr, div').forEach(el => {
          const tag = el.tagName.toLowerCase();
          if (tag === 'hr') {
            paragraphs.push('<hr class="my-8 border-gray-300" />');
          } else if (tag === 'p' || tag === 'blockquote') {
            const text = el.textContent?.trim() || '';
            if (text.length > 0) {
              paragraphs.push(`<${tag}>${cleanElementInnerHtml(el)}</${tag}>`);
            }
          }
        });

        const content = paragraphs.join('') || '<p>No content found.</p>';
        chapters.push({
          id: crypto.randomUUID(),
          title: chapterTitle,
          content: content,
          lastModified: Date.now()
        });
      }
    }

    if (chapters.length === 0) {
      chapters.push({ 
        id: crypto.randomUUID(), 
        title: 'Empty Import', 
        content: '<p>No content found in EPUB file.</p>', 
        lastModified: Date.now() 
      });
    }

    return { title, chapters };
  }
}