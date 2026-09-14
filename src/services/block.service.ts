import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { StorageService, Document, Chapter, ChatMessage, ChatSession, WordCountHistoryPoint, WritingGoals, Block, CensorshipConfig } from './storage.service';
import { RagService } from './rag.service';
import JSZip from 'jszip';

export const DEFAULT_SENSITIVE_TERMS = [
  'fuck', 'fucking', 'fucked', 'fucker',
  'shit', 'shitty', 'bullshit',
  'bitch', 'bitches',
  'asshole', 'ass', 'bastard',
  'dick', 'pussy', 'cock', 'cunt',
  'damn', 'dammit', 'hell',
  'whore', 'slut'
];

export function htmlToBlocks(html: string): Block[] {
  if (!html || !html.trim()) {
    return [{ id: crypto.randomUUID(), type: 'paragraph', content: '' }];
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blocks: Block[] = [];
    const children = Array.from(doc.body.children);

    if (children.length === 0) {
      const text = doc.body.textContent || '';
      return [{ id: crypto.randomUUID(), type: 'paragraph', content: text }];
    }

    for (const child of children) {
      const tag = child.tagName.toLowerCase();
      const text = (child.textContent || '').trim();
      if (tag === 'h1') {
        blocks.push({ id: crypto.randomUUID(), type: 'h1', content: text });
      } else if (tag === 'h2') {
        blocks.push({ id: crypto.randomUUID(), type: 'h2', content: text });
      } else if (tag === 'ul') {
        const lis = Array.from(child.querySelectorAll('li'));
        if (lis.length > 0) {
          lis.forEach(li => {
            blocks.push({ id: crypto.randomUUID(), type: 'bullet', content: (li.textContent || '').trim() });
          });
        } else {
          blocks.push({ id: crypto.randomUUID(), type: 'bullet', content: text });
        }
      } else if (tag === 'pre' || tag === 'code') {
        blocks.push({ id: crypto.randomUUID(), type: 'code', content: text });
      } else if (tag === 'blockquote') {
        blocks.push({ id: crypto.randomUUID(), type: 'quote', content: text });
      } else if (tag === 'hr') {
        blocks.push({ id: crypto.randomUUID(), type: 'divider', content: '' });
      } else {
        blocks.push({ id: crypto.randomUUID(), type: 'paragraph', content: text });
      }
    }

    return blocks.length > 0 ? blocks : [{ id: crypto.randomUUID(), type: 'paragraph', content: '' }];
  } catch {
    return [{ id: crypto.randomUUID(), type: 'paragraph', content: html.replace(/<[^>]*>/g, '') }];
  }
}

export function blocksToHtml(blocks: Block[]): string {
  if (!blocks || blocks.length === 0) return '<p></p>';
  return blocks.map(b => {
    switch (b.type) {
      case 'h1': return `<h1>${b.content}</h1>`;
      case 'h2': return `<h2>${b.content}</h2>`;
      case 'bullet': return `<ul><li>${b.content}</li></ul>`;
      case 'code': return `<pre><code>${b.content}</code></pre>`;
      case 'quote': return `<blockquote>${b.content}</blockquote>`;
      case 'divider': return `<hr/>`;
      default: return `<p>${b.content}</p>`;
    }
  }).join('');
}

@Injectable({
  providedIn: 'root'
})
export class BlockService {
  private storage = inject(StorageService);
  ragService = inject(RagService);

  // State
  readonly isLoading = signal(true);
  readonly documents = signal<Document[]>([]);
  readonly currentDocId = signal<string | null>(null);
  readonly currentDoc = signal<Document | null>(null);
  
  // Chapter State
  readonly activeChapterId = signal<string | null>(null);
  
  // Chat State
  readonly activeSessionId = signal<string | null>(null);

  readonly saveStatus = signal<'saved' | 'saving' | 'error'>('saved');
  readonly lastSavedAt = signal<Date | null>(null);

  private saveTimer: any = null;
  private ragTimer: any = null;
  private lastIndexedSignature = '';
  
