import { Component, ChangeDetectionStrategy, inject, signal, computed, effect, ViewChild, ElementRef, AfterViewChecked, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiService } from '../../services/ai.service';
import { BlockService } from '../../services/block.service';
import { RagService } from '../../services/rag.service';
import { marked } from 'marked';

@Component({
  selector: 'app-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styles: [`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
    }
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
    ::ng-deep .chat-markdown h1 { font-size: 1.5em; font-weight: 700; margin-top: 1em; margin-bottom: 0.5em; letter-spacing: -0.025em; }
    ::ng-deep .chat-markdown h2 { font-size: 1.25em; font-weight: 600; margin-top: 0.8em; margin-bottom: 0.4em; letter-spacing: -0.015em; }
    ::ng-deep .chat-markdown p { margin-bottom: 1em; line-height: 1.75; color: #374151; }
    ::ng-deep .chat-markdown ul, ::ng-deep .chat-markdown ol { margin-bottom: 1em; padding-left: 1.25em; }
    ::ng-deep .chat-markdown li { margin-bottom: 0.25em; }
  `],
  template: `
    <div class="h-full flex flex-col bg-white font-sans w-full relative">
      
      @if (blockService.isLoading()) {
         <!-- Skeleton -->
         <div class="animate-pulse flex flex-col h-full bg-white p-6 gap-4">
             <div class="h-8 bg-gray-100 rounded w-1/3"></div>
             <div class="h-32 bg-gray-100 rounded w-full"></div>
         </div>
      } @else {
      <!-- Header -->
      <div class="px-6 py-3 border-b border-gray-100 bg-white/95 backdrop-blur-sm shrink-0 z-20 flex flex-col gap-3">
        <div class="flex justify-between items-center">
           <div class="flex items-center gap-2">
              <button (click)="toggleHistory()" class="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors relative" title="History">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg>
              </button>
              <div class="flex items-center gap-1.5">
                <div class="w-4 h-4 rounded bg-purple-600 text-white text-[9px] font-bold flex items-center justify-center">E</div>
                <h3 class="font-bold text-gray-900 tracking-tight text-sm">Eloqui AI</h3>
              </div>
           </div>

           <!-- Action buttons: New Chat + Collapse Sidebar -->
           <div class="flex items-center gap-1">
             <button (click)="newChat()" class="p-2 text-gray-400 hover:text-brand-600 hover:bg-gray-50 rounded-lg transition-colors" title="New Chat">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
             </button>
             <button (click)="closeChat.emit()" class="p-2 -mr-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Collapse AI Sidebar">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/></svg>
             </button>
           </div>
        </div>
        
        <!-- Mode Tabs -->
        <div class="flex gap-4 border-b border-transparent pb-1 overflow-x-auto no-scrollbar">
          <button 
            (click)="setMode('chapter')" 
            [class]="'text-xs font-medium pb-2 border-b-2 transition-all whitespace-nowrap ' + 
            (mode() === 'chapter' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600')">
            Chapter
          </button>
          
          <button 
            (click)="setMode('book')" 
            [class]="'text-xs font-medium pb-2 border-b-2 transition-all flex items-center gap-1 whitespace-nowrap ' + 
            (mode() === 'book' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600')">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            Deep Book
          </button>

          <button 
            (click)="setMode('uncensored')" 
            [class]="'text-xs font-medium pb-2 border-b-2 transition-all whitespace-nowrap ' + 
            (mode() === 'uncensored' ? 'border-slate-900 text-slate-900 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-700')">
            Unfiltered
          </button>

          <button 
            (click)="setMode('dictionary')" 
            [class]="'text-xs font-medium pb-2 border-b-2 transition-all whitespace-nowrap ' + 
            (mode() === 'dictionary' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600')">
            Dictionary
          </button>

          <button 
            (click)="setMode('search')" 
            [class]="'text-xs font-medium pb-2 border-b-2 transition-all whitespace-nowrap ' + 
            (mode() === 'search' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600')">
            Web
          </button>
        </div>
      </div>
      
      <!-- History List Overlay -->
      @if (showHistory()) {
        <div class="absolute inset-x-0 top-[105px] bottom-0 bg-white/98 backdrop-blur z-30 flex flex-col animate-in slide-in-from-top-2 fade-in duration-200">
           <div class="flex-1 overflow-y-auto">
             <div class="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider sticky top-0 bg-white z-10">
               Recent Conversations
             </div>
             @for (session of blockService.sessions(); track session.id) {
               <div class="group flex items-center border-b border-gray-50 last:border-0 hover:bg-gray-50 pr-4">
                 <button 
                   (click)="selectSession(session.id)"
                   [class]="'flex-1 text-left px-6 py-4 text-sm transition-colors ' + 
                   (session.id === blockService.activeSessionId() ? 'text-gray-900 font-medium bg-gray-50/50' : 'text-gray-600')">
                   <div class="truncate font-medium">{{ session.title }}</div>
                   <div class="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {{ session.timestamp | date:'MMM d, h:mm a' }}
                   </div>
                 </button>
                 <button (click)="deleteSession(session.id, $event)" class="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Chat">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                 </button>
               </div>
             }
           </div>
           <div class="p-4 border-t border-gray-100 bg-gray-50" (click)="toggleHistory()">
              <button class="w-full py-2 text-center text-sm font-medium text-gray-500 hover:text-gray-900">Close History</button>
           </div>
        </div>
      }

      <!-- Messages Area -->
      <div #scrollContainer class="flex-1 overflow-y-auto p-0 scroll-smooth space-y-0 relative">
        <!-- RAG Progress Indicator -->
        @if (ragService.isIndexing()) {
             <div class="absolute top-0 inset-x-0 bg-brand-50 border-b border-brand-100 p-2 text-center text-[10px] font-bold text-brand-700 tracking-wide z-10 flex items-center justify-center gap-2">
                 <svg class="animate-spin h-3 w-3 text-brand-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 Indexing Book for Deep Mode... {{ ragService.progress() }}%
             </div>
        }

        @if (mode() !== 'search') {
          <div class="flex justify-center my-6 opacity-0 hover:opacity-100 transition-opacity">
            <div class="text-[10px] text-gray-300 flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full border border-gray-100">
               @if (mode() === 'book') {
                 Deep Analysis (RAG Enabled)
               } @else if (mode() === 'dictionary') {
                 Dictionary Lookup
               } @else if (mode() === 'uncensored') {
                 Unfiltered Mode (Objective & Direct)
               } @else {
                 Active Chapter Context
               }
            </div>
          </div>
        }
        
        @if (messages().length <= 1) {
             <div class="flex flex-col gap-3 px-8 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto">
                 <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">
                    @if (mode() === 'book') { Deep Mode Actions } 
                    @else if (mode() === 'dictionary') { Quick Lookups } 
                    @else if (mode() === 'uncensored') { Unfiltered Actions }
                    @else { Quick Actions }
                 </div>
                 
                 @if (mode() === 'book') {
                    <button (click)="setInput('Summarize the entire plot arc across all chapters.'); sendMessage()" class="text-left p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all text-sm text-gray-600 bg-brand-50/30 group">
                        <span class="font-medium block mb-0.5 group-hover:text-brand-700 text-gray-800">Analyze Full Plot</span>
                        <span class="text-xs opacity-70">Trace the arc across the whole book.</span>
                    </button>
                    <button (click)="setInput('List all characters and their development.'); sendMessage()" class="text-left p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all text-sm text-gray-600 bg-brand-50/30 group">
                        <span class="font-medium block mb-0.5 group-hover:text-brand-700 text-gray-800">Character Audit</span>
                    </button>
                 } @else if (mode() === 'dictionary') {
                     <button (click)="setInput('Serendipity'); sendMessage()" class="text-left p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all text-sm text-gray-600 bg-gray-50/50 group">
                        <span class="font-medium block mb-0.5 group-hover:text-gray-900 text-gray-800">Define "Serendipity"</span>
                    </button>
                    <button (click)="setInput('Ephemeral'); sendMessage()" class="text-left p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all text-sm text-gray-600 bg-gray-50/50 group">
                        <span class="font-medium block mb-0.5 group-hover:text-gray-900 text-gray-800">Define "Ephemeral"</span>
                    </button>
                 } @else if (mode() === 'uncensored') {
                    <button (click)="setInput('Draft an objective, tension-filled confrontation scene between characters.'); sendMessage()" class="text-left p-4 rounded-xl border border-gray-100 hover:border-slate-300 hover:shadow-sm transition-all text-sm text-gray-600 bg-slate-50/50 group">
                        <span class="font-medium block mb-0.5 group-hover:text-slate-900 text-gray-800">Unfiltered Scene Draft</span>
                        <span class="text-xs opacity-70">Direct narrative execution with zero lecturing.</span>
                    </button>
                    <button (click)="setInput('Provide a candid, objective critique of the character motivations and scene tension.'); sendMessage()" class="text-left p-4 rounded-xl border border-gray-100 hover:border-slate-300 hover:shadow-sm transition-all text-sm text-gray-600 bg-slate-50/50 group">
                        <span class="font-medium block mb-0.5 group-hover:text-slate-900 text-gray-800">Objective Candor Review</span>
                        <span class="text-xs opacity-70">Unbiased critique without tone dilution.</span>
                    </button>
                 } @else {
                    <button (click)="setInput('Summarize this chapter.'); sendMessage()" class="text-left p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all text-sm text-gray-600 bg-gray-50/50 group">
                        <span class="font-medium block mb-0.5 group-hover:text-gray-900 text-gray-800">Summarize Chapter</span>
                        <span class="text-xs opacity-70">Get a quick overview.</span>
                    </button>
                    <button (click)="setInput('Check for tone inconsistencies in this chapter.'); sendMessage()" class="text-left p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all text-sm text-gray-600 bg-gray-50/50 group">
                        <span class="font-medium block mb-0.5 group-hover:text-gray-900 text-gray-800">Critique Tone</span>
                    </button>
                 }
             </div>
        }

        @for (msg of messages(); track $index) {
          @if (msg.role === 'user' || msg.text.length > 0) {
            <div [class]="'flex flex-col group/msg transition-all ' + (msg.role === 'user' ? 'items-end px-6 mb-8 mt-6' : 'w-full mb-2')">
                <div [class]="'text-sm leading-relaxed overflow-hidden ' + 
                (msg.role === 'user' 
                    ? 'bg-gray-100/80 text-gray-800 font-medium rounded-2xl rounded-br-sm px-5 py-3 max-w-[85%]' 
                    : 'bg-transparent text-gray-800 w-full px-8 py-2 relative')">
                @if (msg.role === 'model') {
                    <div class="flex items-center gap-2 mb-4 opacity-50 select-none">
                        <div class="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>
                        </div>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Scribe</span>
                    </div>
                }
                <div class="markdown-body chat-markdown" [innerHTML]="renderMarkdown(msg.text)"></div>
                </div>
                
                @if (msg.role === 'model' && msg.text.length > 0) {
                    <div class="flex flex-wrap gap-2 px-8 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200">
                        <button (click)="insertText(msg.text, $index)" class="text-[10px] text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-full flex items-center gap-1 transition-all">
                             <span class="opacity-70">Insert</span>
                        </button>
                        <button (click)="copyText(msg.text, $index)" class="text-[10px] text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-full flex items-center gap-1 transition-all">
                             <span class="opacity-70">Copy</span>
                        </button>
                    </div>
                }
            </div>
          }
        }
        
        @if (isLoading()) {
          <div class="flex justify-start animate-in fade-in duration-300 w-full mb-6">
             <div class="px-8 py-6 w-full">
               <div class="flex items-center gap-2 mb-4">
                  <div class="w-4 h-4 rounded-full bg-gray-100"></div>
                  <div class="w-16 h-3 bg-gray-100 rounded"></div>
               </div>
               <div class="space-y-4 animate-pulse max-w-xl">
                  <div class="h-2 bg-gray-100 rounded w-full"></div>
                  <div class="h-2 bg-gray-100 rounded w-[90%]"></div>
                  <div class="h-2 bg-gray-100 rounded w-[95%]"></div>
               </div>
             </div>
          </div>
        }
        
        <div class="h-12"></div>
      </div>

      <!-- Input Area -->
      <div class="p-6 bg-white shrink-0 pb-[env(safe-area-inset-bottom)] z-20">
        <div class="relative group">
          <textarea 
            #inputBox
            rows="1"
            [value]="input()" 
            (input)="input.set($any($event.target).value)"
            (keydown.enter)="onEnter($event)"
            [placeholder]="getPlaceholder()"
            class="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-5 pr-12 py-4 text-sm focus:bg-white focus:ring-1 focus:ring-gray-200 focus:border-gray-300 focus:outline-none placeholder-gray-400 transition-all resize-none max-h-32 leading-relaxed"
          ></textarea>
          <button 
            (click)="sendMessage()"
            [disabled]="!input().trim() || isLoading()"
            class="absolute right-3 bottom-3 p-1.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all disabled:opacity-20 disabled:bg-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
      }
    </div>
  `
})
export class ChatComponent implements AfterViewChecked {
  private aiService = inject(AiService);
  blockService = inject(BlockService);
  ragService = inject(RagService);

  @Output() closeChat = new EventEmitter<void>();

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('inputBox') inputBox!: ElementRef<HTMLTextAreaElement>;

  messages = computed(() => {
     return this.blockService.activeSession()?.messages || [];
  });
  
  input = signal('');
  isLoading = signal(false);
  mode = signal<'chapter' | 'book' | 'dictionary' | 'search' | 'uncensored'>('chapter');
  showHistory = signal(false);
  
  actionFeedback = signal<{index: number, type: 'copy' | 'insert'} | null>(null);

  constructor() {
    effect(() => {
       const id = this.blockService.activeSessionId();
       this.showHistory.set(false);
    });
  }

  isBookTooLarge() {
      // Arbitrary limit, but we allow RAG for all sizes now
      return this.blockService.chapters().length > 50; 
  }

  ngAfterViewChecked() {
     this.scrollToBottom();
  }

  scrollToBottom() {
      if (this.scrollContainer && this.isLoading()) {
          const el = this.scrollContainer.nativeElement;
          el.scrollTop = el.scrollHeight;
      }
  }

  toggleHistory() {
      this.showHistory.update(v => !v);
  }

  newChat() {
      this.blockService.createChatSession();
      this.showHistory.set(false);
      setTimeout(() => {
          if (this.inputBox) this.inputBox.nativeElement.focus();
      });
  }

  selectSession(id: string) {
      this.blockService.selectChatSession(id);
      this.toggleHistory();
  }
  
  deleteSession(id: string, e: Event) {
      e.stopPropagation();
      this.blockService.deleteChatSession(id);
  }

  wordCount = computed(() => {
      // Word count of ACTIVE CHAPTER for chat context
      const content = this.blockService.activeChapterContent();
      const text = content.replace(/<[^>]*>/g, ' ');
      return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  });

  setMode(m: 'chapter' | 'book' | 'dictionary' | 'search' | 'uncensored') {
    this.mode.set(m);
  }
  
  setInput(text: string) {
      this.input.set(text);
      if (this.inputBox) this.inputBox.nativeElement.focus();
  }

  getPlaceholder() {
    switch(this.mode()) {
      case 'chapter': return 'Ask about this chapter...';
      case 'book': return 'Ask about the entire book...';
      case 'dictionary': return 'Type a word to define...';
      case 'search': return 'Search the web...';
      case 'uncensored': return 'Direct, unfiltered prompt or question...';
    }
  }

  onEnter(e: KeyboardEvent) {
    if (!e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage() {
    const userMsg = this.input().trim();
    if (!userMsg || this.isLoading()) return;

    const currentMessages = [...this.messages()];
    
    this.blockService.updateActiveSessionMessages([...currentMessages, {role: 'user', text: userMsg}]);

    this.input.set('');
    this.isLoading.set(true);
    
    setTimeout(() => {
         if (this.scrollContainer) this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    });

    try {
      let docContext = '';
      
      if (this.mode() === 'dictionary') {
         // No context, no history, just lookup
         const response = await this.aiService.generateText(userMsg, '', 'dictionary');
         this.blockService.updateActiveSessionMessages([...this.messages(), {role: 'model', text: response}]);
      } else if (this.mode() === 'search') {
         const response = await this.aiService.generateText(userMsg, '', 'search');
         this.blockService.updateActiveSessionMessages([...this.messages(), {role: 'model', text: response}]);
      } else {
         // --- Standard Chat Logic ---
         
         // Select Context based on Mode
         if (this.mode() === 'book') {
            if (this.isBookTooLarge() || this.ragService.isReady()) {
                // Use RAG Retrieval
                const retrieved = await this.ragService.retrieve(userMsg);
                docContext = retrieved || "No relevant context found in book.";
            } else {
                // Fallback to full content if small enough
                const raw = this.blockService.entireBookContent();
                docContext = raw.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n');
            }
         } else {
            // Chapter or Uncensored Mode
            const raw = this.blockService.activeChapterContent();
            docContext = raw.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n');
         }

         const history = currentMessages.map(m => ({
           role: m.role,
           parts: [{text: m.text}]
         }));
         
         this.blockService.updateActiveSessionMessages([...this.messages(), {role: 'model', text: ''}]);
         
         // Determine AI Mode (document uncensored/unfiltered setting applies globally)
         let aiMode: 'doc' | 'think' | 'uncensored' | 'unfiltered' = 'doc';
         if (this.mode() === 'book') aiMode = 'think';
         if (this.mode() === 'uncensored' || this.blockService.isUnfiltered()) aiMode = 'unfiltered';
         
         const stream = this.aiService.chatStream(
            history, 
            userMsg, 
            docContext, 
            aiMode,
            this.blockService.isUnfiltered()
         );

         let lastUpdateTime = 0;
         for await (const chunk of stream) {
            const msgs = [...this.messages()];
            const last = msgs[msgs.length - 1];
            if (last.role === 'model') {
                last.text += chunk;
                const now = Date.now();
                // Throttle signal updates during streaming to 60ms to keep UI fluid and conserve memory
                if (now - lastUpdateTime > 60) {
                    lastUpdateTime = now;
                    this.blockService.updateActiveSessionMessages(msgs);
                }
            }
         }
         // Final flush
         this.blockService.updateActiveSessionMessages(this.messages());
      }
    } catch (e) {
      this.blockService.updateActiveSessionMessages([...this.messages(), {role: 'model', text: 'Sorry, I encountered an error connecting to the AI.'}]);
    } finally {
      this.isLoading.set(false);
      setTimeout(() => {
         if (this.scrollContainer) this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
         if (this.inputBox) this.inputBox.nativeElement.focus();
      }, 100);
    }
  }

  insertText(text: string, index: number) {
    const content = this.blockService.activeChapterContent();
    this.blockService.updateActiveChapterContent(content + `<p>${text}</p>`);
    
    this.actionFeedback.set({index, type: 'insert'});
    setTimeout(() => this.actionFeedback.set(null), 2000);
  }

  copyText(text: string, index: number) {
      navigator.clipboard.writeText(text).then(() => {
          this.actionFeedback.set({index, type: 'copy'});
          setTimeout(() => this.actionFeedback.set(null), 2000);
      });
  }
  
  humanizeText(text: string) {
      this.input.set(`Rewrite this to sound more natural, human, and conversational, avoiding robotic patterns:\n\n${text}`);
      this.sendMessage();
  }

  renderMarkdown(text: string): string {
    try {
      return marked.parse(text, { async: false }) as string;
    } catch (e) {
      return text;
    }
  }
}