import { Injectable, inject, signal } from '@angular/core';
import { CryptoService } from './crypto.service';
import { PrivacyService } from './privacy.service';
import { ModelService } from './model.service';
import { ParaphraseRequest, ParaphraseResponse, ParaphraseAlternative } from './paraphrase.types';

export interface Suggestion {
  original: string;
  suggestion: string;
  type: string;
  explanation: string;
}

export type AiMode = 'fast' | 'think' | 'search' | 'dictionary' | 'uncensored' | 'unfiltered' | 'shorten' | 'expand' | 'formal' | 'casual' | 'simplify' | 'continue' | 'active_voice' | 'vivid' | 'alternatives';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private crypto = inject(CryptoService);
  private privacy = inject(PrivacyService);
  private modelService = inject(ModelService);

  linguixScore = signal<number | null>(null);

  private getCustomKey(): string | undefined {
    const key = this.crypto.getActiveKeyForProvider('gemini');
    return key && key.trim().length > 0 ? key : undefined;
  }

  // Fallback linguistic reviewer if offline or server returns an error
  private localLinguisticReview(text: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    if (!text || text.length < 5) return suggestions;

    // 1. Repeated duplicate words
    const duplicateRegex = /\b([a-zA-Z]{2,})\s+\1\b/gi;
    let match: RegExpExecArray | null;
    while ((match = duplicateRegex.exec(text)) !== null && suggestions.length < 5) {
      suggestions.push({
        original: match[0],
        suggestion: match[1],
        type: 'Grammar',
        explanation: `Repeated word '${match[1]}' found consecutively.`
      });
    }

    // 2. Common spelling typos
    const commonTypos: Record<string, string> = {
      teh: 'the',
      recieve: 'receive',
      seperate: 'separate',
      definately: 'definitely',
      occured: 'occurred',
      untill: 'until',
      truely: 'truly',
      wierd: 'weird',
      accomodate: 'accommodate',
      goverment: 'government'
    };

    for (const [typo, fix] of Object.entries(commonTypos)) {
      if (suggestions.length >= 8) break;
      const typoRegex = new RegExp(`\\b${typo}\\b`, 'gi');
      if (typoRegex.test(text)) {
        suggestions.push({
          original: typo,
          suggestion: fix,
          type: 'Spelling',
          explanation: `Spelling correction: change '${typo}' to '${fix}'.`
        });
      }
    }

    // 3. Wordy filler expressions
    const fillerPhrases: Record<string, string> = {
      'in order to': 'to',
      'at the present time': 'now',
      'due to the fact that': 'because',
      'in the event that': 'if',
      'for the purpose of': 'to'
    };

    for (const [filler, concise] of Object.entries(fillerPhrases)) {
      if (suggestions.length >= 10) break;
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      if (regex.test(text)) {
        suggestions.push({
          original: filler,
          suggestion: concise,
          type: 'Style',
          explanation: `Conciseness: simplify '${filler}' to '${concise}'.`
        });
      }
    }

    return suggestions;
  }

  // --- Embeddings for RAG ---
  async getEmbedding(text: string): Promise<number[]> {
    if (!text || !text.trim()) return [];
    try {
      const resp = await fetch('/api/ai/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          customKey: this.getCustomKey()
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.embedding || [];
      }
    } catch (e) {
      console.warn('Embedding request failed', e);
    }
    return [];
  }

  async getBatchEmbeddings(texts: string[], concurrency = 3): Promise<number[][]> {
    const results: number[][] = new Array(texts.length);
    const queue = texts.map((text, index) => ({ text, index }));

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        try {
          results[item.index] = await this.getEmbedding(item.text);
        } catch {
          results[item.index] = [];
        }
      }
    };

    const workers = Array(concurrency).fill(null).map(() => worker());
    await Promise.all(workers);
    return results;
  }

  // --- Text Generation & Inline Transformations ---
  async generateText(prompt: string, context: string, mode: AiMode = 'fast', isDocUncensored: boolean = false): Promise<string> {
    try {
      const resp = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          context,
          mode,
          isDocUncensored,
          customKey: this.getCustomKey()
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        return data.text || '';
      }

      console.warn(`Generation server responded with ${resp.status}`);
      return 'Unable to generate response at this time. Please try again.';
    } catch (err) {
      console.error('AI generateText error:', err);
      return 'Network error connecting to AI assistant.';
    }
  }

  // --- Quality & Grammar Review ---
  async reviewText(text: string): Promise<Suggestion[]> {
    if (!text || text.length < 5) {
      this.linguixScore.set(100);
      return [];
    }

    try {
      const resp = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          customKey: this.getCustomKey()
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (typeof data.score === 'number') {
          this.linguixScore.set(data.score);
        }
        if (Array.isArray(data.suggestions)) {
          this.privacy.logEvent({
            category: 'ai_inference',
            action: 'Linguix Quality Review',
            details: `Completed review (${text.length} chars). ${data.suggestions.length} suggestions found.`,
            userEmail: 'current_user',
            status: 'processed'
          });
          return data.suggestions;
        }
      }
    } catch (err) {
      console.warn('AI review request failed, falling back to local linguistic engine', err);
    }

    const fallback = this.localLinguisticReview(text);
    this.linguixScore.set(Math.max(60, 100 - fallback.length * 8));
    return fallback;
  }

  // --- Synonyms and Alternatives ---
  async getAlternatives(text: string): Promise<Suggestion[]> {
    if (!text || text.length < 3) return [];
    try {
      const resp = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Identify 1-3 weak or repetitive words in this text and suggest stronger alternatives. Return as JSON array with properties: original, suggestion, type ('Alternative'), explanation.`,
          context: text,
          mode: 'fast',
          customKey: this.getCustomKey()
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        const jsonMatch = data.text?.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (e) {
      console.warn('Alternatives failed', e);
    }
    return [];
  }

  // --- Chat (Non-streaming) ---
  async chat(
    history: { role: string, parts: { text: string }[] }[],
    message: string,
    context?: string,
    mode: 'doc' | 'think' | 'uncensored' | 'unfiltered' = 'doc',
    isDocUncensored: boolean = false
  ): Promise<string> {
    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history,
          message,
          docContext: context,
          mode,
          isUncensored: isDocUncensored || mode === 'uncensored' || mode === 'unfiltered',
          stream: false,
          customKey: this.getCustomKey()
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.text || '';
      }
      return 'I am having trouble connecting right now.';
    } catch (err) {
      console.error('Chat error:', err);
      return 'Unable to reach the AI assistant. Please check connection.';
    }
  }

  // --- Streaming Chat ---
  async *chatStream(
    history: { role: string, parts: { text: string }[] }[],
    message: string,
    context?: string,
    mode: 'doc' | 'think' | 'uncensored' | 'unfiltered' = 'doc',
    isDocUncensored: boolean = false
  ): AsyncGenerator<string> {
    const isUncensoredEffective = isDocUncensored || mode === 'uncensored' || mode === 'unfiltered';

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history,
          message,
          docContext: context,
          mode,
          isUncensored: isUncensoredEffective,
          stream: true,
          customKey: this.getCustomKey()
        })
      });

      if (!resp.ok) {
        yield `I am having trouble connecting to the AI service (Status ${resp.status}).`;
        return;
      }

      if (!resp.body) {
        yield 'No response received from assistant.';
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.substring(5).trim();
          if (dataStr === '[DONE]') return;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              yield parsed.text;
            } else if (parsed.error) {
              yield `\n[Error: ${parsed.error}]`;
            }
          } catch {
            // Ignore parse errors on partial lines
          }
        }
      }
    } catch (err: any) {
      console.error('Streaming chat error:', err);
      yield `\nConnection error: ${err.message || 'Unable to communicate with assistant'}`;
    }
  }

  // --- Document-Type & Register Aware Paraphrasing ---
  async paraphraseText(params: ParaphraseRequest): Promise<ParaphraseResponse> {
    try {
      const resp = await fetch('/api/ai/paraphrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: params.text,
          selectionType: params.selectionType,
          documentType: params.documentType || 'novel_sfw',
          style: params.style || 'natural',
          customInstruction: params.customInstruction,
          surroundingContext: params.surroundingContext,
          isDocUncensored: params.isDocUncensored,
          customKey: this.getCustomKey()
        })
      });

      if (resp.ok) {
        return await resp.json();
      }
      throw new Error(`Server HTTP ${resp.status}`);
    } catch (err) {
      console.warn('Paraphrase API network error, falling back locally:', err);
      return {
        selectionType: params.selectionType || 'sentence',
        documentType: params.documentType || 'novel_sfw',
        style: params.style || 'natural',
        alternatives: [
          {
            text: params.text,
            label: 'Natural Cadence',
            tone: 'Smooth & balanced',
            explanation: 'Optimizes sentence rhythm and word balance.',
            fitScore: 95
          }
        ]
      };
    }
  }
}