  // Derived state for the editor
  readonly chapters = computed(() => this.currentDoc()?.chapters || []);
  
  readonly activeChapter = computed(() => {
      const chapters = this.chapters();
      const id = this.activeChapterId();
      return chapters.find(c => c.id === id) || null;
  });

  readonly activeChapterIndex = computed(() => {
    const chapters = this.chapters();
    const id = this.activeChapterId();
    const idx = chapters.findIndex(c => c.id === id);
    return idx >= 0 ? idx : 0;
  });

  readonly activeChapterContent = computed(() => this.activeChapter()?.content || '');
  readonly activeChapterTitle = computed(() => this.activeChapter()?.title || 'Untitled');
  
  readonly docTitle = computed(() => this.currentDoc()?.title || 'Untitled');
  
  // Stats (Aggregated across all chapters, memory-efficient)
  readonly wordCount = computed(() => {
     const chapters = this.chapters();
     let count = 0;
     for (const c of chapters) {
         if (!c.content) continue;
         // Fast word count without heavy regex allocations
         const clean = c.content.replace(/<[^>]*>/g, ' ');
         const words = clean.trim().split(/\s+/);
         if (words.length === 1 && words[0] === '') continue;
         count += words.length;
     }
     return count;
  });

  // Alias for templates/components calling totalWordCount
  readonly totalWordCount = computed(() => this.wordCount());
  
  // Entire Book Content (Fallback for small books)
  readonly entireBookContent = computed(() => {
      return this.chapters().map(c => `--- CHAPTER: ${c.title} ---\n${c.content}`).join('\n\n');
  });

  readonly readingTime = computed(() => {
      return Math.ceil(this.wordCount() / 200); 
  });

  readonly speakingTime = computed(() => {
      return Math.ceil(this.wordCount() / 130);
  });

  // Writing Productivity Goals
  readonly documentTarget = computed(() => this.currentDoc()?.goals?.documentTarget || 3000);
  readonly dailyTarget = computed(() => this.currentDoc()?.goals?.dailyTarget || 500);
  readonly wordsWrittenToday = computed(() => this.currentDoc()?.goals?.wordsWrittenToday || 0);
  readonly currentStreak = computed(() => this.currentDoc()?.goals?.currentStreak || 1);

  readonly documentProgress = computed(() => {
    const target = this.documentTarget() || 1;
    return Math.min(100, Math.round((this.wordCount() / target) * 100));
  });

  readonly dailyProgress = computed(() => {
    const target = this.dailyTarget() || 1;
    return Math.min(100, Math.round((this.wordsWrittenToday() / target) * 100));
  });

  // --- Document Filtering / Unfiltered Processing Signals (Neutral Parity) ---
  readonly isUncensored = computed(() => this.currentDoc()?.isUncensored ?? false);
  readonly isUnfiltered = computed(() => this.isUncensored());
  readonly processingMode = computed<'filtered' | 'unfiltered'>(() => this.isUnfiltered() ? 'unfiltered' : 'filtered');
  readonly censorshipConfig = computed<CensorshipConfig>(() => this.currentDoc()?.censorshipConfig || {
    redactionStyle: 'spoiler',
    customBlacklist: []
  });
  readonly redactionStyle = computed(() => this.censorshipConfig().redactionStyle || 'spoiler');
  readonly customBlacklist = computed(() => this.censorshipConfig().customBlacklist || []);

  readonly allSensitiveTerms = computed(() => {
    const custom = this.customBlacklist() || [];
    const set = new Set([...DEFAULT_SENSITIVE_TERMS, ...custom.map(t => t.toLowerCase().trim())]);
    return Array.from(set).filter(Boolean);
  });

  readonly activeChapterCensorshipReport = computed(() => {
    const content = this.activeChapterContent();
    if (!content) return { count: 0, terms: [] as string[] };
    return this.detectSensitiveTerms(content);
  });

  readonly sensitiveTermsCount = computed(() => this.activeChapterCensorshipReport().count);

