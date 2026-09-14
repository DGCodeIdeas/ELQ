import { Injectable, signal } from '@angular/core';

export interface ModelCapability {
  name: string;
  badgeColor: string;
}

export interface CuratedModel {
  id: string;
  name: string;
  provider: string;
  version: string;
  description: string;
  contextWindow: string;
  isFree: boolean;
  capabilities: ModelCapability[];
  limitations: string[];
  recommendedFor: 'grammar' | 'drafting' | 'chat' | 'all';
}

export interface CustomModel {
  id: string;
  name: string;
  version: string;
  description: string;
  architecture: string; // e.g., 'Llama-3', 'Mistral', 'Qwen', 'Custom'
  providerType: 'openai-compatible' | 'ollama' | 'gemini-finetuned' | 'custom-endpoint';
  endpointUrl: string;
  apiKey?: string;
  contextWindow: number;
  temperature: number;
  systemPrompt?: string;
  testedLatencyMs?: number;
  testStatus?: 'untested' | 'success' | 'failed' | 'testing';
  assignedTasks: {
    grammar: boolean;
    drafting: boolean;
    chat: boolean;
  };
  createdAt: number;
}

export interface TaskModelConfig {
  grammarModelId: string;
  draftingModelId: string;
  chatModelId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModelService {
  private readonly CUSTOM_MODELS_STORAGE = 'eloqui_custom_models';
  private readonly TASK_ROLES_STORAGE = 'eloqui_task_model_roles';

  // Curated Free Pre-Trained Language Models
  readonly freeModels: CuratedModel[] = [
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash (Free)',
      provider: 'Google AI',
      version: 'v3.8-flash',
      description: 'Ultra-low latency model fine-tuned for high-speed grammar correction, clarity rephrasing, and instant block completions.',
      contextWindow: '1,048,576 tokens',
      isFree: true,
      capabilities: [
        { name: '1M Context', badgeColor: 'bg-blue-100 text-blue-700' },
        { name: 'Instant Latency (<200ms)', badgeColor: 'bg-emerald-100 text-emerald-700' },
        { name: 'High Grammar Precision', badgeColor: 'bg-purple-100 text-purple-700' },
        { name: 'Zero-Cost Free Tier', badgeColor: 'bg-amber-100 text-amber-700' }
      ],
      limitations: [
        'Subject to 15 RPM standard Google free tier quota',
        'Direct cloud processing via Google endpoint'
      ],
      recommendedFor: 'all'
    },
    {
      id: 'llama-3.3-70b-free',
      name: 'Llama 3.3 70B Instruct (Free)',
      provider: 'Meta / Groq / OpenRouter',
      version: '3.3-70b-instruct',
      description: 'Open-weights flagship model with exceptional nuanced prose, literary vocabulary, and structural outline generation.',
      contextWindow: '131,072 tokens',
      isFree: true,
      capabilities: [
        { name: 'Deep Reasoning', badgeColor: 'bg-indigo-100 text-indigo-700' },
        { name: 'Creative Prose', badgeColor: 'bg-rose-100 text-rose-700' },
        { name: 'Open Weights', badgeColor: 'bg-teal-100 text-teal-700' }
      ],
      limitations: [
        'Free community router subject to peak queue times',
        'Moderate latency (600ms - 1.2s)'
      ],
      recommendedFor: 'drafting'
    },
    {
      id: 'mistral-7b-instruct-free',
      name: 'Mistral 7B Instruct (Free)',
      provider: 'Mistral AI / OpenRouter',
      version: 'v0.3-7b',
      description: 'Compact, razor-sharp model specialized in conciseness, grammar rule enforcement, and tone formatting.',
      contextWindow: '32,768 tokens',
      isFree: true,
      capabilities: [
        { name: 'Ultra Concise', badgeColor: 'bg-cyan-100 text-cyan-700' },
        { name: 'Style & Tone Master', badgeColor: 'bg-violet-100 text-violet-700' },
        { name: 'Low Footprint', badgeColor: 'bg-gray-100 text-gray-700' }
      ],
      limitations: [
        'Smaller context window than Gemini',
        'Limited multi-turn long-form recollection'
      ],
      recommendedFor: 'grammar'
    },
    {
      id: 'qwen-2.5-72b-free',
      name: 'Qwen 2.5 72B (Free Tier)',
      provider: 'Alibaba Cloud / HuggingFace',
      version: 'v2.5-72b',
      description: 'Top-ranking multilingual and technical writing model with stellar syntax accuracy across 29+ languages.',
      contextWindow: '128,000 tokens',
      isFree: true,
      capabilities: [
        { name: 'Multilingual 29+ Langs', badgeColor: 'bg-orange-100 text-orange-700' },
        { name: 'Technical Syntax', badgeColor: 'bg-blue-100 text-blue-700' },
        { name: 'Complex Formatting', badgeColor: 'bg-emerald-100 text-emerald-700' }
      ],
      limitations: [
        'Inference rates vary based on public demo nodes',
        'Higher memory requirements if run locally'
      ],
      recommendedFor: 'drafting'
    },
    {
      id: 'gemma-2-9b-free',
      name: 'Gemma 2 9B (Free / WebLLM Spec)',
      provider: 'Google DeepMind',
      version: '2-9b-it',
      description: 'Lightweight, privacy-first instruction tuned model optimized for local browser execution or private self-hosted endpoints.',
      contextWindow: '8,192 tokens',
      isFree: true,
      capabilities: [
        { name: 'Zero-Leak Privacy', badgeColor: 'bg-green-100 text-green-700' },
        { name: 'Local Capable', badgeColor: 'bg-purple-100 text-purple-700' }
      ],
      limitations: [
        '8k context ceiling',
        'Slightly lower creativity than 70B models'
      ],
      recommendedFor: 'chat'
    }
  ];

