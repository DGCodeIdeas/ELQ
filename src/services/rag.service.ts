import { Injectable, inject, signal } from '@angular/core';
import { AiService } from './ai.service';
import { Chapter } from './storage.service';

export interface Chunk {
  id: string;
  chapterId: string;
  chapterTitle: string;
  content: string;
  vector: number[];
}

@Injectable({
  providedIn: 'root'
})
export class RagService {
  private aiService = inject(AiService);

  // In-memory Vector Store
  private chunks: Chunk[] = [];
  
  // State
  readonly isIndexing = signal(false);
  readonly progress = signal(0); // 0 to 100
  readonly isReady = signal(false);

  async indexChapters(chapters: Chapter[]) {
    if (this.isIndexing()) return;
    this.isIndexing.set(true);
    this.progress.set(0);
    this.chunks = []; // Reset store

    try {
      const allChunks: {chapterId: string, chapterTitle: string, content: string}[] = [];

      // 1. Chunking (capped for performance and memory protection)
      const MAX_TOTAL_CHUNKS = 50;
      for (const chapter of chapters) {
        if (allChunks.length >= MAX_TOTAL_CHUNKS) break;
        const text = chapter.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text) continue;

        // Split roughly by 500 words with overlap
        const words = text.split(' ');
        const chunkSize = 500;
        const overlap = 50;
        
        for (let i = 0; i < words.length && allChunks.length < MAX_TOTAL_CHUNKS; i += (chunkSize - overlap)) {
          const chunkText = words.slice(i, i + chunkSize).join(' ');
          allChunks.push({
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            content: chunkText
          });
        }
      }

      if (allChunks.length === 0) {
        this.isReady.set(true);
        return;
      }

      // 2. Embeddings (Batch Processing with cooperative yielding)
      const batchSize = 5; // Smaller batch size to prevent network saturation
      const totalBatches = Math.ceil(allChunks.length / batchSize);
      
      for (let i = 0; i < totalBatches; i++) {
         const start = i * batchSize;
         const end = start + batchSize;
         const batch = allChunks.slice(start, end);
         
         const vectors = await this.aiService.getBatchEmbeddings(batch.map(c => c.content));
         
         batch.forEach((c, idx) => {
             if (vectors[idx] && vectors[idx].length > 0) {
                 this.chunks.push({
                     id: crypto.randomUUID(),
                     ...c,
                     vector: vectors[idx]
                 });
             }
         });
         
         this.progress.set(Math.round(((i + 1) / totalBatches) * 100));
         // Yield to main thread
         await new Promise(resolve => setTimeout(resolve, 25));
      }

      this.isReady.set(true);
      console.log(`RAG Indexing complete. ${this.chunks.length} chunks indexed.`);
    } catch (e) {
      console.error('RAG Indexing failed', e);
    } finally {
      this.isIndexing.set(false);
    }
  }

  async retrieve(query: string, topK = 5): Promise<string> {
    if (this.chunks.length === 0) return '';
    
    // 1. Embed Query
    const queryVector = await this.aiService.getEmbedding(query);
    if (!queryVector || queryVector.length === 0) {
      // Fallback to real BM25 / TF-IDF keyword relevance retrieval
      return this.bm25Retrieve(query, topK);
    }

    // 2. Cosine Similarity Search
    const scored = this.chunks.map(chunk => {
       const score = this.cosineSimilarity(queryVector, chunk.vector);
       return { ...chunk, score };
    });

    // 3. Sort and Return
    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, topK);
    
    // Format for context
    return topChunks.map(c => `[From ${c.chapterTitle}]:\n${c.content}`).join('\n\n---\n\n');
  }

  private bm25Retrieve(query: string, topK = 5): string {
    if (this.chunks.length === 0) return '';
    const queryTerms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) return '';

    const scored = this.chunks.map(chunk => {
      const text = chunk.content.toLowerCase();
      let score = 0;
      for (const term of queryTerms) {
        // Count term frequency
        const matches = text.split(term).length - 1;
        if (matches > 0) {
          score += (matches / (matches + 1.5)) * (term.length > 4 ? 2.0 : 1.0);
        }
      }
      return { ...chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter(s => s.score > 0).slice(0, topK);
    if (top.length === 0) return '';

    return top.map(c => `[From ${c.chapterTitle}]:\n${c.content}`).join('\n\n---\n\n');
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}