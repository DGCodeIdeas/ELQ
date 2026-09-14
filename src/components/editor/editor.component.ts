import { Component, ChangeDetectionStrategy, inject, signal, computed, ViewChild, ElementRef, effect, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BlockService } from '../../services/block.service';
import { AiService, Suggestion } from '../../services/ai.service';
import { AuthService } from '../../services/auth.service';
import { ParaphraseModalComponent } from '../paraphrase/paraphrase-modal.component';

@Component({
  selector: 'app-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ParaphraseModalComponent],
  host: {
    '(window:keydown)': 'onWindowKeyDown($event)',
    '(document:selectionchange)': 'onDocumentSelectionChange()'
  },
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

  // Selection & Paraphrase State
  selectedText = signal<string>('');
  selectionWordCount = computed(() => {
    const t = this.selectedText().trim();
    return t ? t.split(/\s+/).length : 0;
  });
  surroundingContext = signal<string>('');
  showFloatingPill = signal<boolean>(false);
  floatingPillTop = signal<number>(0);
  floatingPillLeft = signal<number>(0);
  showParaphraseModal = signal<boolean>(false);
  savedRange: Range | null = null;
  savedSelectedText: string = '';

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

  // --- Keyboard Shortcuts ---
  onWindowKeyDown(e: KeyboardEvent) {
    // Ctrl+Shift+P or Cmd+Shift+P to trigger Paraphrasing
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      this.openParaphraseModal();
    }
  }

  // --- Real-time Selection Detection ---
  onDocumentSelectionChange() {
    if (this.showParaphraseModal()) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !this.editorRef?.nativeElement) {
      this.showFloatingPill.set(false);
      this.selectedText.set('');
      return;
    }

    const text = sel.toString().trim();
    if (text.length === 0) {
      this.showFloatingPill.set(false);
      this.selectedText.set('');
      return;
    }

    if (sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    // Verify selection belongs inside this editor element
    if (!this.editorRef.nativeElement.contains(range.commonAncestorContainer)) {
      this.showFloatingPill.set(false);
      return;
    }

    this.savedRange = range.cloneRange();
    this.savedSelectedText = text;
    this.selectedText.set(text);

    // Extract surrounding context (~150 chars before and after)
    const fullContent = this.editorRef.nativeElement.innerText || '';
    const idx = fullContent.indexOf(text);
    if (idx !== -1) {
      const start = Math.max(0, idx - 150);
      const end = Math.min(fullContent.length, idx + text.length + 150);
      this.surroundingContext.set(fullContent.substring(start, end));
    } else {
      this.surroundingContext.set(text);
    }

    // Position floating pill above selection
    const rect = range.getBoundingClientRect();
    if (rect && rect.width > 0) {
      const top = Math.max(10, rect.top - 44);
      const left = Math.max(10, rect.left + rect.width / 2);
      this.floatingPillTop.set(top);
      this.floatingPillLeft.set(left);
      this.showFloatingPill.set(true);
    }
  }

  openParaphraseModal(fallbackText?: string) {
    if (fallbackText && !this.selectedText()) {
      this.selectedText.set(fallbackText);
      this.savedSelectedText = fallbackText;
    } else if (!this.selectedText()) {
      // If nothing highlighted, pick the current line/paragraph from editor
      const raw = this.editorRef?.nativeElement?.innerText?.trim() || '';
      if (raw) {
        const paragraphs = raw.split(/\n{2,}/);
        const candidate = paragraphs[0]?.trim() || raw;
        this.selectedText.set(candidate);
        this.savedSelectedText = candidate;
        this.surroundingContext.set(raw);
      }
    }
    this.showFloatingPill.set(false);
    this.showParaphraseModal.set(true);
  }

  closeParaphraseModal() {
    this.showParaphraseModal.set(false);
  }

  applyParaphraseReplacement(newText: string) {
    this.isTyping = true;
    let replaced = false;

    if (this.savedRange && this.editorRef?.nativeElement) {
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(this.savedRange);
          replaced = document.execCommand('insertText', false, newText);
          if (sel.rangeCount > 0) {
            this.savedRange = sel.getRangeAt(0).cloneRange();
          }
        }
      } catch (err) {
        console.warn('execCommand failed, falling back to direct replacement', err);
      }
    }

    if (!replaced) {
      const current = this.blockService.activeChapterContent();
      if (this.savedSelectedText && current.includes(this.savedSelectedText)) {
        const updated = current.replace(this.savedSelectedText, newText);
        this.blockService.updateActiveChapterContent(updated);
        if (this.editorRef?.nativeElement) {
          this.editorRef.nativeElement.innerHTML = updated;
        }
      }
    } else if (this.editorRef?.nativeElement) {
      this.blockService.updateActiveChapterContent(this.editorRef.nativeElement.innerHTML);
    }

    this.savedSelectedText = newText;
    this.selectedText.set(newText);
    this.cdr.markForCheck();
  }

  applyParaphraseInsertBelow(newText: string) {
    if (this.editorRef?.nativeElement) {
      const current = this.blockService.activeChapterContent();
      const insertHtml = `<p class="mt-4 p-3 bg-purple-50/70 border-l-4 border-purple-500 rounded-r-xl text-purple-950 font-serif text-base">${newText}</p>`;
      
      let updated = '';
      if (this.savedSelectedText && current.includes(this.savedSelectedText)) {
        updated = current.replace(this.savedSelectedText, `${this.savedSelectedText}${insertHtml}`);
      } else {
        updated = current + insertHtml;
      }

      this.blockService.updateActiveChapterContent(updated);
      this.editorRef.nativeElement.innerHTML = updated;
      this.cdr.markForCheck();
    }
  }
}
