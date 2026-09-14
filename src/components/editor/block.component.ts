import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges, signal, inject, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Block } from '../../services/storage.service';
import { AiService, Suggestion, AiMode } from '../../services/ai.service';

@Component({
  selector: 'app-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './block.component.html',
  styles: [`
    :host { display: block; }
    .empty-block:empty:before {
      content: attr(placeholder);
      color: #9ca3af;
      pointer-events: none;
    }
  `]
})
export class BlockComponent implements AfterViewInit, OnChanges {
  aiService = inject(AiService);
  sanitizer = inject(DomSanitizer);

  @Input({ required: true }) block!: Block;
  @Input() isFocused = false;
  
  @Output() update = new EventEmitter<string>();
  @Output() addNext = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();
  @Output() focusNext = new EventEmitter<void>();
  @Output() focusPrev = new EventEmitter<void>();
  @Output() typeChange = new EventEmitter<Block['type']>();
  @Output() aiRequest = new EventEmitter<AiMode>();
  @Output() blockFocus = new EventEmitter<void>();
  @Output() notify = new EventEmitter<{type: 'success'|'error'|'info', message: string}>();

  @ViewChild('editable') editableRef!: ElementRef<HTMLDivElement>;

  showMenu = signal(false);
  isHovered = false;
  
  // Review Mode State
  isReviewing = signal(false); // Loading state
  isReviewMode = signal(false); // View Mode state
  suggestions = signal<Suggestion[]>([]);
  reviewHtmlSafe: SafeHtml = '';
  activeSuggestion = signal<Suggestion | null>(null);
  popoverPosition = { x: 0, y: 0 };
  
  // Internal content tracker for optimistic updates in Review Mode
  private internalContent = '';

  ngAfterViewInit() {
    if (this.editableRef && this.block.type !== 'divider') {
      this.editableRef.nativeElement.innerText = this.block.content; 
    }
    
    if (this.isFocused) {
      this.focusEnd();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['block']) {
        this.internalContent = this.block.content;
        
        if (this.isReviewMode()) {
            this.generateReviewHtml();
        } else if (this.editableRef && document.activeElement !== this.editableRef.nativeElement && this.block.type !== 'divider') {
            // Only update innerText if we are not the one typing (avoid cursor jumps)
            this.editableRef.nativeElement.innerText = this.block.content;
        }
    }

    if (changes['isFocused'] && this.isFocused && this.editableRef && !this.isReviewMode()) {
       // Focus logic handled in view check usually, but redundant check here ok
    }
  }

  getClass() {
    const base = "transition-all duration-200 ease-in-out selection:bg-brand-100 selection:text-brand-900 focus:outline-none";
    switch (this.block.type) {
      case 'h1': return `${base} text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 mb-4 mt-8 leading-tight`;
      case 'h2': return `${base} text-xl md:text-2xl font-medium tracking-tight text-gray-800 mb-3 mt-6 leading-snug`;
      case 'bullet': return `${base} list-disc list-outside ml-5 text-base md:text-lg text-gray-700 leading-7 mb-1 marker:text-gray-400 pl-1`;
      case 'code': return `${base} font-mono text-sm bg-gray-50 text-gray-800 p-4 rounded-lg border border-gray-200 my-4 shadow-sm overflow-x-auto`;
      case 'quote': return `${base} text-lg text-gray-600 italic border-l-4 border-gray-300 pl-5 py-1 my-6`;
      case 'divider': return `hidden`; 
      default: return `${base} text-base md:text-lg text-gray-700 leading-7 mb-2`; // Paragraph
    }
  }

  getPlaceholder() {
    switch(this.block.type) {
      case 'h1': return 'Heading 1';
      case 'h2': return 'Heading 2';
      case 'code': return 'Type code...';
      case 'quote': return 'Empty quote...';
      default: return "Type '/' for commands";
    }
  }
  