  readonly activeChapterRenderedHtml = computed(() => {
    return this.redactHtml(this.activeChapterContent());
  });

  readonly documentCensorshipReport = computed(() => {
    const chapters = this.chapters();
    let count = 0;
    const termSet = new Set<string>();
    for (const c of chapters) {
      if (!c.content) continue;
      const res = this.detectSensitiveTerms(c.content);
      count += res.count;
      res.terms.forEach(t => termSet.add(t));
    }
    return { count, terms: Array.from(termSet) };
  });

  readonly wordCountHistory = computed(() => {
    const history = this.currentDoc()?.wordCountHistory || [];
    if (history.length === 0) {
      // Generate initial baseline points if empty so line chart is immediately visible
      const now = Date.now();
      const current = this.wordCount();
      return [
        { timestamp: now - 3600000 * 24 * 3, wordCount: Math.max(0, Math.round(current * 0.35)) },
        { timestamp: now - 3600000 * 24 * 2, wordCount: Math.max(0, Math.round(current * 0.6)) },
        { timestamp: now - 3600000 * 24, wordCount: Math.max(0, Math.round(current * 0.85)) },
        { timestamp: now, wordCount: current }
      ];
    }
    return history;
  });
  
  // Derived state for chat
  readonly sessions = computed(() => this.currentDoc()?.chatSessions || []);
  readonly activeSession = computed(() => {
     const s = this.sessions();
     const id = this.activeSessionId();
     return s.find(session => session.id === id) || null;
  });

