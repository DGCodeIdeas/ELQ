import { Injectable, inject } from '@angular/core';
import { CryptoService } from './crypto.service';
import { PrivacyService } from './privacy.service';

export interface Block {
  id: string;
  type: 'paragraph' | 'h1' | 'h2' | 'bullet' | 'code' | 'quote' | 'divider';
  content: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string; // HTML or Markdown content for this specific chapter
  lastModified: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
}

export interface WordCountHistoryPoint {
  timestamp: number;
  wordCount: number;
  chapterTitle?: string;
}

export interface WritingGoals {
  documentTarget: number; // e.g. 5000 words
  dailyTarget: number;    // e.g. 500 words
  wordsWrittenToday: number;
  lastActiveDate: string; // YYYY-MM-DD
  currentStreak: number;
}

export interface CensorshipConfig {
  redactionStyle: 'blackout' | 'blackbar' | 'blur' | 'spoiler' | 'asterisks' | 'redact_pill';
  customBlacklist: string[];
}

export interface Document {
  id: string;
  title: string;
  lastModified: number;
  chapters: Chapter[];
  chatSessions?: ChatSession[];
  wordCountHistory?: WordCountHistoryPoint[];
  goals?: WritingGoals;
  isUncensored?: boolean;
  censorshipConfig?: CensorshipConfig;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private crypto = inject(CryptoService);
  private privacy = inject(PrivacyService);

  private dbName = 'EloquiDB';
  private storeName = 'documents';
  private version = 4;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  async saveDocument(doc: Document): Promise<void> {
    if (!this.db) await this.initDB();

    // Prepare encrypted chapters if encryption enabled
    const encryptedChapters: Chapter[] = await Promise.all(
      doc.chapters.map(async (ch) => ({
        ...ch,
        content: await this.crypto.encryptText(ch.content)
      }))
    );

    const docToSave: Document = {
      id: doc.id,
      title: doc.title,
      lastModified: doc.lastModified,
      chapters: encryptedChapters,
      chatSessions: doc.chatSessions,
      wordCountHistory: doc.wordCountHistory || [],
      isUncensored: doc.isUncensored ?? false,
      censorshipConfig: doc.censorshipConfig || {
        redactionStyle: 'spoiler',
        customBlacklist: []
      },
      goals: doc.goals || {
        documentTarget: 3000,
        dailyTarget: 500,
        wordsWrittenToday: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
        currentStreak: 1
      }
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const request = store.put(docToSave);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.privacy.logEvent({
          category: 'document',
          action: 'Document Saved',
          details: `Document "${doc.title}" saved. Encryption: ${this.crypto.isAtRestEncryptionEnabled() ? 'AES-GCM-256' : 'Plaintext'}`,
          userEmail: 'current_user',
          status: this.crypto.isAtRestEncryptionEnabled() ? 'encrypted' : 'processed'
        });
        resolve();
      };
    });
  }

  async getDocument(id: string): Promise<Document | undefined> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        const doc = request.result;
        if (doc) {
          // Decrypt chapters if encrypted
          if (doc.chapters && Array.isArray(doc.chapters)) {
            doc.chapters = await Promise.all(
              doc.chapters.map(async (ch: Chapter) => ({
                ...ch,
                content: await this.crypto.decryptText(ch.content)
              }))
            );
          }

          // Legacy migration check
          if (!doc.chapters || doc.chapters.length === 0) {
            doc.chapters = [{
              id: crypto.randomUUID(),
              title: 'Chapter 1',
              content: '<p>Start writing here...</p>',
              lastModified: Date.now()
            }];
          }

          // Initialize wordCountHistory if missing
          if (!doc.wordCountHistory) {
            doc.wordCountHistory = [];
          }

          if (!doc.goals) {
            doc.goals = {
              documentTarget: 3000,
              dailyTarget: 500,
              wordsWrittenToday: 0,
              lastActiveDate: new Date().toISOString().split('T')[0],
              currentStreak: 1
            };
          }
        }
        resolve(doc);
      };
    });
  }

  async getAllDocuments(): Promise<Document[]> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        const docs = request.result || [];
        // Lightly sanitize without full chapter decryption on list load
        for (const doc of docs) {
          if (!doc.chapters || doc.chapters.length === 0) {
            doc.chapters = [{
              id: crypto.randomUUID(),
              title: 'Chapter 1',
              content: '<p>Start writing here...</p>',
              lastModified: Date.now()
            }];
          }
        }
        resolve(docs);
      };
    });
  }

  async deleteDocument(id: string): Promise<void> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.privacy.logEvent({
          category: 'document',
          action: 'Document Purged',
          details: `Document ID: ${id} deleted from local IndexedDB`,
          userEmail: 'current_user',
          status: 'processed'
        });
        resolve();
      };
    });
  }
}
