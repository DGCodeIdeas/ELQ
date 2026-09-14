import { Component, ChangeDetectionStrategy, inject, signal, computed, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../services/ai.service';
import { BlockService } from '../../services/block.service';
import { 
  DOCUMENT_TYPES, 
  PARAPHRASE_STYLES, 
  DocumentTypeDefinition, 
  ParaphraseStyleDefinition, 
  ParaphraseAlternative,
  ParaphraseResponse
} from '../../services/paraphrase.types';

interface DiffToken {
  text: string;
  type: 'same' | 'added' | 'removed';
}

@Component({
  selector: 'app-paraphrase-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" (click)="close.emit()"></div>

      <!-- Main Modal Card -->
      <div class="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50/70 via-indigo-50/50 to-white">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                <path d="M5 3v4"/>
                <path d="M19 17v4"/>
                <path d="M3 5h4"/>
                <path d="M17 19h4"/>
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-gray-900 tracking-tight">AI Paraphrasing & Style Transformer</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                  {{ detectedScope() }}
                </span>
                @if (isMatureRegister()) {
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-100 text-pink-700 border border-pink-200">
                    Mature 18+ Uncensored
                  </span>
                }
              </div>
              <p class="text-xs text-gray-500">Context-aware natural alternatives adapted to your exact document type & register</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            @if (hasReplaced()) {
              <button 
                (click)="onUndo()" 
                class="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors flex items-center gap-1"
                title="Revert replacement"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                Undo Replacement
              </button>
            }
            <button 
              (click)="close.emit()" 
              class="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Close modal (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1 custom-scrollbar">

          <!-- Controls Section: Document Type & Paraphrase Style -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200/80">
            
            <!-- Document Type / Register Selector -->
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                <span>Document Register</span>
                <span class="text-[10px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                  {{ selectedDocDef()?.category }}
                </span>
              </label>
              
              <div class="relative">
                <select 
                  [ngModel]="currentDocType()"
                  (ngModelChange)="onDocumentTypeChange($event)"
                  class="w-full bg-white border border-gray-300 text-gray-900 text-xs font-medium rounded-xl px-3 py-2 pr-8 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer shadow-2xs"
                >
                  <optgroup label="Fiction & Creative">
                    @for (dt of getDocTypesByCategory('Fiction & Creative'); track dt.id) {
                      <option [value]="dt.id">{{ dt.name }}</option>
                    }
                  </optgroup>
                  
                  <optgroup label="Academic & Research">
                    @for (dt of getDocTypesByCategory('Academic & Research'); track dt.id) {
                      <option [value]="dt.id">{{ dt.name }}</option>
                    }
                  </optgroup>

                  <optgroup label="Legal & Regulatory">
                    @for (dt of getDocTypesByCategory('Legal & Regulatory'); track dt.id) {
                      <option [value]="dt.id">{{ dt.name }}</option>
                    }
                  </optgroup>

                  <optgroup label="Professional & Business">
                    @for (dt of getDocTypesByCategory('Professional & Business'); track dt.id) {
                      <option [value]="dt.id">{{ dt.name }}</option>
                    }
                  </optgroup>

                  <optgroup label="Specialized & Media">
                    @for (dt of getDocTypesByCategory('Specialized & Media'); track dt.id) {
                      <option [value]="dt.id">{{ dt.name }}</option>
                    }
                  </optgroup>
                </select>
              </div>

              <p class="text-[11px] text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                {{ selectedDocDef()?.description }}
              </p>
            </div>

            <!-- Paraphrase Style Selector -->
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                <span>Paraphrase Style</span>
                <span class="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                  {{ selectedStyleDef()?.badge }}
                </span>
              </label>

              <select 
                [ngModel]="currentStyle()"
                (ngModelChange)="onStyleChange($event)"
                class="w-full bg-white border border-gray-300 text-gray-900 text-xs font-medium rounded-xl px-3 py-2 pr-8 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer shadow-2xs"
              >
                @for (style of styles; track style.id) {
                  <option [value]="style.id">{{ style.name }}</option>
                }
              </select>

              <p class="text-[11px] text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                {{ selectedStyleDef()?.description }}
              </p>
            </div>
          </div>

          <!-- Original Selected Text Box & Custom Guidance -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>Selected Text</span>
                <span class="text-gray-400 font-normal">({{ textWordCount() }} words, {{ editableText().length }} chars)</span>
              </span>

              <!-- Quick action to toggle custom prompt -->
              <button 
                (click)="showCustomGuidance.set(!showCustomGuidance())"
                class="text-xs text-purple-700 hover:text-purple-900 font-medium flex items-center gap-1 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
                <span>{{ showCustomGuidance() ? 'Hide Custom Guidance' : '+ Add Custom Direction' }}</span>
              </button>
            </div>

            <div class="relative">
              <textarea 
                [ngModel]="editableText()" 
                (ngModelChange)="editableText.set($event)"
                rows="2"
                class="w-full text-xs sm:text-sm font-serif text-gray-800 bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-y shadow-2xs"
                placeholder="Type or select text to paraphrase..."
              ></textarea>
            </div>

            <!-- Optional Custom Instruction Field -->
            @if (showCustomGuidance()) {
              <div class="bg-purple-50/60 p-3 rounded-xl border border-purple-100 flex items-center gap-2 animate-in fade-in duration-150">
                <div class="text-purple-600 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </div>
                <input 
                  type="text" 
                  [ngModel]="customInstruction()" 
                  (ngModelChange)="customInstruction.set($event)"
                  placeholder="Custom instruction (e.g., 'Make it more cynical', 'Adopt 1890s Victorian cadence', 'Tone down legal jargon')..."
                  class="w-full bg-white border border-purple-200 text-xs text-gray-800 rounded-lg px-2.5 py-1.5 outline-none focus:border-purple-500"
                />
              </div>
            }

            <!-- Trigger Button -->
            <div class="flex items-center justify-between pt-1">
              <div class="flex items-center gap-2">
                <!-- Diff Mode Toggle -->
                <button 
                  (click)="showDiffMode.set(!showDiffMode())"
                  [class]="'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ' + 
                    (showDiffMode() 
                      ? 'bg-purple-50 text-purple-800 border-purple-300' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')"
                  title="Toggle visual diff highlighting changes"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
                  <span>Diff View: {{ showDiffMode() ? 'ON' : 'OFF' }}</span>
                </button>
              </div>

              <button 
                (click)="generateAlternatives()" 
                [disabled]="isLoading() || !editableText().trim()"
                class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer"
              >
                @if (isLoading()) {
                  <svg class="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Synthesizing Alternatives...</span>
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                  </svg>
                  <span>Generate Alternatives</span>
                }
              </button>
            </div>
          </div>

          <!-- Alternatives Output List -->
          <div class="space-y-3 pt-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-gray-700 uppercase tracking-wider">
                AI Suggested Alternatives ({{ alternatives().length }})
              </span>
              @if (lastGeneratedRegister()) {
                <span class="text-[11px] text-gray-400">
                  Tuned for: <strong class="text-gray-600">{{ lastGeneratedRegister() }}</strong>
                </span>
              }
            </div>

            @if (isLoading()) {
              <!-- Loading Skeleton -->
              <div class="space-y-3">
                @for (i of [1, 2, 3]; track i) {
                  <div class="p-4 bg-white rounded-xl border border-gray-200 animate-pulse space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="h-4 w-28 bg-gray-200 rounded-full"></div>
                      <div class="h-4 w-16 bg-gray-100 rounded-full"></div>
                    </div>
                    <div class="h-4 w-full bg-gray-100 rounded"></div>
                    <div class="h-3 w-3/4 bg-gray-100 rounded"></div>
                  </div>
                }
              </div>
            } @else if (alternatives().length === 0) {
              <div class="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                <div class="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-base font-bold">
                  ✨
                </div>
                <p class="text-xs font-bold text-gray-700">No alternatives generated yet</p>
                <p class="text-[11px] text-gray-500 max-w-sm mx-auto">
                  Select your desired document type and paraphrasing style above, then click <strong>Generate Alternatives</strong>.
                </p>
              </div>
            } @else {
              <!-- Cards List -->
              <div class="space-y-3">
                @for (alt of alternatives(); track alt.text) {
                  <div class="p-4 sm:p-5 bg-white rounded-2xl border border-gray-200/90 hover:border-purple-300 hover:shadow-md transition-all space-y-3 group">
                    
                    <!-- Card Header: Badges and Tone -->
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                          {{ alt.label || 'Natural Flow' }}
                        </span>
                        <span class="text-xs text-gray-500 italic">
                          {{ alt.tone }}
                        </span>
                      </div>

                      <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {{ alt.fitScore || 96 }}% Fit
                        </span>
                      </div>
                    </div>

                    <!-- Text Area (Normal or Diff View) -->
                    <div class="text-sm sm:text-base font-serif text-gray-900 leading-relaxed bg-gray-50/50 p-3.5 rounded-xl border border-gray-100">
                      @if (showDiffMode()) {
                        <div class="diff-container leading-relaxed">
                          @for (token of getDiff(editableText(), alt.text); track $index) {
                            @if (token.type === 'added') {
                              <span class="bg-emerald-100 text-emerald-900 px-1 py-0.2 rounded font-medium">{{ token.text }}</span>
                            } @else if (token.type === 'removed') {
                              <span class="bg-rose-100 text-rose-800 line-through opacity-70 px-1 py-0.2 rounded mx-0.5">{{ token.text }}</span>
                            } @else {
                              <span>{{ token.text }}</span>
                            }
                            <span> </span>
                          }
                        </div>
                      } @else {
                        {{ alt.text }}
                      }
                    </div>

                    <!-- Explanation -->
                    @if (alt.explanation) {
                      <p class="text-xs text-gray-500 leading-relaxed">
                        <span class="font-medium text-gray-700">Rationale:</span> {{ alt.explanation }}
                      </p>
                    }

                    <!-- Actions -->
                    <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
                      <div class="flex items-center gap-2">
                        <!-- Copy button -->
                        <button 
                          (click)="copyAlternative(alt.text)"
                          class="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors flex items-center gap-1.5"
                          title="Copy to clipboard"
                        >
                          @if (copiedText() === alt.text) {
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
                            <span class="text-emerald-700 font-bold">Copied!</span>
                          } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            <span>Copy</span>
                          }
                        </button>

                        <!-- Insert below button -->
                        <button 
                          (click)="onInsertBelow(alt.text)"
                          class="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors flex items-center gap-1.5"
                          title="Insert as comparison on a new line below selection"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          <span>Insert Below</span>
                        </button>
                      </div>

                      <!-- Replace Selection (Primary Action) -->
                      <button 
                        (click)="onReplace(alt.text)"
                        class="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Replace highlighted selection with this alternative"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Replace Selection</span>
                      </button>
                    </div>

                  </div>
                }
              </div>
            }
          </div>

        </div>

        <!-- Footer -->
        <div class="px-5 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div class="flex items-center gap-2">
            <span>Shortcut: <strong>Ctrl+Shift+P</strong> to paraphrase selection</span>
          </div>

          <div class="flex items-center gap-3">
            <button 
              (click)="close.emit()" 
              class="px-4 py-1.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200/80 transition-colors"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  `
})
export class ParaphraseModalComponent implements OnInit, OnChanges {
  aiService = inject(AiService);
  blockService = inject(BlockService);

  @Input() selectedText = '';
  @Input() surroundingContext = '';
  @Input() initialDocumentType?: string;
  @Input() initialStyle = 'natural';

  @Output() close = new EventEmitter<void>();
  @Output() replace = new EventEmitter<string>();
  @Output() insertBelow = new EventEmitter<string>();
  @Output() undo = new EventEmitter<void>();

  docTypes = DOCUMENT_TYPES;
  styles = PARAPHRASE_STYLES;

  editableText = signal<string>('');
  currentDocType = signal<string>('novel_sfw');
  currentStyle = signal<string>('natural');
  customInstruction = signal<string>('');
  showCustomGuidance = signal<boolean>(false);
  showDiffMode = signal<boolean>(false);

  isLoading = signal<boolean>(false);
  alternatives = signal<ParaphraseAlternative[]>([]);
  lastGeneratedRegister = signal<string>('');
  hasReplaced = signal<boolean>(false);
  originalReplacedText = signal<string>('');
  copiedText = signal<string | null>(null);

  selectedDocDef = computed(() => {
    return this.docTypes.find(d => d.id === this.currentDocType()) || this.docTypes[0];
  });

  selectedStyleDef = computed(() => {
    return this.styles.find(s => s.id === this.currentStyle()) || this.styles[0];
  });

  isMatureRegister = computed(() => {
    return this.currentDocType() === 'novel_nsfw';
  });

  textWordCount = computed(() => {
    const txt = this.editableText().trim();
    if (!txt) return 0;
    return txt.split(/\s+/).length;
  });

  detectedScope = computed<'Word' | 'Sentence' | 'Paragraph'>(() => {
    const count = this.textWordCount();
    if (count <= 1) return 'Word';
    if (count <= 32) return 'Sentence';
    return 'Paragraph';
  });

  ngOnInit() {
    this.initFromInputs();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedText'] && changes['selectedText'].currentValue) {
      this.initFromInputs();
    }
  }

  private initFromInputs() {
    const raw = this.selectedText || '';
    this.editableText.set(raw);
    
    // Default document type from input or blockService
    const docType = this.initialDocumentType || this.blockService.documentType() || 'novel_sfw';
    this.currentDocType.set(docType);
    this.currentStyle.set(this.initialStyle || 'natural');

    // Auto-generate if text is provided
    if (raw.trim().length > 0) {
      this.generateAlternatives();
    }
  }

  getDocTypesByCategory(category: string): DocumentTypeDefinition[] {
    return this.docTypes.filter(d => d.category === category);
  }

  onDocumentTypeChange(type: string) {
    this.currentDocType.set(type);
    // Also sync document type with block service so the document remembers its register
    this.blockService.setDocumentType(type);
    this.generateAlternatives();
  }

  onStyleChange(style: string) {
    this.currentStyle.set(style);
    this.generateAlternatives();
  }

  async generateAlternatives() {
    const text = this.editableText().trim();
    if (!text) return;

    this.isLoading.set(true);
    const docDef = this.selectedDocDef();
    this.lastGeneratedRegister.set(docDef ? `${docDef.name} (${this.selectedStyleDef()?.name})` : '');

    try {
      const resp = await this.aiService.paraphraseText({
        text,
        selectionType: this.detectedScope().toLowerCase() as any,
        documentType: this.currentDocType(),
        style: this.currentStyle(),
        customInstruction: this.customInstruction(),
        surroundingContext: this.surroundingContext,
        isDocUncensored: this.blockService.isUncensored() || this.isMatureRegister()
      });

      this.alternatives.set(resp.alternatives || []);
    } catch (err) {
      console.error('Failed to generate alternatives:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  onReplace(newText: string) {
    this.originalReplacedText.set(this.editableText());
    this.hasReplaced.set(true);
    this.replace.emit(newText);
    this.editableText.set(newText);
  }

  onInsertBelow(newText: string) {
    this.insertBelow.emit(newText);
  }

  onUndo() {
    const prev = this.originalReplacedText();
    if (prev) {
      this.replace.emit(prev);
      this.editableText.set(prev);
      this.hasReplaced.set(false);
    }
    this.undo.emit();
  }

  copyAlternative(text: string) {
    navigator.clipboard.writeText(text);
    this.copiedText.set(text);
    setTimeout(() => {
      if (this.copiedText() === text) {
        this.copiedText.set(null);
      }
    }, 2000);
  }

  // Word-level diff calculation
  getDiff(original: string, modified: string): DiffToken[] {
    const origWords = original.trim().split(/\s+/);
    const modWords = modified.trim().split(/\s+/);

    const tokens: DiffToken[] = [];
    let i = 0;
    let j = 0;

    while (i < origWords.length || j < modWords.length) {
      if (i < origWords.length && j < modWords.length && origWords[i] === modWords[j]) {
        tokens.push({ text: origWords[i], type: 'same' });
        i++;
        j++;
      } else if (j < modWords.length && (!origWords.includes(modWords[j]) || (i < origWords.length && origWords.indexOf(modWords[j]) > i))) {
        tokens.push({ text: modWords[j], type: 'added' });
        j++;
      } else if (i < origWords.length) {
        tokens.push({ text: origWords[i], type: 'removed' });
        i++;
      } else {
        tokens.push({ text: modWords[j], type: 'added' });
        j++;
      }
    }

    return tokens;
  }
}
