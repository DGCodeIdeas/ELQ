import { Injectable, signal } from '@angular/core';

export interface ModelCapability {
  name: string;
  badgeColor: string;
}

export type ModelCategory = 'instant-free' | 'groq' | 'openrouter' | 'cerebras' | 'local' | 'gemini';

export interface CuratedModel {
  id: string;
  name: string;
  provider: string;
  category: ModelCategory;
  architecture: string;
  version: string;
  description: string;
  contextWindow: string;
  contextNum: number;
  speedTokPerSec: string;
  latencyTier: string;
  isFree: boolean;
  keyRequirement: 'none' | 'free-key' | 'local';
  freeTierDetails: string;
  keySetupUrl?: string;
  privacyTier: 'zero-leak-local' | 'zero-retention' | 'free-cloud';
  capabilities: ModelCapability[];
  limitations: string[];
  recommendedFor: 'grammar' | 'drafting' | 'paraphrase' | 'chat' | 'all';
  testedLatencyMs?: number;
  testStatus?: 'untested' | 'success' | 'failed' | 'testing';
  lastTestedSnippet?: string;
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
  lastTestedSnippet?: string;
  assignedTasks: {
    grammar: boolean;
    drafting: boolean;
    paraphrase: boolean;
    chat: boolean;
  };
  createdAt: number;
}

