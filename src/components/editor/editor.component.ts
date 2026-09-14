import { Component, ChangeDetectionStrategy, inject, signal, computed, ViewChild, ElementRef, effect, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BlockService } from '../../services/block.service';
import { AiService, Suggestion } from '../../services/ai.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './editor.component.html',
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    [contenteditable]:empty:before {
      content: attr(placeholder);
      color: #9ca3af;
      pointer-events: none;
    }
    .linguix-badge {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  `]
})
export class EditorComponent {
  blockService = inject(BlockService);
  aiService = inject(AiService);
  authService = inject(AuthService);
  sanitizer = inject(DomSanitizer);
  cdr = inject(ChangeDetectorRef);

  @ViewChild('editor') editorRef!: ElementRef<HTMLDivElement>;
  @Output() focusModeChange = new EventEmitter<boolean>();
  
  editorContent = signal<string>('');
  safeContent = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.editorContent()));
  isFocusMode = signal(false);
  private isTyping = false;
  private inputDebounceTimer: any = null;
  private lastRenderedChapterId: string | null = null;

  // Linguix Review State
  isScanning = signal(false);
  scanResults = signal<Suggestion[]>([]);
  linguixScore = signal<number | null>(null);
  showReviewDrawer = signal(false);
  scanMessage = signal<string | null>(null);

  // Censorship Preview State
  showRedactedPreview = signal(false);
  redactedSafeContent = computed(() => {
    return this.sanitizer.bypassSecurityTrustHtml(this.blockService.activeChapterRenderedHtml());
  });

  // Paraphrasing State
  selectionText = signal<string>('');
  savedSelectionRange = signal<Range | null>(null);
  showParaphraseMenu = signal(false);
  floatingMenuPos = signal<{top: number, left: number}>({top: 0, left: 0});
  isParaphrasing = signal(false);
  paraphraseStyles = ['Novel (SFW)', 'Novel (NSFW)', 'Academic', 'Law', 'Professional', 'Casual', 'Creative', 'Fantasy', 'Sci-Fi'];
  selectedParaphraseStyle = signal('Novel (SFW)');
  paraphraseResults = signal<{text: string, explanation: string}[]>([]);
  showParaphraseDrawer = signal(false);

  constructor() {
    // Sync ACTIVE CHAPTER content from service to editor
    effect(() => {
      const activeId = this.blockService.activeChapterId();
      const content = this.blockService.activeChapterContent();
      
      if (activeId !== this.lastRenderedChapterId || !this.isTyping) {
        this.lastRenderedChapterId = activeId;
        this.isTyping = false;
        this.editorContent.set(content);
        if (this.editorRef?.nativeElement) {
          this.editorRef.nativeElement.innerHTML = content;
          this.editorRef.nativeElement.scrollTop = 0;
        }
        this.cdr.markForCheck();
      }
    });
  }

  onInput(e: Event) {
    this.isTyping = true;
    const html = (e.target as HTMLElement).innerHTML;
    
    if (this.inputDebounceTimer) clearTimeout(this.inputDebounceTimer);
    this.inputDebounceTimer = setTimeout(() => {
      this.blockService.updateActiveChapterContent(html);
    }, 150);
  }

  onBlur() {
    this.isTyping = false;
    if (this.inputDebounceTimer) {
      clearTimeout(this.inputDebounceTimer);
    }
    if (this.editorRef) {
      this.blockService.updateActiveChapterContent(this.editorRef.nativeElement.innerHTML);
    }
  }

  onPaste(e: ClipboardEvent) {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const pastedHtml = clipboardData.getData('text/html');
    const pastedText = clipboardData.getData('text/plain');

    let cleanHtml = '';
    if (pastedHtml && pastedHtml.length < 500000) {
      cleanHtml = this.sanitizePastedHtml(pastedHtml);
    }
    if (!cleanHtml && pastedText) {
      cleanHtml = this.formatPlainTextAsHtml(pastedText);
    }
    if (!cleanHtml) return;

    this.isTyping = true;
    try {
      if (document.queryCommandSupported('insertHTML')) {
        document.execCommand('insertHTML', false, cleanHtml);
      } else {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const temp = document.createElement('div');
          temp.innerHTML = cleanHtml;
          const frag = document.createDocumentFragment();
          let node: ChildNode | null;
          while ((node = temp.firstChild)) {
            frag.appendChild(node);
          }
          range.insertNode(frag);
        }
      }
    } catch (err) {
      document.execCommand('insertText', false, pastedText);
    }

    if (this.editorRef) {
      this.blockService.updateActiveChapterContent(this.editorRef.nativeElement.innerHTML);
    }
  }

  private sanitizePastedHtml(rawHtml: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');
      const forbiddenTags = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'svg', 'canvas', 'form', 'input'];
      forbiddenTags.forEach(tag => {
        const elements = doc.querySelectorAll(tag);
        elements.forEach(el => el.remove());
      });

      const allElements = doc.body.querySelectorAll('*');
      allElements.forEach(el => {
        const attrsToRemove: string[] = [];
        for (let i = 0; i < el.attributes.length; i++) {
          const attrName = el.attributes[i].name.toLowerCase();
          if (attrName.startsWith('on') || 
              attrName.startsWith('data-') || 
              attrName.startsWith('mso-') || 
              attrName.startsWith('v:') || 
              attrName.startsWith('o:') || 
              attrName === 'style' || 
              attrName === 'class' || 
              attrName === 'id') {
            attrsToRemove.push(el.attributes[i].name);
          }
        }
        attrsToRemove.forEach(a => el.removeAttribute(a));
      });

      return doc.body.innerHTML.trim();
    } catch {
      return '';
    }
  }

  private formatPlainTextAsHtml(text: string): string {
    if (!text) return '';
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const paragraphs = normalized.split(/\n{2,}/);

    return paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      const escaped = trimmed
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const withBreaks = escaped.replace(/\n/g, '<br>');
      return `<p>${withBreaks}</p>`;
    }).filter(p => p.length > 0).join('');
  }
  
  private checkSelection() {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        this.showParaphraseMenu.set(false);
        this.selectionText.set('');
        this.savedSelectionRange.set(null);
        return;
      }
      
      const range = selection.getRangeAt(0);
      
      // Ensure selection is inside editor
      if (this.editorRef?.nativeElement && this.editorRef.nativeElement.contains(range.commonAncestorContainer)) {
        const text = selection.toString().trim();
        if (text.length > 0) {
          const rect = range.getBoundingClientRect();
          this.floatingMenuPos.set({
            top: rect.top - 40,
            left: rect.left + (rect.width / 2)
          });
          this.selectionText.set(text);
          this.savedSelectionRange.set(range.cloneRange());
          this.showParaphraseMenu.set(true);
        } else {
          this.showParaphraseMenu.set(false);
        }
      } else {
        this.showParaphraseMenu.set(false);
      }
    }, 10);
  }

  onMouseUp(e: MouseEvent) {
    this.checkSelection();
  }

  onKeyUp(e: KeyboardEvent) {
    this.checkSelection();
  }

  // --- Paraphrasing ---
  openParaphraseDrawer() {
    this.showParaphraseMenu.set(false);
    this.showParaphraseDrawer.set(true);
    this.runParaphrase();
  }

  async runParaphrase() {
    if (!this.selectionText()) return;
    this.isParaphrasing.set(true);
    this.paraphraseResults.set([]);
    
    // Pass previous ~200 characters as context
    let docContext = '';
    const fullText = this.editorRef?.nativeElement.innerText || '';
    const selText = this.selectionText();
    const idx = fullText.indexOf(selText);
    if (idx > -1) {
      const start = Math.max(0, idx - 200);
      docContext = fullText.substring(start, idx + selText.length + 200);
    }
    
    const results = await this.aiService.paraphraseText(
      selText, 
      this.selectedParaphraseStyle(), 
      docContext
    );
    this.paraphraseResults.set(results);
    this.isParaphrasing.set(false);
  }

  applyParaphrase(alternative: {text: string, explanation: string}) {
    const range = this.savedSelectionRange();
    if (range && this.editorRef) {
      this.editorRef.nativeElement.focus();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('insertText', false, alternative.text);
      this.blockService.updateActiveChapterContent(this.editorRef.nativeElement.innerHTML);
    }
    this.showParaphraseDrawer.set(false);
  }

  closeParaphraseDrawer() {
    this.showParaphraseDrawer.set(false);
  }

  toggleFocusMode() {
    this.isFocusMode.update(v => !v);
    this.focusModeChange.emit(this.isFocusMode());
  }

  exec(command: string, value: string = '') {
    document.execCommand(command, false, value);
    if (this.editorRef) {
      this.blockService.updateActiveChapterContent(this.editorRef.nativeElement.innerHTML);
    }
    this.editorRef.nativeElement.focus();
  }

  nextChapter() {
    this.isTyping = false;
    this.blockService.selectNextChapter();
  }
  
  prevChapter() {
    this.isTyping = false;
    this.blockService.selectPrevChapter();
  }

  // --- Linguix Style Grammar Review ---
  async runLinguixScan() {
    const rawContent = this.blockService.activeChapterContent();
    const plainText = rawContent.replace(/<[^>]*>/g, ' ').trim();
    
    if (plainText.length < 5) {
      this.scanMessage.set('Please write a few sentences before initiating a quality check.');
      this.showReviewDrawer.set(true);
      return;
    }

    this.scanMessage.set(null);
    this.isScanning.set(true);
    this.showReviewDrawer.set(true);

    try {
      const suggestions = await this.aiService.reviewText(plainText);
      this.scanResults.set(suggestions);

      // Calculate Linguix score
      const wordCount = plainText.split(/\s+/).length;
      const issues = suggestions.length;
      const computedScore = Math.max(70, Math.min(100, Math.round(100 - (issues * 100 / Math.max(wordCount, 15)))));
      this.linguixScore.set(computedScore);
    } catch (e) {
      console.error('Linguix scan failed', e);
    } finally {
      this.isScanning.set(false);
    }
  }

  acceptSuggestion(s: Suggestion) {
    const current = this.blockService.activeChapterContent();
    // Replace first occurrence of original with suggestion safely
    if (current.includes(s.original)) {
      const updated = current.replace(s.original, s.suggestion);
      this.blockService.updateActiveChapterContent(updated);
    }
    // Remove from results list
    this.scanResults.update(list => list.filter(item => item !== s));
  }

  dismissSuggestion(s: Suggestion) {
    this.scanResults.update(list => list.filter(item => item !== s));
  }

  applyAllSuggestions() {
    let content = this.blockService.activeChapterContent();
    for (const s of this.scanResults()) {
      if (content.includes(s.original)) {
        content = content.replace(s.original, s.suggestion);
      }
    }
    this.blockService.updateActiveChapterContent(content);
    this.scanResults.set([]);
    this.linguixScore.set(100);
  }
}