  // Custom Models
  readonly customModels = signal<CustomModel[]>(this.loadCustomModels());

  // Active Task Model Mappings
  readonly taskRoles = signal<TaskModelConfig>(this.loadTaskRoles());

  constructor() {}

  private loadCustomModels(): CustomModel[] {
    try {
      const stored = localStorage.getItem(this.CUSTOM_MODELS_STORAGE);
      if (stored) return JSON.parse(stored);
    } catch {}
    // Empty state to avoid simulated stubs
    return [];
  }

  private loadTaskRoles(): TaskModelConfig {
    try {
      const stored = localStorage.getItem(this.TASK_ROLES_STORAGE);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.grammarModelId === 'gemini-2.0-flash-free') parsed.grammarModelId = 'gemini-3.8-flash';
        if (parsed.draftingModelId === 'gemini-2.0-flash-free') parsed.draftingModelId = 'gemini-3.8-flash';
        if (parsed.chatModelId === 'gemini-2.0-flash-free') parsed.chatModelId = 'gemini-3.8-flash';
        return parsed;
      }
    } catch {}
    return {
      grammarModelId: 'gemini-3.8-flash',
      draftingModelId: 'gemini-3.8-flash',
      chatModelId: 'gemini-3.8-flash'
    };
  }

  saveCustomModel(model: CustomModel) {
    const existing = this.customModels().filter(m => m.id !== model.id);
    const updated = [model, ...existing];
    this.customModels.set(updated);
    localStorage.setItem(this.CUSTOM_MODELS_STORAGE, JSON.stringify(updated));
  }

  deleteCustomModel(id: string) {
    const updated = this.customModels().filter(m => m.id !== id);
    this.customModels.set(updated);
    localStorage.setItem(this.CUSTOM_MODELS_STORAGE, JSON.stringify(updated));
  }

  setTaskRole(task: keyof TaskModelConfig, modelId: string) {
    const current = { ...this.taskRoles(), [task]: modelId };
    this.taskRoles.set(current);
    localStorage.setItem(this.TASK_ROLES_STORAGE, JSON.stringify(current));
  }

  async testModelConnection(model: CustomModel): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const start = performance.now();
    try {
      if (!model.endpointUrl) {
        return { success: false, latencyMs: 0, message: 'Endpoint URL is required' };
      }

      // Real network probe using fetch with 6s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const headers: Record<string, string> = {
        'Accept': 'application/json, text/plain, */*'
      };
      if (model.apiKey) {
        headers['Authorization'] = `Bearer ${model.apiKey}`;
      }

      let response: Response;
      try {
        // Try GET probe (or lightweight options)
        response = await fetch(model.endpointUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
          mode: 'cors'
        });
      } catch (err: any) {
        // If GET was rejected by method or CORS preflight, try HEAD probe
        if (err.name !== 'AbortError') {
          response = await fetch(model.endpointUrl, {
            method: 'HEAD',
            headers,
            signal: controller.signal,
            mode: 'cors'
          });
        } else {
          throw err;
        }
      } finally {
        clearTimeout(timeoutId);
      }

      const latency = Math.max(1, Math.round(performance.now() - start));
      // HTTP 200-299, or 401/403/405 confirm the server is live and responding
      const isReachable = response.status > 0;
      const isOk = response.ok;
      const statusText = response.statusText ? ` (${response.statusText})` : '';

      const updated = this.customModels().map(m => {
        if (m.id === model.id) {
          return { ...m, testedLatencyMs: latency, testStatus: isOk ? ('success' as const) : ('failed' as const) };
        }
        return m;
      });
      this.customModels.set(updated);
      localStorage.setItem(this.CUSTOM_MODELS_STORAGE, JSON.stringify(updated));

      if (isOk) {
        return {
          success: true,
          latencyMs: latency,
          message: `HTTP ${response.status}${statusText} verified in ${latency}ms. Custom model endpoint is active.`
        };
      } else {
        return {
          success: false,
          latencyMs: latency,
          message: `Endpoint reached in ${latency}ms but returned HTTP ${response.status}${statusText}. Check API key or route.`
        };
      }
    } catch (e: any) {
      const latency = Math.max(1, Math.round(performance.now() - start));
      const errorMsg = e.name === 'AbortError' 
        ? 'Connection timed out after 6000ms. Check endpoint availability.' 
        : (e.message || 'Network or CORS error. Verify CORS is enabled on the server.');

      const updated = this.customModels().map(m => {
        if (m.id === model.id) {
          return { ...m, testedLatencyMs: latency, testStatus: 'failed' as const };
        }
        return m;
      });
      this.customModels.set(updated);
      localStorage.setItem(this.CUSTOM_MODELS_STORAGE, JSON.stringify(updated));

      return {
        success: false,
        latencyMs: latency,
        message: `Connection failed: ${errorMsg}`
      };
    }
  }

  getModelNameById(id: string): string {
    const free = this.freeModels.find(m => m.id === id);
    if (free) return free.name;
    const custom = this.customModels().find(m => m.id === id);
    if (custom) return custom.name;
    return 'Default Model';
  }
}