  getCategoryColorClass(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('grammar') || t.includes('spelling') || t.includes('typo')) return 'bg-red-500';
    if (t.includes('clarity') || t.includes('simplify')) return 'bg-sky-500';
    if (t.includes('style') || t.includes('tone')) return 'bg-violet-500';
    if (t.includes('alternative')) return 'bg-emerald-500';
    return 'bg-amber-500'; 
  }

  onInput(e: Event) {
    const target = e.target as HTMLElement;
    const text = target.innerText;
    this.internalContent = text;
    this.update.emit(text);
    
    if (text === '/') {
      this.showMenu.set(true);
    } else if (this.showMenu() && !text.startsWith('/')) {
      this.showMenu.set(false);
    }
  }

  onKeyDown(e: KeyboardEvent) {
    if (this.isReviewMode()) {
       if (e.key === 'Escape') this.exitReviewMode();
       return; 
    }

    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        if (this.showMenu()) {
            this.showMenu.set(false);
        }
        this.addNext.emit();
      }
    } else if (e.key === 'Backspace') {
      // Special handling for divider: simple backspace removes it
      if (this.block.type === 'divider') {
          e.preventDefault();
          this.remove.emit();
          return;
      }

      const selection = window.getSelection();
      const isAtStart = selection?.anchorOffset === 0 && selection?.focusOffset === 0;
      const isEmpty = this.editableRef.nativeElement.innerText.length === 0;
      
      if (isEmpty || isAtStart) {
        if (this.block.type !== 'paragraph' && isAtStart) {
           e.preventDefault();
           this.changeType('paragraph');
           return;
        }

        e.preventDefault();
        this.remove.emit();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); 
      this.focusPrev.emit();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusNext.emit();
    } else if (e.key === 'Escape') {
      this.showMenu.set(false);
    }
  }

  onFocus() {
    this.blockFocus.emit();
  }

  preventBlur(e: MouseEvent) {
    e.preventDefault();
  }

  focusEnd() {
    if (this.isReviewMode() || !this.editableRef) return;
    
    const el = this.editableRef.nativeElement;
    el.focus();
    
    if (this.block.type === 'divider') return; // No cursor for divider

    if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  toggleMenu() {
    this.showMenu.update(v => !v);
  }

  changeType(type: Block['type']) {
    if (this.editableRef && this.editableRef.nativeElement.innerText === '/') {
        this.editableRef.nativeElement.innerText = '';
        this.update.emit('');
    }

    this.typeChange.emit(type);
    this.showMenu.set(false);
    
    // Timeout to allow View to update
    setTimeout(() => {
        if (this.editableRef) this.editableRef.nativeElement.focus();
    });
  }

  askAI(mode: AiMode) {
    if (this.editableRef.nativeElement.innerText === '/') {
      this.editableRef.nativeElement.innerText = '';
      this.update.emit('');
    }
    
    if (mode === 'alternatives') {
        this.suggestAlternatives();
        this.showMenu.set(false);
        return;
    }

    this.aiRequest.emit(mode);
    this.showMenu.set(false);
  }

  // --- Review Mode Logic ---

  async triggerReview() {
    if (this.editableRef.nativeElement.innerText === '/') {
        this.editableRef.nativeElement.innerText = '';
        this.update.emit('');
    }
    this.showMenu.set(false);
    
    const text = this.block.content;
    if (!text || text.trim().length < 5) return;

    this.isReviewing.set(true);
    
    try {
        const results = await this.aiService.reviewText(text);
        if (results.length > 0) {
            this.suggestions.set(results);
            this.generateReviewHtml();
            this.isReviewMode.set(true);
            this.notify.emit({type: 'success', message: `${results.length} suggestions found`});
        } else {
            this.notify.emit({type: 'success', message: 'No issues found. Good job!'});
        }
    } catch(e) {
        this.notify.emit({type: 'error', message: 'Could not review text'});
    } finally {
        this.isReviewing.set(false);
    }
  }

  async suggestAlternatives() {
    const text = this.block.content;
    if (!text || text.trim().length < 3) return;

    this.isReviewing.set(true);
    try {
        const results = await this.aiService.getAlternatives(text);
        if (results.length > 0) {
            this.suggestions.set(results);
            this.generateReviewHtml();
            this.isReviewMode.set(true);
            this.notify.emit({type: 'success', message: `${results.length} alternatives found`});
        } else {
            this.notify.emit({type: 'info', message: 'No alternatives found'});
        }
    } catch(e) {
        this.notify.emit({type: 'error', message: 'Could not find alternatives'});
    } finally {
        this.isReviewing.set(false);
    }
  }

  generateReviewHtml() {
    // Use internalContent for optimistic rendering
    let html = this.internalContent
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const uniqueSuggestions = this.suggestions();
    // Map markers to their HTML spans
    const markers: Map<string, string> = new Map();

    uniqueSuggestions.forEach((s, index) => {
        // Escape the original text so we can match it against the escaped HTML content
        const safeOriginal = s.original
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Escape regex special characters to safely create a RegExp
        const escapedRegex = safeOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Generate a unique marker
        const marker = `__REVIEW_MARKER_${index}__`;
        
        let className = 'review-style';
        const type = s.type.toLowerCase();
        
        if (type.includes('grammar') || type.includes('spelling') || type.includes('typo')) {
            className = 'review-error';
        } else if (type.includes('clarity') || type.includes('simplify')) {
            className = 'review-clarity';
        } else if (type.includes('style') || type.includes('tone')) {
            className = 'review-style';
        } else if (type.includes('alternative')) {
            className = 'review-alternative';
        }

        // The content INSIDE the span must also be the escaped text to render correctly
        const span = `<span class="review-highlight ${className}" data-index="${index}">${safeOriginal}</span>`;
        markers.set(marker, span);

        // Replace the FIRST occurrence of the text with the marker.
        const regex = new RegExp(escapedRegex); 
        html = html.replace(regex, marker);
    });

    // Replace all markers with their corresponding span HTML
    markers.forEach((span, marker) => {
        html = html.replace(marker, span);
    });

    this.reviewHtmlSafe = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  handleReviewClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // Check if we clicked on a highlight span
    if (target.classList.contains('review-highlight')) {
        const indexStr = target.getAttribute('data-index');
        if (indexStr !== null) {
            const index = parseInt(indexStr, 10);
            const suggestions = this.suggestions();
            
            if (index >= 0 && index < suggestions.length) {
                this.activeSuggestion.set(suggestions[index]);
                
                // Calculate popover position relative to the container
                const rect = target.getBoundingClientRect();
                const parentRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                
                this.popoverPosition = {
                    x: rect.left - parentRect.left,
                    y: (rect.top - parentRect.top) - 170 // Position higher above the word
                };

                // Highlight active state
                const container = e.currentTarget as HTMLElement;
                container.querySelectorAll('.review-active').forEach(el => el.classList.remove('review-active'));
                target.classList.add('review-active');
            }
        }
    } else {
        // Clicked outside a highlight? Dismiss popover
        this.activeSuggestion.set(null);
        if (e.currentTarget instanceof HTMLElement) {
             e.currentTarget.querySelectorAll('.review-active').forEach(el => el.classList.remove('review-active'));
        }
    }
  }

  acceptSuggestion(s: Suggestion) {
    let content = this.internalContent;
    
    // Replace text (First occurrence strategy)
    // For a more robust solution, we'd need indices from the AI or fuzzy matching, 
    // but simple replacement is acceptable for this MVP.
    content = content.replace(s.original, s.suggestion);
    
    // Update local state immediately (Optimistic Update)
    this.internalContent = content;
    this.update.emit(content);
    
    // Remove the accepted suggestion from the list
    const newSuggestions = this.suggestions().filter(item => item !== s);
    this.suggestions.set(newSuggestions);
    this.activeSuggestion.set(null);
    
    if (newSuggestions.length === 0) {
        this.notify.emit({type: 'success', message: 'All suggestions resolved'});
        this.exitReviewMode();
    } else {
        // Immediately regenerate highlights with the new content
        this.generateReviewHtml();
        this.notify.emit({type: 'success', message: 'Suggestion applied'});
    }
  }

  dismissSuggestion(s: Suggestion) {
    const newSuggestions = this.suggestions().filter(item => item !== s);
    this.suggestions.set(newSuggestions);
    this.activeSuggestion.set(null);
    
    if (newSuggestions.length === 0) {
        this.exitReviewMode();
    } else {
        this.generateReviewHtml();
    }
  }

  exitReviewMode() {
    this.isReviewMode.set(false);
    this.activeSuggestion.set(null);
    this.suggestions.set([]);
    // Restore focus and content
    setTimeout(() => {
        if(this.editableRef) {
            this.editableRef.nativeElement.innerText = this.block.content;
            this.focusEnd();
        }
    });
  }
}