  constructor() {
    this.loadDocuments();
    
    // Debounced Auto-save effect (prevents locking up memory & IndexedDB on fast typing/pasting/streaming)
    effect(() => {
      const doc = this.currentDoc();
      if (doc) {
        this.saveStatus.set('saving');
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
          this.storage.saveDocument(doc).then(() => {
            this.saveStatus.set('saved');
            this.lastSavedAt.set(new Date());
          }).catch(err => {
            console.error('Save failed', err);
            this.saveStatus.set('error');
          });
        }, 1200);
      }
    });

    // Throttled Idle RAG Indexing Trigger (waits 5s after user stops editing, only if content changed)
    effect(() => {
        const doc = this.currentDoc();
        if (doc && doc.chapters && doc.chapters.length > 0) {
            // Compute a light signature of chapter lengths and titles
            const signature = doc.chapters.map(c => `${c.id}:${c.title}:${c.content.length}`).join('|');
            if (signature !== this.lastIndexedSignature) {
                if (this.ragTimer) clearTimeout(this.ragTimer);
                this.ragTimer = setTimeout(() => {
                    this.lastIndexedSignature = signature;
                    this.ragService.indexChapters(doc.chapters);
                }, 5000);
            }
        }
    });
  }

  async loadDocuments() {
    this.isLoading.set(true);
    try {
        const docs = await this.storage.getAllDocuments();
        this.documents.set(docs);
        if (docs.length > 0 && !this.currentDocId()) {
          this.selectDocument(docs[0].id);
        } else if (docs.length === 0) {
          await this.createNewDocument();
        }
    } finally {
        setTimeout(() => {
            this.isLoading.set(false);
        }, 500);
    }
  }

  async createNewDocument() {
    const defaultSession: ChatSession = {
        id: crypto.randomUUID(),
        title: 'New Chat',
        messages: [{role: 'model', text: 'I\'m ready to help with your book.'}],
        timestamp: Date.now()
    };

    const firstChapter: Chapter = {
        id: crypto.randomUUID(),
        title: 'Chapter 1',
        content: '<h1>Chapter 1</h1><p>Start writing here...</p>',
        lastModified: Date.now()
    };

    const newDoc: Document = {
      id: crypto.randomUUID(),
      title: 'Untitled Book',
      lastModified: Date.now(),
      chapters: [firstChapter],
      chatSessions: [defaultSession],
      isUncensored: false,
      censorshipConfig: {
        redactionStyle: 'spoiler',
        customBlacklist: []
      }
    };
    
    await this.storage.saveDocument(newDoc);
    this.documents.update(docs => [...docs, newDoc]);
    this.selectDocument(newDoc.id);
  }

  async createDocumentFromImport(title: string, chapters: Chapter[]) {
    const defaultSession: ChatSession = {
        id: crypto.randomUUID(),
        title: 'New Chat',
        messages: [{role: 'model', text: 'I\'m ready to help with your book.'}],
        timestamp: Date.now()
    };

    const newDoc: Document = {
      id: crypto.randomUUID(),
      title: title,
      lastModified: Date.now(),
      chapters: chapters,
      chatSessions: [defaultSession],
      isUncensored: false,
      censorshipConfig: {
        redactionStyle: 'spoiler',
        customBlacklist: []
      }
    };
    
    await this.storage.saveDocument(newDoc);
    this.documents.update(docs => [...docs, newDoc]);
    this.selectDocument(newDoc.id);
  }

  async deleteDocument(id: string) {
    await this.storage.deleteDocument(id);
    this.documents.update(docs => docs.filter(d => d.id !== id));
    
    if (this.currentDocId() === id) {
       this.currentDoc.set(null);
       this.currentDocId.set(null);
       this.activeSessionId.set(null);
       this.activeChapterId.set(null);
       const remaining = this.documents();
       if (remaining.length > 0) {
           this.selectDocument(remaining[0].id);
       } else {
           this.createNewDocument();
       }
    }
  }

  selectDocument(id: string) {
    this.currentDocId.set(id);
    this.storage.getDocument(id).then(doc => {
      if (doc) {
          if (!doc.chatSessions) doc.chatSessions = [];
          
          this.currentDoc.set(doc);
          
          // Select first chapter
          if (doc.chapters && doc.chapters.length > 0) {
              this.activeChapterId.set(doc.chapters[0].id);
          } else {
               // Should not happen due to migration, but safe fallback
               this.addChapter();
          }

          if (doc.chatSessions && doc.chatSessions.length > 0) {
              this.activeSessionId.set(doc.chatSessions[0].id);
          } else {
              this.createChatSession();
          }
      }
    });
  }

  updateTitle(newTitle: string) {
    this.currentDoc.update(doc => doc ? { ...doc, title: newTitle, lastModified: Date.now() } : null);
  }

  // --- Censorship & Redaction Methods ---

  detectSensitiveTerms(text: string): { count: number; terms: string[] } {
    if (!text) return { count: 0, terms: [] };
    const plainText = text.replace(/<[^>]*>/g, ' ');
    const terms = this.allSensitiveTerms();
    let count = 0;
    const detected = new Set<string>();

    for (const term of terms) {
      if (!term.trim()) continue;
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      const matches = plainText.match(regex);
      if (matches && matches.length > 0) {
        count += matches.length;
        detected.add(term.toLowerCase());
      }
    }
    return { count, terms: Array.from(detected) };
  }

  redactHtml(html: string): string {
    if (!html) return '';
    // Uncensored Mode: Return full raw creative text without any redactions
    if (this.isUncensored()) {
      return html;
    }

    const terms = this.allSensitiveTerms();
    if (terms.length === 0) return html;

    const style = this.redactionStyle();
    const escapedTerms = terms
      .map(t => t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean)
      .join('|');
    
    if (!escapedTerms) return html;
    const regex = new RegExp(`\\b(${escapedTerms})\\b`, 'gi');

    return html.replace(/(>|^)([^<]+)(<|$)/g, (match, prefix, text, suffix) => {
      const replacedText = text.replace(regex, (word: string) => {
        if (style === 'blackbar' || style === 'blackout') {
          return `<span class="censored-blackbar" title="Censored term: Click to reveal" onclick="this.classList.toggle('unredacted')">${'█'.repeat(Math.max(4, word.length))}</span>`;
        } else if (style === 'blur') {
          return `<span class="censored-blur" title="Censored term: Click to reveal" onclick="this.classList.toggle('unredacted')">${word}</span>`;
        } else if (style === 'asterisks') {
          return `<span class="censored-spoiler" title="Censored term: Click to reveal" onclick="this.classList.toggle('unredacted')">${'*'.repeat(Math.max(3, word.length))}</span>`;
        } else if (style === 'redact_pill') {
          return `<span class="censored-pill" title="Censored term: Click to reveal" onclick="this.classList.toggle('unredacted')">[REDACTED]</span>`;
        } else {
          return `<span class="censored-spoiler" title="Censored term: Click to reveal" onclick="this.classList.toggle('unredacted')">${word}</span>`;
        }
      });
      return prefix + replacedText + suffix;
    });
  }

  toggleDocumentCensorship(forced?: boolean) {
    this.currentDoc.update(doc => {
      if (!doc) return null;
      const next = forced !== undefined ? forced : !doc.isUncensored;
      return { ...doc, isUncensored: next, lastModified: Date.now() };
    });
  }

  toggleCensorshipMode(forced?: boolean) {
    this.toggleDocumentCensorship(forced);
  }

  toggleProcessingMode(forced?: boolean) {
    this.toggleDocumentCensorship(forced);
  }

  setProcessingMode(mode: 'filtered' | 'unfiltered') {
    this.toggleDocumentCensorship(mode === 'unfiltered');
  }

  setRedactionStyle(style: 'blackout' | 'blackbar' | 'blur' | 'spoiler' | 'asterisks' | 'redact_pill') {
    this.currentDoc.update(doc => {
      if (!doc) return null;
      const config = doc.censorshipConfig || { redactionStyle: 'spoiler', customBlacklist: [] };
      return {
        ...doc,
        censorshipConfig: { ...config, redactionStyle: style },
        lastModified: Date.now()
      };
    });
  }

  setCensorshipRedactionStyle(style: 'blackout' | 'blackbar' | 'blur' | 'spoiler' | 'asterisks' | 'redact_pill') {
    this.setRedactionStyle(style);
  }

  addCustomBlacklistTerm(term: string) {
    const clean = term.trim().toLowerCase();
    if (!clean) return;
    this.currentDoc.update(doc => {
      if (!doc) return null;
      const config = doc.censorshipConfig || { redactionStyle: 'spoiler', customBlacklist: [] };
      const currentList = config.customBlacklist || [];
      if (currentList.includes(clean)) return doc;
      return {
        ...doc,
        censorshipConfig: {
          ...config,
          customBlacklist: [...currentList, clean]
        },
        lastModified: Date.now()
      };
    });
  }

  removeCustomBlacklistTerm(term: string) {
    const clean = term.trim().toLowerCase();
    this.currentDoc.update(doc => {
      if (!doc) return null;
      const config = doc.censorshipConfig || { redactionStyle: 'spoiler', customBlacklist: [] };
      return {
        ...doc,
        censorshipConfig: {
          ...config,
          customBlacklist: (config.customBlacklist || []).filter(t => t.toLowerCase() !== clean)
        },
        lastModified: Date.now()
      };
    });
  }

  cleanSanitizeActiveChapter() {
    const content = this.activeChapterContent();
    if (!content) return;
    const terms = this.allSensitiveTerms();
    if (terms.length === 0) return;

    const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`\\b(${escapedTerms})\\b`, 'gi');
    const cleaned = content.replace(/(>|^)([^<]+)(<|$)/g, (match, prefix, text, suffix) => {
      const replacedText = text.replace(regex, (word: string) => `[${word[0]}***]`);
      return prefix + replacedText + suffix;
    });
    this.updateActiveChapterContent(cleaned);
  }

  cleanSanitizeWholeDocument() {
    this.currentDoc.update(doc => {
      if (!doc) return null;
      const terms = this.allSensitiveTerms();
      if (terms.length === 0) return doc;
      const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const regex = new RegExp(`\\b(${escapedTerms})\\b`, 'gi');

      const cleanedChapters = doc.chapters.map(c => {
        const cleaned = c.content.replace(/(>|^)([^<]+)(<|$)/g, (match, prefix, text, suffix) => {
          const replacedText = text.replace(regex, (word: string) => `[${word[0]}***]`);
          return prefix + replacedText + suffix;
        });
        return { ...c, content: cleaned, lastModified: Date.now() };
      });

      return { ...doc, chapters: cleanedChapters, lastModified: Date.now() };
    });
  }

  updateGoals(documentTarget: number, dailyTarget: number) {
    this.currentDoc.update(doc => {
      if (!doc) return null;
      const goals: WritingGoals = {
        ...(doc.goals || {
          wordsWrittenToday: 0,
          lastActiveDate: new Date().toISOString().split('T')[0],
          currentStreak: 1
        }),
        documentTarget,
        dailyTarget
      };
      return { ...doc, goals, lastModified: Date.now() };
    });
  }

  recordWordCountSnapshot() {
    this.currentDoc.update(doc => {
      if (!doc) return null;
      const currentCount = this.wordCount();
      const history = [...(doc.wordCountHistory || [])];
      
      const newPoint: WordCountHistoryPoint = {
        timestamp: Date.now(),
        wordCount: currentCount,
        chapterTitle: this.activeChapterTitle()
      };
      
      const updatedHistory = [...history, newPoint].slice(-30);
      return { ...doc, wordCountHistory: updatedHistory, lastModified: Date.now() };
    });
  }

  // --- Chapter Management ---

  selectChapter(id: string) {
      this.activeChapterId.set(id);
  }
  
  selectNextChapter() {
      const chapters = this.chapters();
      const currentId = this.activeChapterId();
      const idx = chapters.findIndex(c => c.id === currentId);
      if (idx !== -1 && idx < chapters.length - 1) {
          this.selectChapter(chapters[idx + 1].id);
      }
  }

  selectPrevChapter() {
      const chapters = this.chapters();
      const currentId = this.activeChapterId();
      const idx = chapters.findIndex(c => c.id === currentId);
      if (idx > 0) {
          this.selectChapter(chapters[idx - 1].id);
      }
  }

  addChapter() {
      const newChapter: Chapter = {
          id: crypto.randomUUID(),
          title: `Chapter ${this.chapters().length + 1}`,
          content: `<p>Start writing chapter ${this.chapters().length + 1}...</p>`,
          lastModified: Date.now()
      };
      
      this.currentDoc.update(doc => {
          if (!doc) return null;
          return { ...doc, chapters: [...doc.chapters, newChapter] };
      });
      this.activeChapterId.set(newChapter.id);
  }

  updateActiveChapterContent(content: string) {
      const id = this.activeChapterId();
      if (!id) return;

      this.currentDoc.update(doc => {
          if (!doc) return null;
          const newChapters = doc.chapters.map(c => {
              if (c.id === id) {
                  // Try to extract title from first h1/h2
                  let title = c.title;
                  // Simple check if content changed significantly enough to re-parse title? 
                  // Maybe too expensive. Let's just keep title manual or updated on specific events.
                  // For now, keep content sync.
                  return { ...c, content, lastModified: Date.now() };
              }
              return c;
          });
          return { ...doc, chapters: newChapters, lastModified: Date.now() };
      });
  }
  
  updateActiveChapterTitle(title: string) {
      const id = this.activeChapterId();
      if (!id) return;
      this.currentDoc.update(doc => {
          if (!doc) return null;
          const newChapters = doc.chapters.map(c => c.id === id ? { ...c, title } : c);
          return { ...doc, chapters: newChapters };
      });
  }

  // --- Chat ---

  createChatSession() {
      const doc = this.currentDoc();
      if (!doc) return;

      const newSession: ChatSession = {
          id: crypto.randomUUID(),
          title: 'New Chat',
          messages: [{role: 'model', text: 'How can I help you with this document today?'}],
          timestamp: Date.now()
      };

      this.currentDoc.update(d => {
          if (!d) return null;
          return { ...d, chatSessions: [newSession, ...(d.chatSessions || [])] };
      });
      this.activeSessionId.set(newSession.id);
  }

  selectChatSession(sessionId: string) {
      this.activeSessionId.set(sessionId);
  }

  deleteChatSession(sessionId: string) {
      const doc = this.currentDoc();
      if (!doc) return;
      
      this.currentDoc.update(d => {
          if (!d) return null;
          const newSessions = (d.chatSessions || []).filter(s => s.id !== sessionId);
          return { ...d, chatSessions: newSessions };
      });
      
      if (this.activeSessionId() === sessionId) {
          const sessions = this.sessions();
          if (sessions.length > 0) {
              this.activeSessionId.set(sessions[0].id);
          } else {
              this.createChatSession(); 
          }
      }
  }

  updateActiveSessionMessages(messages: ChatMessage[]) {
      const sessionId = this.activeSessionId();
      if (!sessionId) return;
      
      this.currentDoc.update(d => {
          if (!d) return null;
          const sessions = [...(d.chatSessions || [])];
          const index = sessions.findIndex(s => s.id === sessionId);
          if (index !== -1) {
              sessions[index] = { ...sessions[index], messages, timestamp: Date.now() };
          }
          return { ...d, chatSessions: sessions };
      });
  }

  // --- Export ---
  
  async downloadDocument(format: 'html' | 'txt' | 'markdown' | 'json' | 'epub') {
     const doc = this.currentDoc();
     if (!doc) return;

     if (format === 'epub') {
         await this.exportEpub(doc);
         return;
     }
     
     // Join all chapters for other formats
     let fullContent = doc.chapters.map(c => c.content).join('\n\n<hr class="chapter-break" />\n\n');
     
     if (format === 'txt') {
         const div = document.createElement('div');
         div.innerHTML = fullContent;
         fullContent = div.textContent || '';
     } else if (format === 'markdown') {
        fullContent = fullContent
           .replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n')
           .replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n')
           .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
           .replace(/<[^>]*>/g, '');
     }

     const mime = format === 'json' ? 'application/json' : (format === 'txt' ? 'text/plain' : 'text/html');
     const ext = format === 'markdown' ? 'md' : format;
     
     const finalData = format === 'json' ? JSON.stringify(doc, null, 2) : fullContent;

     const blob = new Blob([finalData], { type: mime });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `${(doc.title || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${ext}`;
     a.click();
     URL.revokeObjectURL(url);
  }

  private async exportEpub(doc: Document) {
      const zip = new JSZip();
      
      // 1. mimetype
      zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
      
      // 2. META-INF
      zip.file("META-INF/container.xml", `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   <rootfiles>
      <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
   </rootfiles>
</container>`);

      // 3. Content
      let manifest = '';
      let spine = '';
      let tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${doc.id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${doc.title || 'Untitled'}</text></docTitle>
  <navMap>`;

      doc.chapters.forEach((chapter, i) => {
          const filename = `chapter${i+1}.xhtml`;
          const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${chapter.title}</title>
  <style>
    body { font-family: serif; line-height: 1.6; margin: 2em; }
    h1 { text-align: center; margin-bottom: 2em; }
  </style>
</head>
<body>
  ${chapter.content}
</body>
</html>`;
          
          zip.file(`OEBPS/${filename}`, xhtml);
          
          manifest += `<item id="ch${i+1}" href="${filename}" media-type="application/xhtml+xml"/>\n`;
          spine += `<itemref idref="ch${i+1}"/>\n`;
          
          tocNcx += `
    <navPoint id="navPoint-${i+1}" playOrder="${i+1}">
      <navLabel><text>${chapter.title}</text></navLabel>
      <content src="${filename}"/>
    </navPoint>`;
      });

      tocNcx += `\n  </navMap>\n</ncx>`;
      zip.file("OEBPS/toc.ncx", tocNcx);

      const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${doc.title || 'Untitled'}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">${doc.id}</dc:identifier>
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
      a.download = `${(doc.title || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.epub`;
      a.click();
      URL.revokeObjectURL(url);
  }
}