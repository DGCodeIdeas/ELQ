import { Component, ChangeDetectionStrategy, inject, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModelService, CuratedModel, CustomModel, TaskModelConfig, ModelCategory } from '../../services/model.service';
import { AuthService } from '../../services/auth.service';
import { CryptoService, ApiKeyConfig } from '../../services/crypto.service';

@Component({
  selector: 'app-models-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" (click)="close.emit()"></div>

      <div class="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/90">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h6"/>
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-semibold text-gray-900">AI Model Hub & Engine Routing</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  {{ modelService.freeModels.length }} Free Models
                </span>
              </div>
              <p class="text-xs text-gray-500">Route tasks to zero-config public models, wafer-speed engines, community tiers, or private Ollama nodes</p>
            </div>
          </div>
          
          <button (click)="close.emit()" class="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex flex-wrap border-b border-gray-200 bg-white px-6">
          <button
            (click)="activeTab.set('curated')"
            [class.border-indigo-600]="activeTab() === 'curated'"
            [class.text-indigo-600]="activeTab() === 'curated'"
            [class.text-gray-500]="activeTab() !== 'curated'"
            class="py-3 px-4 text-xs font-semibold border-b-2 border-transparent hover:text-gray-700 transition-colors flex items-center gap-2"
          >
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            Curated Free Models ({{ modelService.freeModels.length }})
          </button>
          
          <button
            (click)="activeTab.set('custom')"
            [class.border-indigo-600]="activeTab() === 'custom'"
            [class.text-indigo-600]="activeTab() === 'custom'"
            [class.text-gray-500]="activeTab() !== 'custom'"
            class="py-3 px-4 text-xs font-semibold border-b-2 border-transparent hover:text-gray-700 transition-colors flex items-center gap-2"
          >
            <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
            Custom & Local Nodes ({{ modelService.customModels().length }})
          </button>

          <button
            (click)="activeTab.set('assignments')"
            [class.border-indigo-600]="activeTab() === 'assignments'"
            [class.text-indigo-600]="activeTab() === 'assignments'"
            [class.text-gray-500]="activeTab() !== 'assignments'"
            class="py-3 px-4 text-xs font-semibold border-b-2 border-transparent hover:text-gray-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Task Role Matrix
          </button>

          <button
            (click)="activeTab.set('vault')"
            [class.border-indigo-600]="activeTab() === 'vault'"
            [class.text-indigo-600]="activeTab() === 'vault'"
            [class.text-gray-500]="activeTab() !== 'vault'"
            class="py-3 px-4 text-xs font-semibold border-b-2 border-transparent hover:text-gray-700 transition-colors flex items-center gap-2 ml-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Free Key Vault
          </button>
        </div>

        <!-- Tab Body -->
        <div class="overflow-y-auto p-6 flex-1 space-y-4">

          <!-- ============================================== -->
          <!-- TAB 1: CURATED FREE MODELS                     -->
          <!-- ============================================== -->
          @if (activeTab() === 'curated') {
            <div class="space-y-4">
              <!-- Controls: Search & Category Filter Bar -->
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <!-- Search -->
                <div class="relative flex-1 max-w-md">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    type="text"
                    [ngModel]="searchQuery()"
                    (ngModelChange)="searchQuery.set($event)"
                    placeholder="Search models, architectures, or capabilities..."
                    class="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                <!-- Category Filters -->
                <div class="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    (click)="selectedCategory.set('all')"
                    [class.bg-indigo-600]="selectedCategory() === 'all'"
                    [class.text-white]="selectedCategory() === 'all'"
                    [class.bg-gray-100]="selectedCategory() !== 'all'"
                    [class.text-gray-700]="selectedCategory() !== 'all'"
                    class="px-2.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors"
                  >
                    All ({{ modelService.freeModels.length }})
                  </button>
                  <button
                    (click)="selectedCategory.set('instant-free')"
                    [class.bg-indigo-600]="selectedCategory() === 'instant-free'"
                    [class.text-white]="selectedCategory() === 'instant-free'"
                    [class.bg-gray-100]="selectedCategory() !== 'instant-free'"
                    [class.text-gray-700]="selectedCategory() !== 'instant-free'"
                    class="px-2.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors"
                  >
                    ⚡ Zero-Config (No Key)
                  </button>
                  <button
                    (click)="selectedCategory.set('groq')"
                    [class.bg-indigo-600]="selectedCategory() === 'groq'"
                    [class.text-white]="selectedCategory() === 'groq'"
                    [class.bg-gray-100]="selectedCategory() !== 'groq'"
                    [class.text-gray-700]="selectedCategory() !== 'groq'"
                    class="px-2.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors"
                  >
                    Groq (Wafer-Speed)
                  </button>
                  <button
                    (click)="selectedCategory.set('openrouter')"
                    [class.bg-indigo-600]="selectedCategory() === 'openrouter'"
                    [class.text-white]="selectedCategory() === 'openrouter'"
                    [class.bg-gray-100]="selectedCategory() !== 'openrouter'"
                    [class.text-gray-700]="selectedCategory() !== 'openrouter'"
                    class="px-2.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors"
                  >
                    OpenRouter :free
                  </button>
                  <button
                    (click)="selectedCategory.set('cerebras')"
                    [class.bg-indigo-600]="selectedCategory() === 'cerebras'"
                    [class.text-white]="selectedCategory() === 'cerebras'"
                    [class.bg-gray-100]="selectedCategory() !== 'cerebras'"
                    [class.text-gray-700]="selectedCategory() !== 'cerebras'"
                    class="px-2.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors"
                  >
                    Cerebras
                  </button>
                  <button
                    (click)="selectedCategory.set('gemini')"
                    [class.bg-indigo-600]="selectedCategory() === 'gemini'"
                    [class.text-white]="selectedCategory() === 'gemini'"
                    [class.bg-gray-100]="selectedCategory() !== 'gemini'"
                    [class.text-gray-700]="selectedCategory() !== 'gemini'"
                    class="px-2.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors"
                  >
                    Gemini Free
                  </button>
                </div>
              </div>

              <!-- Model Cards Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (m of filteredModels(); track m.id) {
                  <div class="border border-gray-200 rounded-xl p-4 bg-white shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3">
                    <div>
                      <!-- Card Header -->
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <div class="flex items-center gap-2">
                            <h3 class="font-semibold text-gray-900 text-sm">{{ m.name }}</h3>
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">100% FREE</span>
                          </div>
                          <span class="text-[11px] text-gray-500">{{ m.provider }} • {{ m.architecture }} • {{ m.version }}</span>
                        </div>
                        <div class="text-right">
                          <span class="text-[10px] font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700 block">{{ m.contextWindow }}</span>
                          <span class="text-[10px] text-gray-600 font-medium mt-0.5 block">{{ m.speedTokPerSec }}</span>
                        </div>
                      </div>

                      <p class="text-xs text-gray-600 mt-2 leading-relaxed">{{ m.description }}</p>

                      <!-- Key Requirement & Tier Badges -->
                      <div class="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <!-- Key Requirement status -->
                        @if (m.keyRequirement === 'none') {
                          <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Zero Keys Needed
                          </span>
                        } @else if (hasKeyForModel(m)) {
                          <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Vault Key Active
                          </span>
                        } @else {
                          <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            Free Account Key (Zero Cost)
                          </span>
                        }

                        <!-- Latency Tier -->
                        <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {{ m.latencyTier }}
                        </span>

                        <!-- Privacy Tier -->
                        @if (m.privacyTier === 'zero-retention') {
                          <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                            Zero Retention
                          </span>
                        } @else if (m.privacyTier === 'zero-leak-local') {
                          <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            Air-Gapped Local
                          </span>
                        }
                      </div>

                      <!-- Capabilities -->
                      <div class="flex flex-wrap gap-1 mt-2.5">
                        @for (cap of m.capabilities; track cap.name) {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" [class]="cap.badgeColor">
                            {{ cap.name }}
                          </span>
                        }
                      </div>

                      <!-- Latency Test Probe Result Banner -->
                      @if (m.testedLatencyMs) {
                        <div class="mt-2.5 text-[11px] p-2 rounded-lg border flex items-start gap-2"
                             [class.bg-emerald-50]="m.testStatus === 'success'"
                             [class.border-emerald-200]="m.testStatus === 'success'"
                             [class.text-emerald-800]="m.testStatus === 'success'"
                             [class.bg-amber-50]="m.testStatus === 'failed'"
                             [class.border-amber-200]="m.testStatus === 'failed'"
                             [class.text-amber-900]="m.testStatus === 'failed'">
                          <span class="w-2 h-2 rounded-full mt-1 shrink-0"
                                [class.bg-emerald-500]="m.testStatus === 'success'"
                                [class.bg-amber-500]="m.testStatus === 'failed'"></span>
                          <div class="flex-1 min-w-0">
                            <span class="font-semibold">Latency: {{ m.testedLatencyMs }}ms</span>
                            @if (m.lastTestedSnippet) {
                              <p class="truncate text-[10px] opacity-85 mt-0.5 font-mono">Sample: "{{ m.lastTestedSnippet }}"</p>
                            }
                          </div>
                        </div>
                      }
                    </div>

                    <!-- Card Actions: Test Probe + Task Assignment Controls -->
                    <div class="pt-3 border-t border-gray-100 flex flex-col gap-2">
                      <div class="flex items-center justify-between gap-2">
                        <!-- Ping Test Button -->
                        <button
                          (click)="probeModel(m)"
                          [disabled]="probingId() === m.id"
                          class="px-2.5 py-1 text-[11px] font-medium rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors flex items-center gap-1.5"
                          title="Send a quick probe prompt to verify real latency"
                        >
                          @if (probingId() === m.id) {
                            <svg class="animate-spin h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Pinging...
                          } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                            Ping Test
                          }
                        </button>

                        <!-- Key Setup Quick Link if key needed -->
                        @if (m.keyRequirement === 'free-key' && !hasKeyForModel(m)) {
                          <button
                            (click)="openKeyVaultForProvider(m.category)"
                            class="text-[11px] text-amber-700 hover:text-amber-800 font-semibold underline decoration-amber-300"
                          >
                            Add Free Key
                          </button>
                        }
                      </div>

                      <!-- 4-Engine Task Routing Buttons -->
                      <div class="flex items-center justify-between gap-1 pt-1">
                        <span class="text-[10px] font-medium text-gray-400">Route to:</span>
                        <div class="flex gap-1 flex-wrap justify-end">
                          <button
                            (click)="assignRole('grammar', m.id)"
                            [class.bg-purple-600]="modelService.taskRoles().grammarModelId === m.id"
                            [class.text-white]="modelService.taskRoles().grammarModelId === m.id"
                            [class.bg-gray-100]="modelService.taskRoles().grammarModelId !== m.id"
                            [class.text-gray-700]="modelService.taskRoles().grammarModelId !== m.id"
                            class="px-2 py-0.5 text-[10px] font-medium rounded hover:opacity-90 transition-colors"
                            title="Assign to Linguix Grammar & Proofreading"
                          >
                            Grammar
                          </button>
                          <button
                            (click)="assignRole('drafting', m.id)"
                            [class.bg-indigo-600]="modelService.taskRoles().draftingModelId === m.id"
                            [class.text-white]="modelService.taskRoles().draftingModelId === m.id"
                            [class.bg-gray-100]="modelService.taskRoles().draftingModelId !== m.id"
                            [class.text-gray-700]="modelService.taskRoles().draftingModelId !== m.id"
                            class="px-2 py-0.5 text-[10px] font-medium rounded hover:opacity-90 transition-colors"
                            title="Assign to Notion Slash Drafting & Expand"
                          >
                            Drafting
                          </button>
                          <button
                            (click)="assignRole('paraphrase', m.id)"
                            [class.bg-teal-600]="modelService.taskRoles().paraphraseModelId === m.id"
                            [class.text-white]="modelService.taskRoles().paraphraseModelId === m.id"
                            [class.bg-gray-100]="modelService.taskRoles().paraphraseModelId !== m.id"
                            [class.text-gray-700]="modelService.taskRoles().paraphraseModelId !== m.id"
                            class="px-2 py-0.5 text-[10px] font-medium rounded hover:opacity-90 transition-colors"
                            title="Assign to Register-Aware Paraphrasing Engine"
                          >
                            Paraphrase
                          </button>
                          <button
                            (click)="assignRole('chat', m.id)"
                            [class.bg-sky-600]="modelService.taskRoles().chatModelId === m.id"
                            [class.text-white]="modelService.taskRoles().chatModelId === m.id"
                            [class.bg-gray-100]="modelService.taskRoles().chatModelId !== m.id"
                            [class.text-gray-700]="modelService.taskRoles().chatModelId !== m.id"
                            class="px-2 py-0.5 text-[10px] font-medium rounded hover:opacity-90 transition-colors"
                            title="Assign to Eloqui Assistant Chat"
                          >
                            Chat
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                }
              </div>
            </div>
          }

          <!-- ============================================== -->
          <!-- TAB 2: CUSTOM & LOCAL MODELS                   -->
          <!-- ============================================== -->
          @if (activeTab() === 'custom') {
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700">Self-Hosted & Private Custom Endpoints</h3>
                  <p class="text-xs text-gray-500">Connect local Ollama nodes (11434), LM Studio (1234), vLLM, or Hugging Face private endpoints</p>
                </div>
                <button
                  (click)="isAddingCustom.set(!isAddingCustom())"
                  class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {{ isAddingCustom() ? 'Cancel' : 'Add Custom Endpoint' }}
                </button>
              </div>

              <!-- Presets quick-fill -->
              @if (isAddingCustom()) {
                <div class="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-4 animate-in fade-in duration-150">
                  <div class="flex flex-wrap items-center justify-between border-b border-indigo-100 pb-2 gap-2">
                    <span class="text-xs font-bold text-indigo-950 uppercase tracking-wider">Configure Custom Model Endpoint</span>
                    <div class="flex items-center gap-2">
                      <span class="text-[11px] text-gray-500">Presets:</span>
                      <button (click)="applyPreset('ollama')" class="px-2 py-0.5 text-[10px] font-medium rounded bg-white border border-gray-200 hover:bg-gray-50">Local Ollama</button>
                      <button (click)="applyPreset('lmstudio')" class="px-2 py-0.5 text-[10px] font-medium rounded bg-white border border-gray-200 hover:bg-gray-50">LM Studio</button>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Model Name / Identifier</label>
                      <input type="text" [(ngModel)]="newModel.name" placeholder="e.g. llama3.3:70b or my-model" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"/>
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Provider Protocol</label>
                      <select [(ngModel)]="newModel.providerType" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs">
                        <option value="ollama">Ollama (Native Local Node)</option>
                        <option value="openai-compatible">OpenAI-Compatible Endpoint</option>
                        <option value="custom-endpoint">Custom HTTP Endpoint</option>
                      </select>
                    </div>
                    <div class="md:col-span-2">
                      <label class="block font-medium text-gray-700 mb-1">Endpoint URL</label>
                      <input type="text" [(ngModel)]="newModel.endpointUrl" placeholder="http://localhost:11434/v1/chat/completions" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono"/>
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">API Key (Optional / Private)</label>
                      <input type="password" [(ngModel)]="newModel.apiKey" placeholder="Bearer key if protected" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"/>
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Context Window (Tokens)</label>
                      <input type="number" [(ngModel)]="newModel.contextWindow" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"/>
                    </div>
                    <div class="md:col-span-2">
                      <label class="block font-medium text-gray-700 mb-1">Description / Notes</label>
                      <input type="text" [(ngModel)]="newModel.description" placeholder="Notes on model specialization, quantized size, etc." class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"/>
                    </div>
                  </div>

                  <div class="flex justify-end gap-2 pt-2 border-t border-indigo-100">
                    <button (click)="isAddingCustom.set(false)" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button (click)="saveNewCustomModel()" class="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-xs">Save Model</button>
                  </div>
                </div>
              }

              <!-- Existing Custom Models List -->
              <div class="space-y-3">
                @if (modelService.customModels().length === 0 && !isAddingCustom()) {
                  <div class="p-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <p class="text-xs text-gray-500 font-medium">No custom models configured yet.</p>
                    <p class="text-[11px] text-gray-400 mt-1">Add your local Ollama node or private vLLM endpoint to write with complete data privacy.</p>
                  </div>
                }

                @for (m of modelService.customModels(); track m.id) {
                  <div class="border border-gray-200 rounded-xl p-4 bg-white shadow-xs space-y-3">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="flex items-center gap-2">
                          <h4 class="text-sm font-semibold text-gray-900">{{ m.name }}</h4>
                          <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-100 text-purple-700">{{ m.providerType }}</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">{{ m.description }}</p>
                        <div class="text-[11px] font-mono text-gray-400 mt-1 truncate max-w-lg">{{ m.endpointUrl }}</div>
                      </div>

                      <div class="flex items-center gap-2">
                        <button
                          (click)="testCustomModel(m)"
                          [disabled]="testingCustomId() === m.id"
                          class="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1 text-gray-700"
                        >
                          @if (testingCustomId() === m.id) {
                            <svg class="animate-spin h-3.5 w-3.5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Pinging...
                          } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                            Test Ping
                          }
                        </button>
                        
                        <button
                          (click)="deleteModel(m.id)"
                          class="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remove model"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>

                    @if (m.testedLatencyMs) {
                      <div class="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md w-fit">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Reachable ({{ m.testedLatencyMs }}ms round-trip)
                      </div>
                    }

                    <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span class="text-[11px] text-gray-400">Assign to Task:</span>
                      <div class="flex gap-1">
                        <button
                          (click)="assignRole('grammar', m.id)"
                          [class.bg-purple-600]="modelService.taskRoles().grammarModelId === m.id"
                          [class.text-white]="modelService.taskRoles().grammarModelId === m.id"
                          [class.bg-gray-100]="modelService.taskRoles().grammarModelId !== m.id"
                          [class.text-gray-700]="modelService.taskRoles().grammarModelId !== m.id"
                          class="px-2 py-1 text-[10px] font-medium rounded hover:opacity-90"
                        >
                          Grammar
                        </button>
                        <button
                          (click)="assignRole('drafting', m.id)"
                          [class.bg-indigo-600]="modelService.taskRoles().draftingModelId === m.id"
                          [class.text-white]="modelService.taskRoles().draftingModelId === m.id"
                          [class.bg-gray-100]="modelService.taskRoles().draftingModelId !== m.id"
                          [class.text-gray-700]="modelService.taskRoles().draftingModelId !== m.id"
                          class="px-2 py-1 text-[10px] font-medium rounded hover:opacity-90"
                        >
                          Drafting
                        </button>
                        <button
                          (click)="assignRole('paraphrase', m.id)"
                          [class.bg-teal-600]="modelService.taskRoles().paraphraseModelId === m.id"
                          [class.text-white]="modelService.taskRoles().paraphraseModelId === m.id"
                          [class.bg-gray-100]="modelService.taskRoles().paraphraseModelId !== m.id"
                          [class.text-gray-700]="modelService.taskRoles().paraphraseModelId !== m.id"
                          class="px-2 py-1 text-[10px] font-medium rounded hover:opacity-90"
                        >
                          Paraphrase
                        </button>
                        <button
                          (click)="assignRole('chat', m.id)"
                          [class.bg-sky-600]="modelService.taskRoles().chatModelId === m.id"
                          [class.text-white]="modelService.taskRoles().chatModelId === m.id"
                          [class.bg-gray-100]="modelService.taskRoles().chatModelId !== m.id"
                          [class.text-gray-700]="modelService.taskRoles().chatModelId !== m.id"
                          class="px-2 py-1 text-[10px] font-medium rounded hover:opacity-90"
                        >
                          Chat
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- ============================================== -->
          <!-- TAB 3: TASK ROLE MATRIX                        -->
          <!-- ============================================== -->
          @if (activeTab() === 'assignments') {
            <div class="space-y-4">
              <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
                <div>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-gray-800">Active Task Routing Matrix</h3>
                  <p class="text-xs text-gray-500">Each writing intelligence feature can be independently mapped to the optimal model for speed, depth, or creative style.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- 1. Grammar & Clarity Engine -->
                  <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-purple-600"></span>
                        Linguix Grammar & Clarity
                      </span>
                      <span class="text-[10px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">Active</span>
                    </div>
                    <p class="text-xs text-gray-500">Powers continuous spelling, typo detection, stylistic conciseness, and passive-to-active transformations.</p>
                    <div>
                      <label class="block text-[10px] font-medium text-gray-400 mb-1">Assigned Model</label>
                      <select
                        [ngModel]="modelService.taskRoles().grammarModelId"
                        (ngModelChange)="assignRole('grammar', $event)"
                        class="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:bg-white focus:outline-none"
                      >
                        <optgroup label="Curated Free Models">
                          @for (m of modelService.freeModels; track m.id) {
                            <option [value]="m.id">{{ m.name }} ({{ m.provider }})</option>
                          }
                        </optgroup>
                        @if (modelService.customModels().length > 0) {
                          <optgroup label="Custom Endpoints">
                            @for (cm of modelService.customModels(); track cm.id) {
                              <option [value]="cm.id">{{ cm.name }}</option>
                            }
                          </optgroup>
                        }
                      </select>
                    </div>
                  </div>

                  <!-- 2. Drafting & Expansion Engine -->
                  <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                        Notion Slash (/) Drafting
                      </span>
                      <span class="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">Active</span>
                    </div>
                    <p class="text-xs text-gray-500">Powers inline block generation, chapter continue, dialogue expand, and scene drafting.</p>
                    <div>
                      <label class="block text-[10px] font-medium text-gray-400 mb-1">Assigned Model</label>
                      <select
                        [ngModel]="modelService.taskRoles().draftingModelId"
                        (ngModelChange)="assignRole('drafting', $event)"
                        class="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:bg-white focus:outline-none"
                      >
                        <optgroup label="Curated Free Models">
                          @for (m of modelService.freeModels; track m.id) {
                            <option [value]="m.id">{{ m.name }} ({{ m.provider }})</option>
                          }
                        </optgroup>
                        @if (modelService.customModels().length > 0) {
                          <optgroup label="Custom Endpoints">
                            @for (cm of modelService.customModels(); track cm.id) {
                              <option [value]="cm.id">{{ cm.name }}</option>
                            }
                          </optgroup>
                        }
                      </select>
                    </div>
                  </div>

                  <!-- 3. Paraphrasing & Register Alternatives Engine -->
                  <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-teal-600"></span>
                        Register-Aware Paraphrasing
                      </span>
                      <span class="text-[10px] font-semibold px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded">Active</span>
                    </div>
                    <p class="text-xs text-gray-500">Provides natural, human-sounding rephrasing tailored to Novels (SFW/NSFW), Academic, and Legal registers.</p>
                    <div>
                      <label class="block text-[10px] font-medium text-gray-400 mb-1">Assigned Model</label>
                      <select
                        [ngModel]="modelService.taskRoles().paraphraseModelId"
                        (ngModelChange)="assignRole('paraphrase', $event)"
                        class="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:bg-white focus:outline-none"
                      >
                        <optgroup label="Curated Free Models">
                          @for (m of modelService.freeModels; track m.id) {
                            <option [value]="m.id">{{ m.name }} ({{ m.provider }})</option>
                          }
                        </optgroup>
                        @if (modelService.customModels().length > 0) {
                          <optgroup label="Custom Endpoints">
                            @for (cm of modelService.customModels(); track cm.id) {
                              <option [value]="cm.id">{{ cm.name }}</option>
                            }
                          </optgroup>
                        }
                      </select>
                    </div>
                  </div>

                  <!-- 4. Eloqui Conversational Assistant Chat -->
                  <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-sky-600"></span>
                        Eloqui Assistant Chat
                      </span>
                      <span class="text-[10px] font-semibold px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded">Active</span>
                    </div>
                    <p class="text-xs text-gray-500">Powers the manuscript sidebar dialogue, context-grounded book Q&A, and plot brainstorming.</p>
                    <div>
                      <label class="block text-[10px] font-medium text-gray-400 mb-1">Assigned Model</label>
                      <select
                        [ngModel]="modelService.taskRoles().chatModelId"
                        (ngModelChange)="assignRole('chat', $event)"
                        class="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:bg-white focus:outline-none"
                      >
                        <optgroup label="Curated Free Models">
                          @for (m of modelService.freeModels; track m.id) {
                            <option [value]="m.id">{{ m.name }} ({{ m.provider }})</option>
                          }
                        </optgroup>
                        @if (modelService.customModels().length > 0) {
                          <optgroup label="Custom Endpoints">
                            @for (cm of modelService.customModels(); track cm.id) {
                              <option [value]="cm.id">{{ cm.name }}</option>
                            }
                          </optgroup>
                        }
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- ============================================== -->
          <!-- TAB 4: FREE KEY VAULT                          -->
          <!-- ============================================== -->
          @if (activeTab() === 'vault') {
            <div class="space-y-4">
              <div class="bg-amber-50/70 border border-amber-200/70 rounded-xl p-4 flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-700 mt-0.5 shrink-0"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <div class="text-xs text-amber-900 leading-relaxed">
                  <strong>Zero-Cost Developer Accounts:</strong> Providers like <strong>Groq</strong> and <strong>OpenRouter</strong> offer permanently free tiers with generous daily request quotas without requiring a credit card. Keys are securely stored client-side in your AES-256 encrypted vault.
                </div>
              </div>

              <div class="space-y-4">
                <!-- Groq Key Card -->
                <div class="p-4 border border-gray-200 rounded-xl bg-white shadow-xs space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <h4 class="text-xs font-bold text-gray-900">Groq Cloud (14,400 Requests/Day Free)</h4>
                      <p class="text-[11px] text-gray-500">Unlocks Llama 3.3 70B Versatile, Llama 3.1 8B Instant, and Mixtral at wafer speeds (300-800 tok/s).</p>
                    </div>
                    <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                      Get Free Key
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      type="password"
                      [ngModel]="groqKeyInput()"
                      (ngModelChange)="groqKeyInput.set($event)"
                      placeholder="gsk_..."
                      class="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono"
                    />
                    <button
                      (click)="saveVaultKey('groq', groqKeyInput())"
                      class="px-4 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Save Key
                    </button>
                  </div>
                </div>

                <!-- OpenRouter Key Card -->
                <div class="p-4 border border-gray-200 rounded-xl bg-white shadow-xs space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <h4 class="text-xs font-bold text-gray-900">OpenRouter (Free Community Models)</h4>
                      <p class="text-[11px] text-gray-500">Unlocks DeepSeek R1 :free, Qwen 2.5 72B :free, and Hermes 3 405B :free.</p>
                    </div>
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                      Get Free Key
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      type="password"
                      [ngModel]="openRouterKeyInput()"
                      (ngModelChange)="openRouterKeyInput.set($event)"
                      placeholder="sk-or-v1-..."
                      class="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono"
                    />
                    <button
                      (click)="saveVaultKey('openrouter', openRouterKeyInput())"
                      class="px-4 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Save Key
                    </button>
                  </div>
                </div>

                <!-- Cerebras Key Card -->
                <div class="p-4 border border-gray-200 rounded-xl bg-white shadow-xs space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <h4 class="text-xs font-bold text-gray-900">Cerebras Wafer-Scale Cloud (Free Developer Tier)</h4>
                      <p class="text-[11px] text-gray-500">Unlocks 1,800 tokens/sec wafer-scale inference for Llama 3.3 70B.</p>
                    </div>
                    <a href="https://cloud.cerebras.ai" target="_blank" rel="noopener noreferrer" class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                      Get Free Key
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      type="password"
                      [ngModel]="cerebrasKeyInput()"
                      (ngModelChange)="cerebrasKeyInput.set($event)"
                      placeholder="csk-..."
                      class="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono"
                    />
                    <button
                      (click)="saveVaultKey('cerebras', cerebrasKeyInput())"
                      class="px-4 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Save Key
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }

        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span class="text-xs text-gray-500">
            Current Primary Engine: <strong class="text-gray-800">{{ modelService.getModelNameById(modelService.taskRoles().draftingModelId) }}</strong>
          </span>
          <button (click)="close.emit()" class="px-5 py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 shadow-xs transition-colors">
            Done
          </button>
        </div>

      </div>
    </div>
  `
})
export class ModelsModalComponent {
  modelService = inject(ModelService);
  authService = inject(AuthService);
  cryptoService = inject(CryptoService);
  @Output() close = new EventEmitter<void>();

  activeTab = signal<'curated' | 'custom' | 'assignments' | 'vault'>('curated');
  selectedCategory = signal<ModelCategory | 'all'>('all');
  searchQuery = signal<string>('');
  isAddingCustom = signal<boolean>(false);
  probingId = signal<string | null>(null);
  testingCustomId = signal<string | null>(null);

  groqKeyInput = signal<string>(this.cryptoService.getActiveKeyForProvider('groq') || '');
  openRouterKeyInput = signal<string>(this.cryptoService.getActiveKeyForProvider('openrouter') || '');
  cerebrasKeyInput = signal<string>(this.cryptoService.getActiveKeyForProvider('cerebras') || '');

  newModel: CustomModel = {
    id: '',
    name: '',
    version: 'v1.0',
    description: '',
    architecture: 'Llama-3.3-8B',
    providerType: 'ollama',
    endpointUrl: 'http://localhost:11434/v1/chat/completions',
    contextWindow: 16384,
    temperature: 0.7,
    systemPrompt: 'You are Eloqui AI, an intelligent, privacy-first writing companion.',
    assignedTasks: { grammar: false, drafting: true, paraphrase: true, chat: false },
    createdAt: Date.now()
  };

  filteredModels = computed(() => {
    let list = this.modelService.freeModels;
    const cat = this.selectedCategory();
    if (cat !== 'all') {
      list = list.filter(m => m.category === cat);
    }
    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      list = list.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query) ||
        m.architecture.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query) ||
        m.capabilities.some(c => c.name.toLowerCase().includes(query))
      );
    }
    return list;
  });

  hasKeyForModel(m: CuratedModel): boolean {
    if (m.keyRequirement === 'none') return true;
    if (m.category === 'groq') return !!this.cryptoService.getActiveKeyForProvider('groq');
    if (m.category === 'openrouter') return !!this.cryptoService.getActiveKeyForProvider('openrouter');
    if (m.category === 'cerebras') return !!this.cryptoService.getActiveKeyForProvider('cerebras');
    if (m.category === 'gemini') return true; // Default server key provides access
    return true;
  }

  openKeyVaultForProvider(category: ModelCategory) {
    this.activeTab.set('vault');
  }

  saveVaultKey(provider: 'groq' | 'openrouter' | 'cerebras', key: string) {
    if (!key.trim()) return;
    const config: ApiKeyConfig = {
      provider: provider as any,
      name: `${provider.toUpperCase()} Key`,
      key: key.trim(),
      isActive: true,
      addedAt: Date.now()
    };
    this.cryptoService.saveApiKey(config);
  }

  assignRole(task: 'grammar' | 'drafting' | 'paraphrase' | 'chat', modelId: string) {
    const map: Record<'grammar' | 'drafting' | 'paraphrase' | 'chat', keyof TaskModelConfig> = {
      grammar: 'grammarModelId',
      drafting: 'draftingModelId',
      paraphrase: 'paraphraseModelId',
      chat: 'chatModelId'
    };
    this.modelService.setTaskRole(map[task], modelId);
  }

  async probeModel(m: CuratedModel) {
    this.probingId.set(m.id);
    await this.modelService.testModelProbe(m.id);
    this.probingId.set(null);
  }

  async testCustomModel(model: CustomModel) {
    this.testingCustomId.set(model.id);
    await this.modelService.testModelConnection(model);
    this.testingCustomId.set(null);
  }

  applyPreset(type: 'ollama' | 'lmstudio') {
    if (type === 'ollama') {
      this.newModel.name = 'llama3.3:latest';
      this.newModel.architecture = 'Llama-3.3';
      this.newModel.providerType = 'ollama';
      this.newModel.endpointUrl = 'http://localhost:11434/v1/chat/completions';
      this.newModel.description = 'Local private Ollama server (zero data transmission)';
      this.newModel.contextWindow = 32768;
    } else if (type === 'lmstudio') {
      this.newModel.name = 'local-model';
      this.newModel.architecture = 'GGUF-Local';
      this.newModel.providerType = 'openai-compatible';
      this.newModel.endpointUrl = 'http://localhost:1234/v1/chat/completions';
      this.newModel.description = 'LM Studio local OpenAI-compatible inference server';
      this.newModel.contextWindow = 16384;
    }
  }

  deleteModel(id: string) {
    if (confirm('Delete this custom model endpoint?')) {
      this.modelService.deleteCustomModel(id);
    }
  }

  saveNewCustomModel() {
    if (!this.newModel.name.trim()) {
      alert('Please provide a name or identifier for the custom model.');
      return;
    }
    const modelToSave: CustomModel = {
      ...this.newModel,
      id: 'cm_' + Math.random().toString(36).substring(2, 9),
      createdAt: Date.now()
    };
    this.modelService.saveCustomModel(modelToSave);
    this.isAddingCustom.set(false);
  }
}
