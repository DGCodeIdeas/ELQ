import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { BlockService } from './block.service';
import { Document, Chapter } from './storage.service';

export type ExportFormat = 'pdf' | 'markdown' | 'txt' | 'html' | 'epub';
export type ExportScope = 'document' | 'chapter';

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  respectRedactions: boolean;
  redactionStyle?: 'blackout' | 'blackbar' | 'blur' | 'spoiler' | 'asterisks' | 'redact_pill';
  customTitle?: string;
  includeMetadata?: boolean;
}

export interface ExportPreview {
  filename: string;
  format: ExportFormat;
  scope: ExportScope;
  content: string;
  redactedCount: number;
  wordCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private blockService = inject(BlockService);

  /**
   * Generates a preview of the exported document text and stats
   */
  generatePreview(options: ExportOptions): ExportPreview {
    const doc = this.blockService.currentDoc();
    const activeChapter = this.blockService.activeChapter();
    const docTitle = options.customTitle || doc?.title || 'Untitled Document';
    
    const chaptersToExport: Chapter[] = options.scope === 'chapter' && activeChapter
      ? [activeChapter]
      : (doc?.chapters || []);

    const style = options.redactionStyle || this.blockService.redactionStyle();
    const shouldRedact = options.respectRedactions;
    let totalRedacted = 0;

    let textPreview = '';

    if (options.format === 'markdown') {
      textPreview = this.generateMarkdown(chaptersToExport, docTitle, shouldRedact, style, options.includeMetadata ?? true);
      totalRedacted = this.countRedactedOccurrences(chaptersToExport, shouldRedact);
    } else if (options.format === 'txt') {
      textPreview = this.generatePlainText(chaptersToExport, docTitle, shouldRedact, style, options.includeMetadata ?? true);
      totalRedacted = this.countRedactedOccurrences(chaptersToExport, shouldRedact);
    } else if (options.format === 'html') {
      textPreview = this.generateHtml(chaptersToExport, docTitle, shouldRedact, style, options.includeMetadata ?? true);
      totalRedacted = this.countRedactedOccurrences(chaptersToExport, shouldRedact);
    } else if (options.format === 'pdf') {
      textPreview = this.generatePlainText(chaptersToExport, docTitle, shouldRedact, style, options.includeMetadata ?? true);
      totalRedacted = this.countRedactedOccurrences(chaptersToExport, shouldRedact);
    } else if (options.format === 'epub') {
      textPreview = this.generatePlainText(chaptersToExport, docTitle, shouldRedact, style, options.includeMetadata ?? true);
      totalRedacted = this.countRedactedOccurrences(chaptersToExport, shouldRedact);
    }

    const filename = this.generateFilename(docTitle, options.format, options.scope, activeChapter?.title);
    const words = textPreview.trim().split(/\s+/).filter(Boolean).length;

    return {
      filename,
      format: options.format,
      scope: options.scope,
      content: textPreview,
      redactedCount: totalRedacted,
      wordCount: words
    };
  }

  /**
   * Main export handler triggering download
   */
  async exportDocument(options: ExportOptions): Promise<void> {
    const doc = this.blockService.currentDoc();
    if (!doc) return;

    const activeChapter = this.blockService.activeChapter();
    const docTitle = options.customTitle || doc.title || 'Untitled Document';
    
    const chaptersToExport: Chapter[] = options.scope === 'chapter' && activeChapter
      ? [activeChapter]
      : doc.chapters;

    const style = options.redactionStyle || this.blockService.redactionStyle();
    const shouldRedact = options.respectRedactions;
    const filename = this.generateFilename(docTitle, options.format, options.scope, activeChapter?.title);

    switch (options.format) {
      case 'pdf':
        await this.exportPdf(chaptersToExport, docTitle, shouldRedact, style, filename, options.includeMetadata ?? true);
        break;
      case 'markdown':
        this.exportMarkdown(chaptersToExport, docTitle, shouldRedact, style, filename, options.includeMetadata ?? true);
        break;
      case 'txt':
        this.exportPlainText(chaptersToExport, docTitle, shouldRedact, style, filename, options.includeMetadata ?? true);
        break;
      case 'html':
        this.exportHtml(chaptersToExport, docTitle, shouldRedact, style, filename, options.includeMetadata ?? true);
        break;
      case 'epub':
        await this.exportEpub(chaptersToExport, docTitle, shouldRedact, style, filename);
        break;
    }
  }