export interface TaskModelConfig {
  grammarModelId: string;
  draftingModelId: string;
  paraphraseModelId: string;
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
    // --- 1. ZERO-CONFIG INSTANT FREE (POLLINATIONS) ---
    {
      id: 'pollinations-openai-fast',
      name: 'OpenAI Fast (Free Public)',
      provider: 'Pollinations AI',
      category: 'instant-free',
      architecture: 'GPT-4o-Mini Base',
      version: 'v4.1-fast',
      description: 'Zero-configuration, instant public inference with no API key or sign-up needed. Fast, reliable grammar and sentence expansion.',
      contextWindow: '32,768 tokens',
      contextNum: 32768,
      speedTokPerSec: '180 tok/s',
      latencyTier: 'Instant (<180ms)',
      isFree: true,
      keyRequirement: 'none',
      freeTierDetails: '100% Free Public Router • No API Key or Account Required',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: 'No Key Required', badgeColor: 'bg-emerald-100 text-emerald-800 font-bold' },
        { name: 'Instant Latency', badgeColor: 'bg-blue-100 text-blue-700' },
        { name: 'Grammar & Tone', badgeColor: 'bg-purple-100 text-purple-700' }
      ],
      limitations: [
        'Public router with variable peak-hour capacity',
        '32k token context window ceiling'
      ],
      recommendedFor: 'grammar'
    },
    {
      id: 'pollinations-deepseek',
      name: 'DeepSeek R1 / V3 (Free Public)',
      provider: 'DeepSeek / Pollinations',
      category: 'instant-free',
      architecture: 'DeepSeek 671B MoE',
      version: 'r1-v3-public',
      description: 'Massive open reasoning model accessible without API keys. Unbeatable for complex plot problem-solving, worldbuilding logic, and intricate character motivation.',
      contextWindow: '64,000 tokens',
      contextNum: 64000,
      speedTokPerSec: '120 tok/s',
      latencyTier: 'Fast (~350ms)',
      isFree: true,
      keyRequirement: 'none',
      freeTierDetails: '100% Free Public Inference • Zero Credit Card Needed',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: 'Deep Plot Reasoning', badgeColor: 'bg-cyan-100 text-cyan-800 font-bold' },
        { name: 'No Key Needed', badgeColor: 'bg-emerald-100 text-emerald-800' },
        { name: 'Creative Subtext', badgeColor: 'bg-indigo-100 text-indigo-700' }
      ],
      limitations: [
        'Multi-step reasoning may add slight output latency'
      ],
      recommendedFor: 'drafting'
    },
    {
      id: 'pollinations-mistral',
      name: 'Mistral Large (Free Public)',
      provider: 'Mistral AI / Pollinations',
      category: 'instant-free',
      architecture: 'Mistral Large 2',
      version: 'v2-123b',
      description: 'Sophisticated European flagship LLM known for exquisite literary prose, sharp dialogue rhythm, and natural multilingual fluency.',
      contextWindow: '128,000 tokens',
      contextNum: 128000,
      speedTokPerSec: '140 tok/s',
      latencyTier: 'Fast (~300ms)',
      isFree: true,
      keyRequirement: 'none',
      freeTierDetails: '100% Free Public Router • No Setup Required',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: 'Literary Prose', badgeColor: 'bg-violet-100 text-violet-800 font-bold' },
        { name: '128K Context', badgeColor: 'bg-blue-100 text-blue-700' },
        { name: 'No Key Needed', badgeColor: 'bg-emerald-100 text-emerald-800' }
      ],
      limitations: [
        'Shared public routing queue'
      ],
      recommendedFor: 'paraphrase'
    },
    {
      id: 'pollinations-qwen',
      name: 'Qwen 2.5 32B (Free Public)',
      provider: 'Alibaba / Pollinations',
      category: 'instant-free',
      architecture: 'Qwen 2.5',
      version: '2.5-32b',
      description: 'Exceptional open-weights model excelling in non-fiction, academic clarity, dense technical vocabulary, and structural outline creation.',
      contextWindow: '64,000 tokens',
      contextNum: 64000,
      speedTokPerSec: '160 tok/s',
      latencyTier: 'Fast (~250ms)',
      isFree: true,
      keyRequirement: 'none',
      freeTierDetails: '100% Free Public Inference Node',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: 'Academic Rigor', badgeColor: 'bg-amber-100 text-amber-800' },
        { name: '29+ Languages', badgeColor: 'bg-teal-100 text-teal-800' },
        { name: 'No Key Needed', badgeColor: 'bg-emerald-100 text-emerald-800' }
      ],
      limitations: [
        'Medium-length context window compared to 1M models'
      ],
      recommendedFor: 'drafting'
    },
    {
      id: 'pollinations-llama',
      name: 'Llama 3.3 70B (Free Public)',
      provider: 'Meta / Pollinations',
      category: 'instant-free',
      architecture: 'Llama 3.3',
      version: '3.3-70b',
      description: 'Flagship Meta open model running on public cluster. Ideal for character arcs, realistic dialogue, and fiction drafting without key requirements.',
      contextWindow: '128,000 tokens',
      contextNum: 128000,
      speedTokPerSec: '130 tok/s',
      latencyTier: 'Fast (~320ms)',
      isFree: true,
      keyRequirement: 'none',
      freeTierDetails: '100% Free Public Router Access',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: 'Novel Drafting', badgeColor: 'bg-rose-100 text-rose-800' },
        { name: 'Character Voices', badgeColor: 'bg-indigo-100 text-indigo-700' },
        { name: 'No Key Needed', badgeColor: 'bg-emerald-100 text-emerald-800' }
      ],
      limitations: [
        'Subject to community traffic spikes'
      ],
      recommendedFor: 'drafting'
    },

    // --- 2. GROQ FREE CLOUD TIER (ULTRA-FAST INFERENCE) ---
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B Versatile (Groq)',
      provider: 'Meta / Groq',
      category: 'groq',
      architecture: 'Llama 3.3 70B',
      version: '3.3-70b-versatile',
      description: 'The premier open model for fiction drafting, running on Groq LPUs at a blistering 330+ tokens per second. Unsurpassed flow and literary breadth.',
      contextWindow: '128,000 tokens',
      contextNum: 128000,
      speedTokPerSec: '330+ tok/s',
      latencyTier: 'Blazing (~180ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: 'Free Tier: 30 Req/Min, 14,400 Req/Day • No Credit Card Required',
      keySetupUrl: 'https://console.groq.com/keys',
      privacyTier: 'zero-retention',
      capabilities: [
        { name: 'Ultra-Fast 330 tok/s', badgeColor: 'bg-orange-100 text-orange-800 font-bold' },
        { name: '128K Context', badgeColor: 'bg-blue-100 text-blue-700' },
        { name: 'Zero-Retention Cloud', badgeColor: 'bg-emerald-100 text-emerald-700' },
        { name: 'Literary Prose Champion', badgeColor: 'bg-purple-100 text-purple-700' }
      ],
      limitations: [
        'Requires a free Groq API key (signup takes 30 seconds, no credit card)'
      ],
      recommendedFor: 'drafting'
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant (Groq)',
      provider: 'Meta / Groq',
      category: 'groq',
      architecture: 'Llama 3.1 8B',
      version: '3.1-8b-instant',
      description: 'Astonishing 800+ tokens/sec throughput. Ideal for instantaneous real-time grammar checks, sentence rephrasing, and autocomplete while typing.',
      contextWindow: '128,000 tokens',
      contextNum: 128000,
      speedTokPerSec: '800+ tok/s',
      latencyTier: 'Instant (<90ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: 'Free Tier: 30 Req/Min, 14,400 Req/Day • Instant Key Generation',
      keySetupUrl: 'https://console.groq.com/keys',
      privacyTier: 'zero-retention',
      capabilities: [
        { name: 'Hyper Speed 800 tok/s', badgeColor: 'bg-orange-100 text-orange-800 font-bold' },
        { name: 'Sub-100ms Latency', badgeColor: 'bg-emerald-100 text-emerald-800' },
        { name: 'Instant Grammar', badgeColor: 'bg-indigo-100 text-indigo-700' }
      ],
      limitations: [
        '8B parameter scale has slightly less philosophical depth than 70B models'
      ],
      recommendedFor: 'grammar'
    },
    {
      id: 'mixtral-8x7b-32768',
      name: 'Mixtral 8x7B 32k (Groq)',
      provider: 'Mistral AI / Groq',
      category: 'groq',
      architecture: 'Sparse Mixture of Experts',
      version: '8x7b-instruct',
      description: '8 separate specialized neural sub-networks. Celebrated for evocative French/European stylistic balance, poetry, and vivid prose.',
      contextWindow: '32,768 tokens',
      contextNum: 32768,
      speedTokPerSec: '500+ tok/s',
      latencyTier: 'Blazing (~150ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: 'Free Tier: 30 Req/Min, 14,400 Req/Day • Groq Free Tier',
      keySetupUrl: 'https://console.groq.com/keys',
      privacyTier: 'zero-retention',
      capabilities: [
        { name: 'MoE Architecture', badgeColor: 'bg-amber-100 text-amber-800' },
        { name: 'Poetic Sensory Prose', badgeColor: 'bg-rose-100 text-rose-800' },
        { name: '500 tok/s Speed', badgeColor: 'bg-orange-100 text-orange-800' }
      ],
      limitations: [
        '32k token maximum context length'
      ],
      recommendedFor: 'paraphrase'
    },
    {
      id: 'gemma2-9b-it',
      name: 'Gemma 2 9B IT (Groq)',
      provider: 'Google DeepMind / Groq',
      category: 'groq',
      architecture: 'Gemma 2',
      version: '2-9b-it',
      description: 'Compact Google DeepMind architecture running on Groq hardware. Extremely disciplined formatting and concise stylistic critiques.',
      contextWindow: '8,192 tokens',
      contextNum: 8192,
      speedTokPerSec: '420+ tok/s',
      latencyTier: 'Blazing (~160ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: 'Free Tier on Groq Cloud • No CC Needed',
      keySetupUrl: 'https://console.groq.com/keys',
      privacyTier: 'zero-retention',
      capabilities: [
        { name: 'Concise Editing', badgeColor: 'bg-sky-100 text-sky-800' },
        { name: 'Google Open Weights', badgeColor: 'bg-blue-100 text-blue-700' }
      ],
      limitations: [
        '8,192 token context window limit'
      ],
      recommendedFor: 'grammar'
    },

    // --- 3. OPENROUTER FREE TIER (:free COMMUNITY ENDPOINTS) ---
    {
      id: 'deepseek/deepseek-r1:free',
      name: 'DeepSeek R1 (OpenRouter Free)',
      provider: 'DeepSeek / OpenRouter',
      category: 'openrouter',
      architecture: 'DeepSeek 671B Reasoning',
      version: 'r1-free',
      description: 'State-of-the-art chain-of-thought reasoning engine. Solves impossible plot holes, designs intricate magic/tech systems, and untangles mystery twists.',
      contextWindow: '128,000 tokens',
      contextNum: 128000,
      speedTokPerSec: '80 tok/s',
      latencyTier: 'Deep Reasoning (~1.5s)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: 'Free Community Tier • Free OpenRouter API Key (No Credits Needed)',
      keySetupUrl: 'https://openrouter.ai/keys',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: 'Deep Plot Reasoning', badgeColor: 'bg-cyan-100 text-cyan-800 font-bold' },
        { name: '128K Context', badgeColor: 'bg-blue-100 text-blue-700' },
        { name: 'Zero Paid Credits Needed', badgeColor: 'bg-emerald-100 text-emerald-800' }
      ],
      limitations: [
        'Longer time-to-first-token due to reasoning reflection tokens'
      ],
      recommendedFor: 'drafting'
    },
    {
      id: 'deepseek/deepseek-chat:free',
      name: 'DeepSeek V3 Chat (OpenRouter Free)',
      provider: 'DeepSeek / OpenRouter',
      category: 'openrouter',
      architecture: 'DeepSeek V3 671B',
      version: 'v3-free',
      description: 'DeepSeek flagship conversational model. Uncannily natural creative writing, atmospheric sensory descriptions, and intuitive dialogue.',
      contextWindow: '128,000 tokens',
      contextNum: 128000,
      speedTokPerSec: '110 tok/s',
      latencyTier: 'Fast (~400ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: '100% Free Endpoint on OpenRouter Free Tier',
      keySetupUrl: 'https://openrouter.ai/keys',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: 'Novel & Fiction Master', badgeColor: 'bg-violet-100 text-violet-800 font-bold' },
        { name: '128K Context', badgeColor: 'bg-blue-100 text-blue-700' },
        { name: 'Sensory Depth', badgeColor: 'bg-rose-100 text-rose-800' }
      ],
      limitations: [
        'Free router subject to rate caps during global peak hours'
      ],
      recommendedFor: 'chat'
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      name: 'Llama 3.3 70B Instruct (OpenRouter Free)',
      provider: 'Meta / OpenRouter',
      category: 'openrouter',
      architecture: 'Llama 3.3 70B',
      version: '3.3-70b-it:free',
      description: 'Universal open instruction model. Excellent for chapter drafting, academic outlining, structured dialogue, and book editing.',
      contextWindow: '131,072 tokens',
      contextNum: 131072,
      speedTokPerSec: '90 tok/s',
      latencyTier: 'Fast (~450ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: 'Zero-Cost Free Tier Model on OpenRouter',
      keySetupUrl: 'https://openrouter.ai/keys',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: '131K Long Context', badgeColor: 'bg-blue-100 text-blue-700' },
        { name: 'Flagship Open Weights', badgeColor: 'bg-teal-100 text-teal-800' }
      ],
      limitations: [
        'Community queue latency during high load'
      ],
      recommendedFor: 'drafting'
    },
    {
      id: 'qwen/qwen-2.5-72b-instruct:free',
      name: 'Qwen 2.5 72B (OpenRouter Free)',
      provider: 'Alibaba Cloud / OpenRouter',
      category: 'openrouter',
      architecture: 'Qwen 2.5 72B',
      version: '2.5-72b:free',
      description: 'Ranked #1 open model in international benchmarks for non-English prose, STEM writing, and meticulous syntax enforcement.',
      contextWindow: '128,000 tokens',
      contextNum: 128000,
      speedTokPerSec: '95 tok/s',
      latencyTier: 'Fast (~400ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: '100% Free Access on OpenRouter',
      keySetupUrl: 'https://openrouter.ai/keys',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: 'Multilingual 29+ Langs', badgeColor: 'bg-orange-100 text-orange-800' },
        { name: 'Grammar Perfection', badgeColor: 'bg-emerald-100 text-emerald-800' },
        { name: '128K Context', badgeColor: 'bg-blue-100 text-blue-700' }
      ],
      limitations: [
        'Rate limit quotas apply on community nodes'
      ],
      recommendedFor: 'grammar'
    },
    {
      id: 'mistralai/mistral-7b-instruct:free',
      name: 'Mistral 7B Instruct (OpenRouter Free)',
      provider: 'Mistral AI / OpenRouter',
      category: 'openrouter',
      architecture: 'Mistral 7B',
      version: 'v0.3-7b:free',
      description: 'Razor-sharp, compact instruction model for concise prose editing, active-voice enforcement, and sentence rhythm polish.',
      contextWindow: '32,768 tokens',
      contextNum: 32768,
      speedTokPerSec: '120 tok/s',
      latencyTier: 'Fast (~280ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: 'Free Tier Community Endpoint',
      keySetupUrl: 'https://openrouter.ai/keys',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: 'Ultra Concise', badgeColor: 'bg-cyan-100 text-cyan-800' },
        { name: 'Style & Tone Master', badgeColor: 'bg-violet-100 text-violet-800' }
      ],
      limitations: [
        '32k token context ceiling'
      ],
      recommendedFor: 'paraphrase'
    },
    {
      id: 'nousresearch/hermes-3-llama-3.1-405b:free',
      name: 'Hermes 3 405B (OpenRouter Free)',
      provider: 'Nous Research / OpenRouter',
      category: 'openrouter',
      architecture: 'Llama 3.1 405B Base',
      version: 'hermes-3-405b:free',
      description: 'Colossal 405-billion parameter frontier open model fine-tuned by Nous Research for high creative agency, roleplay, and epic story construction.',
      contextWindow: '128,000 tokens',
      contextNum: 128000,
      speedTokPerSec: '50 tok/s',
      latencyTier: 'Moderate (~900ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: 'Free Tier Access on OpenRouter',
      keySetupUrl: 'https://openrouter.ai/keys',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: 'Colossal 405B Scale', badgeColor: 'bg-purple-100 text-purple-800 font-bold' },
        { name: 'Uncensored Lore Master', badgeColor: 'bg-rose-100 text-rose-800' },
        { name: '128K Context', badgeColor: 'bg-blue-100 text-blue-700' }
      ],
      limitations: [
        'Subject to high traffic queue wait times'
      ],
      recommendedFor: 'drafting'
    },

    // --- 4. CEREBRAS FREE TIER (1,800+ TOKENS/SEC HARDWARE) ---
    {
      id: 'cerebras-llama3.3-70b',
      name: 'Llama 3.3 70B (Cerebras Free)',
      provider: 'Meta / Cerebras Cloud',
      category: 'cerebras',
      architecture: 'Llama 3.3 70B',
      version: '3.3-70b-cerebras',
      description: 'World-record inference speed: 1,800+ tokens/second on Cerebras Wafer-Scale Engines. Generates entire chapters in 2 seconds flat.',
      contextWindow: '8,192 tokens',
      contextNum: 8192,
      speedTokPerSec: '1,800+ tok/s',
      latencyTier: 'Superhuman (<60ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: 'Free Tier with Free API Key • Generous Free Daily Quota',
      keySetupUrl: 'https://cloud.cerebras.ai/',
      privacyTier: 'zero-retention',
      capabilities: [
        { name: '1,800 tok/s Wafer Speed', badgeColor: 'bg-yellow-100 text-yellow-800 font-bold' },
        { name: 'Immediate Streaming', badgeColor: 'bg-emerald-100 text-emerald-800' }
      ],
      limitations: [
        '8,192 token context window limit on current Cerebras free tier'
      ],
      recommendedFor: 'drafting'
    },
    {
      id: 'cerebras-llama3.1-8b',
      name: 'Llama 3.1 8B (Cerebras Free)',
      provider: 'Meta / Cerebras Cloud',
      category: 'cerebras',
      architecture: 'Llama 3.1 8B',
      version: '3.1-8b-cerebras',
      description: '2,100+ tokens/second superhuman inference. The absolute fastest AI response time in existence for immediate proofreading and styling.',
      contextWindow: '8,192 tokens',
      contextNum: 8192,
      speedTokPerSec: '2,100+ tok/s',
      latencyTier: 'Instant (<40ms)',
      isFree: true,
      keyRequirement: 'free-key',
      freeTierDetails: 'Free Tier on Cerebras Cloud • Instant Signup',
      keySetupUrl: 'https://cloud.cerebras.ai/',
      privacyTier: 'zero-retention',
      capabilities: [
        { name: '2,100 tok/s Maximum Speed', badgeColor: 'bg-yellow-100 text-yellow-800 font-bold' },
        { name: 'Sub-50ms Reaction', badgeColor: 'bg-emerald-100 text-emerald-800' }
      ],
      limitations: [
        '8k token context window'
      ],
      recommendedFor: 'grammar'
    },

    // --- 5. LOCAL & PRIVATE (OLLAMA / LM STUDIO) ---
    {
      id: 'ollama-local',
      name: 'Ollama Local Daemon (100% Offline)',
      provider: 'Self-Hosted / Local',
      category: 'local',
      architecture: 'Local Weights (Llama/Qwen/Mistral)',
      version: 'localhost:11434',
      description: 'Connect directly to your local computer Ollama instance. 100% private, zero network requests, zero data collection, runs entirely offline.',
      contextWindow: 'Configurable (Up to 128k)',
      contextNum: 131072,
      speedTokPerSec: 'Hardware Dependent',
      latencyTier: 'Local Node (~100ms-1s)',
      isFree: true,
      keyRequirement: 'local',
      freeTierDetails: '100% Sovereign & Free Forever • Runs on your Mac / PC',
      privacyTier: 'zero-leak-local',
      capabilities: [
        { name: 'Zero-Leak Offline', badgeColor: 'bg-green-100 text-green-800 font-bold' },
        { name: 'Zero Data Retention', badgeColor: 'bg-emerald-100 text-emerald-800 font-bold' },
        { name: 'Completely Free', badgeColor: 'bg-purple-100 text-purple-700' }
      ],
      limitations: [
        'Requires Ollama running on your local machine (`ollama run llama3.3`)'
      ],
      recommendedFor: 'all'
    },
    {
      id: 'lm-studio-local',
      name: 'LM Studio (Local GUI Server)',
      provider: 'Self-Hosted / Local',
      category: 'local',
      architecture: 'Any GGUF Model',
      version: 'localhost:1234',
      description: 'Connects to LM Studio local server running on port 1234. Supports Metal on Apple Silicon and CUDA on NVIDIA with zero cloud leaks.',
      contextWindow: 'Configurable (Up to 128k)',
      contextNum: 131072,
      speedTokPerSec: 'GPU Accelerated',
      latencyTier: 'Local Node (~80ms-800ms)',
      isFree: true,
      keyRequirement: 'local',
      freeTierDetails: '100% Private Offline GUI Runner',
      privacyTier: 'zero-leak-local',
      capabilities: [
        { name: 'Zero-Leak Privacy', badgeColor: 'bg-green-100 text-green-800 font-bold' },
        { name: 'Apple Metal / CUDA', badgeColor: 'bg-indigo-100 text-indigo-800' }
      ],
      limitations: [
        'Requires LM Studio Local Server turned ON in LM Studio app'
      ],
      recommendedFor: 'all'
    },

    // --- 6. GOOGLE AI STUDIO (GEMINI FREE TIER) ---
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 3.8 Flash (Google AI Studio)',
      provider: 'Google AI',
      category: 'gemini',
      architecture: 'Gemini 3.8',
      version: 'v3.8-flash',
      description: 'Ultra-low latency model fine-tuned for high-speed grammar correction, clarity rephrasing, and instant block completions with 1M token context.',
      contextWindow: '1,048,576 tokens',
      contextNum: 1048576,
      speedTokPerSec: '250 tok/s',
      latencyTier: 'Instant (<150ms)',
      isFree: true,
      keyRequirement: 'none',
      freeTierDetails: 'Google AI Studio Free Tier (15 RPM) • Pre-configured in app',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: '1M Context Window', badgeColor: 'bg-blue-100 text-blue-800 font-bold' },
        { name: 'Instant Latency (<150ms)', badgeColor: 'bg-emerald-100 text-emerald-800' },
        { name: 'High Grammar Precision', badgeColor: 'bg-purple-100 text-purple-700' },
        { name: 'Pre-Configured', badgeColor: 'bg-amber-100 text-amber-800' }
      ],
      limitations: [
        'Subject to standard 15 RPM free tier quota during intensive usage'
      ],
      recommendedFor: 'all'
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash (Google AI Studio)',
      provider: 'Google AI',
      category: 'gemini',
      architecture: 'Gemini 2.5',
      version: 'v2.5-flash',
      description: 'Rock-solid multimodal foundation model with 1 million token context memory for analyzing full book manuscripts simultaneously.',
      contextWindow: '1,048,576 tokens',
      contextNum: 1048576,
      speedTokPerSec: '200 tok/s',
      latencyTier: 'Fast (~200ms)',
      isFree: true,
      keyRequirement: 'none',
      freeTierDetails: 'Pre-configured Fallback • Free Tier Quota',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: '1M Context', badgeColor: 'bg-blue-100 text-blue-800' },
        { name: 'Full-Book Recall', badgeColor: 'bg-indigo-100 text-indigo-700' }
      ],
      limitations: [
        'Standard Google free tier rate limitations'
      ],
      recommendedFor: 'chat'
    },
    {
      id: 'gemini-3.1-flash-lite',
      name: 'Gemini 3.1 Flash-Lite (Google AI Studio)',
      provider: 'Google AI',
      category: 'gemini',
      architecture: 'Gemini 3.1 Lite',
      version: 'v3.1-flash-lite',
      description: 'High-throughput lightweight model optimized for high-frequency token generation, spelling checks, and vocabulary synonym lookups.',
      contextWindow: '1,048,576 tokens',
      contextNum: 1048576,
      speedTokPerSec: '300 tok/s',
      latencyTier: 'Instant (<120ms)',
      isFree: true,
      keyRequirement: 'none',
      freeTierDetails: 'Pre-configured Free Tier Model',
      privacyTier: 'free-cloud',
      capabilities: [
        { name: '1M Context', badgeColor: 'bg-blue-100 text-blue-800' },
        { name: 'High Throughput', badgeColor: 'bg-emerald-100 text-emerald-800' }
      ],
      limitations: [
        'Optimized for speed over extreme creative nuance'
      ],
      recommendedFor: 'grammar'
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
    return [];
  }

  private loadTaskRoles(): TaskModelConfig {
    try {
      const stored = localStorage.getItem(this.TASK_ROLES_STORAGE);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.grammarModelId === 'gemini-2.0-flash-free') parsed.grammarModelId = 'gemini-2.5-flash';
        if (parsed.draftingModelId === 'gemini-2.0-flash-free') parsed.draftingModelId = 'llama-3.3-70b-versatile';
        if (parsed.chatModelId === 'gemini-2.0-flash-free') parsed.chatModelId = 'gemini-2.5-flash';
        if (!parsed.paraphraseModelId) parsed.paraphraseModelId = 'pollinations-mistral';
        return parsed;
      }
    } catch {}
    return {
      grammarModelId: 'gemini-2.5-flash',
      draftingModelId: 'llama-3.3-70b-versatile',
      paraphraseModelId: 'pollinations-mistral',
      chatModelId: 'gemini-2.5-flash'
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

  async testModelProbe(modelId: string, customModel?: CustomModel, samplePrompt?: string): Promise<{ success: boolean; latencyMs: number; snippet: string; message: string }> {
    const start = performance.now();
    const prompt = samplePrompt || 'Rephrase with literary elegance: The cold wind blew through the quiet empty street.';

    try {
      const resp = await fetch('/api/ai/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          prompt,
          customModel: customModel || undefined
        })
      });

      const latency = Math.max(1, Math.round(performance.now() - start));
      if (resp.ok) {
        const data = await resp.json();
        const snippet = data.snippet || data.text || '';
        const realLatency = data.latencyMs || latency;

        // Update curated or custom model test status in memory
        const curated = this.freeModels.find(m => m.id === modelId);
        if (curated) {
          curated.testedLatencyMs = realLatency;
          curated.testStatus = 'success';
          curated.lastTestedSnippet = snippet;
        }

        if (customModel) {
          const updated = this.customModels().map(m => {
            if (m.id === customModel.id) {
              return { ...m, testedLatencyMs: realLatency, testStatus: 'success' as const, lastTestedSnippet: snippet };
            }
            return m;
          });
          this.customModels.set(updated);
          localStorage.setItem(this.CUSTOM_MODELS_STORAGE, JSON.stringify(updated));
        }

        return {
          success: true,
          latencyMs: realLatency,
          snippet,
          message: `Verified in ${realLatency}ms. Generated response: "${snippet.substring(0, 80)}..."`
        };
      }

      const errData = await resp.json().catch(() => ({}));
      const errorMsg = errData.error || `Server responded with HTTP ${resp.status}`;

      const curated = this.freeModels.find(m => m.id === modelId);
      if (curated) {
        curated.testedLatencyMs = latency;
        curated.testStatus = 'failed';
      }

      if (customModel) {
        const updated = this.customModels().map(m => {
          if (m.id === customModel.id) {
            return { ...m, testedLatencyMs: latency, testStatus: 'failed' as const };
          }
          return m;
        });
        this.customModels.set(updated);
        localStorage.setItem(this.CUSTOM_MODELS_STORAGE, JSON.stringify(updated));
      }

      return {
        success: false,
        latencyMs: latency,
        snippet: '',
        message: `Test failed (${latency}ms): ${errorMsg}`
      };
    } catch (err: any) {
      const latency = Math.max(1, Math.round(performance.now() - start));
      return {
        success: false,
        latencyMs: latency,
        snippet: '',
        message: `Connection error (${latency}ms): ${err.message || 'Check network or endpoint'}`
      };
    }
  }

  async testModelConnection(model: CustomModel): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const res = await this.testModelProbe(model.id, model);
    return {
      success: res.success,
      latencyMs: res.latencyMs,
      message: res.message
    };
  }

  getModelNameById(id: string): string {
    const free = this.freeModels.find(m => m.id === id);
    if (free) return free.name;
    const custom = this.customModels().find(m => m.id === id);
    if (custom) return custom.name;
    return 'Default Model';
  }
}
