import { Component, ChangeDetectionStrategy, inject, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportService, ExportFormat, ExportScope } from '../../services/export.service';
import { BlockService } from '../../services/block.service';

@Component({
  selector: 'app-export-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" (click)="close.emit()"></div>

      <!-- Modal Card -->
      <div class="relative w-full max-w-4xl bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/15 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-white tracking-tight">Export Manuscript</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Multiple Formats
                </span>
              </div>
              <p class="text-xs text-indigo-200/80">Export to PDF, Markdown, Plain Text, EPUB, or HTML respecting your redactions</p>
            </div>
          </div>
          
          <button 
            (click)="close.emit()" 
            class="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal (Esc)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1 bg-[#fcfcfb] dark:bg-zinc-900/60">

          <!-- 1. Format Selection -->
          <div>
            <label class="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-2.5">
              1. Choose Export Format
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              
              <!-- PDF -->
              <button 
                type="button"
                (click)="setFormat('pdf')"
                [class]="'p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ' + 
                  (selectedFormat() === 'pdf' 
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-xs ring-2 ring-indigo-600/20' 
                    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50/50 dark:hover:bg-zinc-750')"
              >
                <div class="flex items-center justify-between mb-2">
                  <div [class]="'w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ' + 
                    (selectedFormat() === 'pdf' ? 'bg-red-500 text-white' : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300')">
                    PDF
                  </div>
                  @if (selectedFormat() === 'pdf') {
                    <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                  }
                </div>
                <div>
                  <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">PDF Document</div>
                  <div class="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">Paginated, serif print layout with redactions</div>
                </div>
              </button>

              <!-- Markdown -->
              <button 
                type="button"
                (click)="setFormat('markdown')"
                [class]="'p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ' + 
                  (selectedFormat() === 'markdown' 
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-xs ring-2 ring-indigo-600/20' 
                    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50/50 dark:hover:bg-zinc-750')"
              >
                <div class="flex items-center justify-between mb-2">
                  <div [class]="'w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ' + 
                    (selectedFormat() === 'markdown' ? 'bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300')">
                    MD
                  </div>
                  @if (selectedFormat() === 'markdown') {
                    <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                  }
                </div>
                <div>
                  <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">Markdown (.md)</div>
                  <div class="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">CommonMark syntax, headings & block elements</div>
                </div>
              </button>

              <!-- Plain Text -->
              <button 
                type="button"
                (click)="setFormat('txt')"
                [class]="'p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ' + 
                  (selectedFormat() === 'txt' 
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-xs ring-2 ring-indigo-600/20' 
                    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50/50 dark:hover:bg-zinc-750')"
              >
                <div class="flex items-center justify-between mb-2">
                  <div [class]="'w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ' + 
                    (selectedFormat() === 'txt' ? 'bg-slate-700 text-white' : 'bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300')">
                    TXT
                  </div>
                  @if (selectedFormat() === 'txt') {
                    <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                  }
                </div>
                <div>
                  <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">Plain Text (.txt)</div>
                  <div class="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">Clean universal text with structured redactions</div>
                </div>
              </button>

              <!-- EPUB -->
              <button 
                type="button"
                (click)="setFormat('epub')"
                [class]="'p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ' + 
                  (selectedFormat() === 'epub' 
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-xs ring-2 ring-indigo-600/20' 
                    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50/50 dark:hover:bg-zinc-750')"
              >
                <div class="flex items-center justify-between mb-2">
                  <div [class]="'w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ' + 
                    (selectedFormat() === 'epub' ? 'bg-purple-600 text-white' : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300')">
                    EPUB
                  </div>
                  @if (selectedFormat() === 'epub') {
                    <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                  }
                </div>
                <div>
                  <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">EPUB E-Book</div>
                  <div class="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">E-reader package with TOC & chapters</div>
                </div>
              </button>

              <!-- HTML -->
              <button 
                type="button"
                (click)="setFormat('html')"
                [class]="'p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ' + 
                  (selectedFormat() === 'html' 
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-xs ring-2 ring-indigo-600/20' 
                    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50/50 dark:hover:bg-zinc-750')"
              >
                <div class="flex items-center justify-between mb-2">
                  <div [class]="'w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ' + 
                    (selectedFormat() === 'html' ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300')">
                    HTML
                  </div>
                  @if (selectedFormat() === 'html') {
                    <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                  }
                </div>
                <div>
                  <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">HTML Web Page</div>
                  <div class="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">Standalone styled web document</div>
                </div>
              </button>
            </div>
          </div>

          <!-- 2. Export Scope & Options Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- Scope Card -->
            <div class="p-4 bg-white dark:bg-zinc-850 rounded-xl border border-gray-200 dark:border-zinc-700 space-y-3">
              <label class="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                2. Export Scope
              </label>
              
              <div class="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  (click)="setScope('document')"
                  [class]="'p-2.5 rounded-lg border text-left transition-all cursor-pointer ' + 
                    (selectedScope() === 'document' 
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-bold' 
                      : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-medium hover:bg-gray-100 dark:hover:bg-zinc-700')"
                >
                  <div class="flex items-center gap-1.5 text-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                    </svg>
                    <span>Full Document</span>
                  </div>
                  <div class="text-[10px] text-gray-500 dark:text-zinc-400 font-normal mt-1">
                    All {{ blockService.chapters().length }} chapters ({{ blockService.wordCount() | number }}w)
                  </div>
                </button>

                <button 
                  type="button"
                  (click)="setScope('chapter')"
                  [class]="'p-2.5 rounded-lg border text-left transition-all cursor-pointer ' + 
                    (selectedScope() === 'chapter' 
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-bold' 
                      : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-medium hover:bg-gray-100 dark:hover:bg-zinc-700')"
                >
                  <div class="flex items-center gap-1.5 text-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span>Current Chapter</span>
                  </div>
                  <div class="text-[10px] text-gray-500 dark:text-zinc-400 font-normal mt-1 truncate">
                    {{ blockService.activeChapterTitle() || 'Active Chapter' }}
                  </div>
                </button>
              </div>

              <!-- Title & Filename Customization -->
              <div class="pt-2">
                <label class="block text-[11px] font-semibold text-gray-600 dark:text-zinc-400 mb-1">Document Title in Export</label>
                <input 
                  type="text" 
                  [(ngModel)]="customTitle"
                  (ngModelChange)="onOptionChange()"
                  placeholder="Document Title" 
                  class="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                />
              </div>

              <!-- Include Header Metadata Checkbox -->
              <label class="flex items-center gap-2 cursor-pointer pt-1">
                <input 
                  type="checkbox" 
                  [(ngModel)]="includeMetadata"
                  (ngModelChange)="onOptionChange()"
                  class="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                <span class="text-xs text-gray-700 dark:text-zinc-300 font-medium">Include title banner & export timestamp metadata</span>
              </label>
            </div>

            <!-- 3. Redactions Respect Control Card (Core Requirement) -->
            <div [class]="'p-4 rounded-xl border transition-all space-y-3 ' + 
              (respectRedactions() 
                ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/80' 
                : 'bg-white dark:bg-zinc-850 border-gray-200 dark:border-zinc-700')">
              
              <div class="flex items-center justify-between">
                <div>
                  <label class="block text-xs font-bold text-gray-800 dark:text-zinc-200 uppercase tracking-wider">
                    3. Redaction Compliance
                  </label>
                  <div class="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                    Controls whether sensitive terms are masked
                  </div>
                </div>

                <!-- Toggle Switch -->
                <button 
                  type="button" 
                  (click)="toggleRedactions()"
                  [class]="'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ' + 
                    (respectRedactions() ? 'bg-amber-600' : 'bg-gray-300 dark:bg-zinc-700')"
                  role="switch"
                  [attr.aria-checked]="respectRedactions()"
                  title="Toggle redaction masking on or off"
                >
                  <span 
                    [class]="'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ' + 
                      (respectRedactions() ? 'translate-x-5' : 'translate-x-0')"
                  ></span>
                </button>
              </div>

              <!-- Status Banner -->
              <div [class]="'p-2.5 rounded-lg border flex items-center justify-between text-xs ' + 
                (respectRedactions() 
                  ? 'bg-amber-100/70 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-medium' 
                  : 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300')">
                <div class="flex items-center gap-1.5">
                  @if (respectRedactions()) {
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-amber-700 dark:text-amber-400 shrink-0">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span><strong>Redactions Respected:</strong> Sensitive terms obscured</span>
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 dark:text-zinc-400 shrink-0">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                    </svg>
                    <span><strong>Uncensored / Full:</strong> Raw text exported</span>
                  }
                </div>

                <span class="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-white/80 dark:bg-zinc-800 border border-black/10 dark:border-white/10 shrink-0">
                  {{ previewData().redactedCount }} masked
                </span>
              </div>

              <!-- Redaction Style Selector (when active) -->
              @if (respectRedactions()) {
                <div class="pt-1 space-y-1.5 animate-in fade-in-50 duration-150">
                  <label class="block text-[11px] font-semibold text-gray-700 dark:text-zinc-300">Masking Style</label>
                  <div class="grid grid-cols-3 gap-1.5">
                    <button 
                      type="button"
                      (click)="setRedactionStyle('blackout')"
                      [class]="'py-1 px-2 rounded-md text-[11px] font-mono border text-center transition-all cursor-pointer ' + 
                        (redactionStyle() === 'blackout' 
                          ? 'border-gray-900 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold' 
                          : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700')"
                    >
                      ████ Blackout
                    </button>

                    <button 
                      type="button"
                      (click)="setRedactionStyle('redact_pill')"
                      [class]="'py-1 px-2 rounded-md text-[11px] font-mono border text-center transition-all cursor-pointer ' + 
                        (redactionStyle() === 'redact_pill' 
                          ? 'border-gray-900 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold' 
                          : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700')"
                    >
                      [REDACTED]
                    </button>

                    <button 
                      type="button"
                      (click)="setRedactionStyle('asterisks')"
                      [class]="'py-1 px-2 rounded-md text-[11px] font-mono border text-center transition-all cursor-pointer ' + 
                        (redactionStyle() === 'asterisks' 
                          ? 'border-gray-900 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold' 
                          : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700')"
                    >
                      **** Asterisks
                    </button>
                  </div>
                </div>
              }
            </div>

          </div>

          <!-- 4. Live Output Preview -->
          <div class="bg-white dark:bg-zinc-850 rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden shadow-2xs">
            <div class="px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-800 dark:text-zinc-200">Export Preview:</span>
                <span class="font-mono text-[11px] text-gray-600 dark:text-zinc-300 bg-gray-200/80 dark:bg-zinc-700 px-2 py-0.5 rounded">
                  {{ previewData().filename }}
                </span>
              </div>
              <div class="flex items-center gap-3 text-gray-500 dark:text-zinc-400 text-[11px]">
                <span>{{ previewData().wordCount | number }} words</span>
                <span>•</span>
                <span class="font-semibold text-amber-700 dark:text-amber-400">{{ previewData().redactedCount }} redactions</span>
              </div>
            </div>

            <!-- Preview Box -->
            <div class="p-4 max-h-56 overflow-y-auto font-mono text-xs text-gray-800 dark:text-zinc-200 leading-relaxed bg-[#fafaf9] dark:bg-zinc-900 whitespace-pre-wrap select-all border-b border-gray-100 dark:border-zinc-800">
              {{ previewData().content }}
            </div>

            <!-- Preview Bar Actions -->
            <div class="px-4 py-2 bg-white dark:bg-zinc-850 flex items-center justify-between text-xs text-gray-600 dark:text-zinc-400">
              <span class="text-[11px] text-gray-400 dark:text-zinc-500">Shows live preview with applied settings</span>
              
              <button 
                type="button" 
                (click)="copyToClipboard()"
                class="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                @if (isCopied()) {
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
                  <span class="text-emerald-600 dark:text-emerald-400 font-bold">Copied to Clipboard!</span>
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  <span>Copy Text</span>
                }
              </button>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="px-5 py-3.5 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div class="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Client-side generation with zero server retention</span>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button 
              type="button"
              (click)="close.emit()" 
              class="px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <!-- Print View Button (great for PDF / print previews) -->
            <button 
              type="button"
              (click)="printDocument()"
              class="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Open browser print dialog for formatted PDF output"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect width="12" height="8" x="6" y="14"/>
              </svg>
              <span>Print View</span>
            </button>

            <!-- Primary Export Button -->
            <button 
              type="button"
              (click)="executeExport()"
              [disabled]="isExporting()"
              class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 min-w-[140px] cursor-pointer disabled:opacity-50"
            >
              @if (isExporting()) {
                <svg class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generating {{ selectedFormat().toUpperCase() }}...</span>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Download {{ formatLabel() }}</span>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  `
})
export class ExportModalComponent implements OnInit {
  exportService = inject(ExportService);
  blockService = inject(BlockService);

  @Output() close = new EventEmitter<void>();

  selectedFormat = signal<ExportFormat>('pdf');
  selectedScope = signal<ExportScope>('document');
  respectRedactions = signal<boolean>(true);
  redactionStyle = signal<'blackout' | 'blackbar' | 'blur' | 'spoiler' | 'asterisks' | 'redact_pill'>('blackout');
  
  customTitle = '';
  includeMetadata = true;

  isExporting = signal<boolean>(false);
  isCopied = signal<boolean>(false);
  private copyTimer: any = null;

  previewData = computed(() => {
    return this.exportService.generatePreview({
      format: this.selectedFormat(),
      scope: this.selectedScope(),
      respectRedactions: this.respectRedactions(),
      redactionStyle: this.redactionStyle(),
      customTitle: this.customTitle.trim() || undefined,
      includeMetadata: this.includeMetadata
    });
  });

  formatLabel = computed(() => {
    switch (this.selectedFormat()) {
      case 'pdf': return 'PDF (.pdf)';
      case 'markdown': return 'Markdown (.md)';
      case 'txt': return 'Plain Text (.txt)';
      case 'epub': return 'EPUB Book (.epub)';
      case 'html': return 'HTML File (.html)';
    }
  });

  ngOnInit() {
    const doc = this.blockService.currentDoc();
    if (doc) {
      this.customTitle = doc.title || 'Untitled Document';
      // Default respectRedactions based on whether document is in filtered or uncensored mode
      this.respectRedactions.set(!doc.isUncensored);
      const style = doc.censorshipConfig?.redactionStyle;
      if (style) {
        this.redactionStyle.set(style);
      }
    }
  }

  setFormat(format: ExportFormat) {
    this.selectedFormat.set(format);
  }

  setScope(scope: ExportScope) {
    this.selectedScope.set(scope);
  }

  toggleRedactions() {
    this.respectRedactions.update(v => !v);
  }

  setRedactionStyle(style: 'blackout' | 'blackbar' | 'blur' | 'spoiler' | 'asterisks' | 'redact_pill') {
    this.redactionStyle.set(style);
  }

  onOptionChange() {
    // Triggers reactivity
  }

  async executeExport() {
    this.isExporting.set(true);
    try {
      await this.exportService.exportDocument({
        format: this.selectedFormat(),
        scope: this.selectedScope(),
        respectRedactions: this.respectRedactions(),
        redactionStyle: this.redactionStyle(),
        customTitle: this.customTitle.trim() || undefined,
        includeMetadata: this.includeMetadata
      });
      setTimeout(() => {
        this.isExporting.set(false);
      }, 500);
    } catch (e) {
      console.error('Export error', e);
      this.isExporting.set(false);
    }
  }

  async copyToClipboard() {
    const text = this.previewData().content;
    try {
      await navigator.clipboard.writeText(text);
      this.isCopied.set(true);
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => {
        this.isCopied.set(false);
      }, 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.isCopied.set(true);
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => {
        this.isCopied.set(false);
      }, 2500);
    }
  }

  printDocument() {
    const preview = this.previewData();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${this.customTitle || 'Export'}</title>
        <style>
          body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 30px auto; padding: 0 20px; color: #111; }
          h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 30px; }
          pre { white-space: pre-wrap; font-family: inherit; }
          @media print {
            body { max-width: 100%; margin: 0; }
          }
        </style>
      </head>
      <body>
        <h1>${this.customTitle || 'Document Export'}</h1>
        <pre>${preview.content}</pre>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