  // --- PDF Export using jsPDF ---

  private async exportPdf(
    chapters: Chapter[],
    docTitle: string,
    shouldRedact: boolean,
    style: string,
    filename: string,
    includeMetadata: boolean
  ): Promise<void> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 54; // 0.75 in
    const printableWidth = pageWidth - (margin * 2);
    let currentY = margin;

    const addHeaderAndFooter = (pageNum: number, totalPages: number) => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      
      // Running header (from page 2 onwards)
      if (pageNum > 1) {
        pdf.text(docTitle, margin, 36);
        pdf.setDrawColor(230, 230, 230);
        pdf.line(margin, 42, pageWidth - margin, 42);
      }

      // Running footer
      const footerText = `Page ${pageNum} of ${totalPages}`;
      const footerWidth = pdf.getTextWidth(footerText);
      pdf.text(footerText, pageWidth - margin - footerWidth, pageHeight - 30);
      if (shouldRedact) {
        pdf.text('[REDACTED COPY - CONFIDENTIAL]', margin, pageHeight - 30);
      }
    };

    // Document Title Banner
    pdf.setFont('times', 'bold');
    pdf.setFontSize(24);
    pdf.setTextColor(20, 20, 20);
    const titleLines = pdf.splitTextToSize(docTitle, printableWidth);
    pdf.text(titleLines, margin, currentY + 16);
    currentY += (titleLines.length * 28) + 12;

    if (includeMetadata) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(110, 110, 110);
      const nowStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const redactionNote = shouldRedact ? `Redaction: Applied (${style})` : 'Redaction: Uncensored / None';
      pdf.text(`Exported: ${nowStr}  |  ${chapters.length} chapter(s)  |  ${redactionNote}`, margin, currentY);
      currentY += 18;

      // Divider line
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.75);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 24;
    }

    // Chapters Content
    for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
      const chapter = chapters[cIdx];
      
      // Add page break between chapters if not at the very top
      if (cIdx > 0) {
        pdf.addPage();
        currentY = margin + 20;
      }

      // Chapter Title
      pdf.setFont('times', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(30, 30, 30);
      
      if (currentY > pageHeight - margin - 60) {
        pdf.addPage();
        currentY = margin + 20;
      }

      const chTitle = chapter.title || `Chapter ${cIdx + 1}`;
      pdf.text(chTitle, margin, currentY);
      currentY += 22;

      // Underline for chapter title
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.5);
      pdf.line(margin, currentY - 6, margin + Math.min(200, pdf.getTextWidth(chTitle)), currentY - 6);
      currentY += 10;

      // Chapter Body Text
      const rawText = this.htmlToFormattedText(chapter.content || '');
      const paragraphs = rawText.split('\n\n').filter(p => p.trim().length > 0);

      pdf.setFont('times', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(40, 40, 40);

      for (const p of paragraphs) {
        const processedParagraph = shouldRedact ? this.redactPlainText(p, style) : p;
        const lines = pdf.splitTextToSize(processedParagraph, printableWidth);

        for (const line of lines) {
          if (currentY > pageHeight - margin - 40) {
            pdf.addPage();
            currentY = margin + 20;
            pdf.setFont('times', 'normal');
            pdf.setFontSize(11);
            pdf.setTextColor(40, 40, 40);
          }

          // Render line text
          pdf.text(line, margin, currentY);
          currentY += 16;
        }

        // Space between paragraphs
        currentY += 8;
      }
    }

    // Add page numbers to all pages
    const totalPages = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      addHeaderAndFooter(i, totalPages);
    }

    pdf.save(filename);
  }

  // --- Markdown Export ---

  private exportMarkdown(
    chapters: Chapter[],
    docTitle: string,
    shouldRedact: boolean,
    style: string,
    filename: string,
    includeMetadata: boolean
  ): void {
    const markdown = this.generateMarkdown(chapters, docTitle, shouldRedact, style, includeMetadata);
    this.downloadFile(markdown, filename, 'text/markdown');
  }

  private generateMarkdown(
    chapters: Chapter[],
    docTitle: string,
    shouldRedact: boolean,
    style: string,
    includeMetadata: boolean
  ): string {
    const parts: string[] = [];

    if (includeMetadata) {
      parts.push(`# ${docTitle}\n`);
      const nowStr = new Date().toISOString().split('T')[0];
      const modeStr = shouldRedact ? `Redacted (${style})` : 'Unredacted';
      parts.push(`*Generated on ${nowStr} • Mode: ${modeStr}*\n\n---\n`);
    }

    chapters.forEach((chapter, idx) => {
      const title = chapter.title || `Chapter ${idx + 1}`;
      parts.push(`## ${title}\n`);

      const mdContent = this.htmlToMarkdown(chapter.content || '');
      const finalContent = shouldRedact ? this.redactMarkdownText(mdContent, style) : mdContent;
      parts.push(finalContent.trim());
      parts.push('\n\n---\n\n');
    });

    return parts.join('\n').trim();
  }

  // --- Plain Text Export ---

  private exportPlainText(
    chapters: Chapter[],
    docTitle: string,
    shouldRedact: boolean,
    style: string,
    filename: string,
    includeMetadata: boolean
  ): void {
    const txt = this.generatePlainText(chapters, docTitle, shouldRedact, style, includeMetadata);
    this.downloadFile(txt, filename, 'text/plain');
  }

  private generatePlainText(
    chapters: Chapter[],
    docTitle: string,
    shouldRedact: boolean,
    style: string,
    includeMetadata: boolean
  ): string {
    const parts: string[] = [];

    if (includeMetadata) {
      parts.push(docTitle.toUpperCase());
      parts.push('='.repeat(Math.max(docTitle.length, 30)));
      const nowStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const redactionNote = shouldRedact ? `[Applied Redactions: ${style}]` : '[Uncensored / Full Text]';
      parts.push(`Exported: ${nowStr} | ${redactionNote}`);
      parts.push('-'.repeat(Math.max(docTitle.length, 30)) + '\n');
    }

    chapters.forEach((chapter, idx) => {
      const title = chapter.title || `Chapter ${idx + 1}`;
      parts.push(`\n[ CHAPTER: ${title} ]\n`);

      const raw = this.htmlToFormattedText(chapter.content || '');
      const finalContent = shouldRedact ? this.redactPlainText(raw, style) : raw;
      parts.push(finalContent.trim());
      parts.push('\n\n' + '='.repeat(40) + '\n');
    });

    return parts.join('\n').trim();
  }

  // --- HTML Export ---

  private exportHtml(
    chapters: Chapter[],
    docTitle: string,
    shouldRedact: boolean,
    style: string,
    filename: string,
    includeMetadata: boolean
  ): void {
    const html = this.generateHtml(chapters, docTitle, shouldRedact, style, includeMetadata);
    this.downloadFile(html, filename, 'text/html');
  }

  private generateHtml(
    chapters: Chapter[],
    docTitle: string,
    shouldRedact: boolean,
    style: string,
    includeMetadata: boolean
  ): string {
    const renderedChapters = chapters.map((c, i) => {
      const title = c.title || `Chapter ${i + 1}`;
      let content = c.content || '';
      if (shouldRedact) {
        content = this.redactHtmlContent(content, style);
      }
      return `
      <section class="chapter">
        <h2>${this.escapeXml(title)}</h2>
        <div class="chapter-body">
          ${content}
        </div>
      </section>
      `;
    }).join('\n<hr class="chapter-divider" />\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeXml(docTitle)}</title>
  <style>
    body {
      font-family: Georgia, Cambria, 'Times New Roman', Times, serif;
      line-height: 1.7;
      color: #1a1a1a;
      max-width: 780px;
      margin: 40px auto;
      padding: 0 24px;
      background-color: #faf9f6;
    }
    header {
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    h1 {
      font-size: 2.2rem;
      margin-bottom: 8px;
      color: #111;
    }
    .meta {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 0.85rem;
      color: #666;
    }
    h2 {
      font-size: 1.5rem;
      margin-top: 36px;
      margin-bottom: 16px;
      color: #222;
      border-bottom: 1px solid #ddd;
      padding-bottom: 6px;
    }
    p {
      margin-bottom: 1.25em;
      text-indent: 1.5em;
    }
    p:first-of-type {
      text-indent: 0;
    }
    .chapter-divider {
      margin: 48px 0;
      border: 0;
      border-top: 1px solid #ccc;
    }
    /* Redaction styling */
    .censored-blackbar {
      background-color: #000;
      color: #000;
      border-radius: 2px;
      padding: 0 2px;
      user-select: none;
    }
    .censored-blur {
      filter: blur(4px);
      transition: filter 0.2s;
    }
    .censored-spoiler {
      background-color: #262626;
      color: transparent;
      border-radius: 3px;
      padding: 1px 4px;
      cursor: pointer;
    }
    .censored-pill {
      background-color: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      padding: 0 6px;
      font-size: 0.8em;
      font-family: monospace;
      font-weight: bold;
    }
    @media print {
      body { background-color: #fff; margin: 0; max-width: 100%; }
      .chapter { page-break-after: always; }
    }
  </style>
</head>
<body>
  ${includeMetadata ? `
  <header>
    <h1>${this.escapeXml(docTitle)}</h1>
    <div class="meta">Exported from Eloqui • ${chapters.length} Chapter(s) • ${shouldRedact ? `Redacted (${style})` : 'Unredacted'}</div>
  </header>` : ''}
  <main>
    ${renderedChapters}
  </main>
</body>
</html>`;
  }

  // --- EPUB Export ---

  private async exportEpub(
    chapters: Chapter[],
    docTitle: string,
    shouldRedact: boolean,
    style: string,
    filename: string
  ): Promise<void> {
    const zip = new JSZip();
    const docId = 'eloqui_' + Math.random().toString(36).substring(2, 9);
    
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   <rootfiles>
      <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
   </rootfiles>
</container>`);

    let manifest = '';
    let spine = '';
    let tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${docId}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${this.escapeXml(docTitle)}</text></docTitle>
  <navMap>`;

    chapters.forEach((chapter, i) => {
      const chFilename = `chapter${i+1}.xhtml`;
      const title = chapter.title || `Chapter ${i + 1}`;
      let content = chapter.content || '';
      if (shouldRedact) {
        content = this.redactHtmlContent(content, style);
      }

      const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${this.escapeXml(title)}</title>
  <style>
    body { font-family: serif; line-height: 1.6; margin: 2em; }
    h1 { text-align: center; margin-bottom: 2em; }
    .censored-blackbar { background-color: #000; color: #000; }
    .censored-spoiler { background-color: #222; color: #222; }
    .censored-pill { border: 1px solid #888; padding: 0 4px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>${this.escapeXml(title)}</h1>
  ${content}
</body>
</html>`;
      
      zip.file(`OEBPS/${chFilename}`, xhtml);
      manifest += `<item id="ch${i+1}" href="${chFilename}" media-type="application/xhtml+xml"/>\n`;
      spine += `<itemref idref="ch${i+1}"/>\n`;
      tocNcx += `
    <navPoint id="navPoint-${i+1}" playOrder="${i+1}">
      <navLabel><text>${this.escapeXml(title)}</text></navLabel>
      <content src="${chFilename}"/>
    </navPoint>`;
    });

    tocNcx += `\n  </navMap>\n</ncx>`;
    zip.file("OEBPS/toc.ncx", tocNcx);

    const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${this.escapeXml(docTitle)}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">${docId}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${manifest}
  </manifest>
  <spine toc="ncx">
    ${spine}
  </spine>
</package>`;

    zip.file("OEBPS/content.opf", opf);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Redaction Processors ---

  private redactPlainText(text: string, style: string): string {
    const terms = this.blockService.allSensitiveTerms();
    if (!terms || terms.length === 0 || !text) return text;

    const escaped = terms.map(t => t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean).join('|');
    if (!escaped) return text;

    const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
    return text.replace(regex, (match: string) => {
      return this.formatRedactedTerm(match, style);
    });
  }

  private redactMarkdownText(text: string, style: string): string {
    const terms = this.blockService.allSensitiveTerms();
    if (!terms || terms.length === 0 || !text) return text;

    const escaped = terms.map(t => t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean).join('|');
    if (!escaped) return text;

    const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
    return text.replace(regex, (match: string) => {
      if (style === 'spoiler') {
        return `||${match}||`;
      }
      return this.formatRedactedTerm(match, style);
    });
  }

  private redactHtmlContent(html: string, style: string): string {
    const terms = this.blockService.allSensitiveTerms();
    if (!terms || terms.length === 0 || !html) return html;

    const escaped = terms.map(t => t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean).join('|');
    if (!escaped) return html;

    const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');

    return html.replace(/(>|^)([^<]+)(<|$)/g, (match, prefix, text, suffix) => {
      const replaced = text.replace(regex, (word: string) => {
        if (style === 'blackbar' || style === 'blackout') {
          return `<span class="censored-blackbar">${'█'.repeat(Math.max(4, word.length))}</span>`;
        } else if (style === 'blur') {
          return `<span class="censored-blur">${word}</span>`;
        } else if (style === 'asterisks') {
          return `<span class="censored-spoiler">${'*'.repeat(Math.max(3, word.length))}</span>`;
        } else if (style === 'redact_pill') {
          return `<span class="censored-pill">[REDACTED]</span>`;
        } else {
          return `<span class="censored-spoiler">${word}</span>`;
        }
      });
      return prefix + replaced + suffix;
    });
  }

  private formatRedactedTerm(term: string, style: string): string {
    switch (style) {
      case 'blackbar':
      case 'blackout':
        return '█'.repeat(Math.max(4, term.length));
      case 'asterisks':
        return '*'.repeat(Math.max(3, term.length));
      case 'redact_pill':
      case 'blur':
        return '[REDACTED]';
      case 'spoiler':
      default:
        return `[REDACTED]`;
    }
  }

  private countRedactedOccurrences(chapters: Chapter[], shouldRedact: boolean): number {
    if (!shouldRedact) return 0;
    const terms = this.blockService.allSensitiveTerms();
    if (!terms || terms.length === 0) return 0;

    const escaped = terms.map(t => t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean).join('|');
    if (!escaped) return 0;

    const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
    let total = 0;

    for (const c of chapters) {
      const plain = (c.content || '').replace(/<[^>]*>/g, ' ');
      const matches = plain.match(regex);
      if (matches) total += matches.length;
    }

    return total;
  }

  // --- Converters & Helpers ---

  private htmlToFormattedText(html: string): string {
    if (!html) return '';
    try {
      const div = document.createElement('div');
      div.innerHTML = html
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n');
      return (div.textContent || '').trim();
    } catch {
      return html.replace(/<[^>]*>/g, ' ').trim();
    }
  }

  private htmlToMarkdown(html: string): string {
    if (!html) return '';
    let md = html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~')
      .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<hr\s*[\/]?>/gi, '---\n\n')
      .replace(/<[^>]*>/g, '');

    // Unescape common HTML entities
    md = md
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    return md;
  }

  private generateFilename(docTitle: string, format: ExportFormat, scope: ExportScope, chapterTitle?: string): string {
    const cleanDoc = (docTitle || 'document').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const cleanChapter = chapterTitle ? '_' + chapterTitle.replace(/[^a-z0-9_-]/gi, '_').toLowerCase() : '';
    const scopeSuffix = scope === 'chapter' ? cleanChapter || '_chapter' : '';

    let ext = format as string;
    if (format === 'markdown') ext = 'md';
    return `${cleanDoc}${scopeSuffix}.${ext}`;
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private escapeXml(unsafe: string): string {
    return (unsafe || '').replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}
