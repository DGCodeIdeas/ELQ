import { Component, ChangeDetectionStrategy, inject, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModelService, CuratedModel, CustomModel, TaskModelConfig } from '../../services/model.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-models-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" (click)="close.emit()"></div>

      <div class="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h6"/>
              </svg>
            </div>
            <div>
              <h2 class="text-base font-semibold text-gray-900">Language Model Hub</h2>
              <p class="text-xs text-gray-500">Manage free pre-trained models, private custom endpoints, and role routing</p>
            </div>
          </div>
          
          <button (click)="close.emit()" class="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex border-b border-gray-200 bg-white px-6">
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
            Custom & BYOK Models ({{ modelService.customModels().length }})
          </button>

          <button
            (click)="activeTab.set('assignments')"
            [class.border-indigo-600]="activeTab() === 'assignments'"
            [class.text-indigo-600]="activeTab() === 'assignments'"
            [class.text-gray-500]="activeTab() !== 'assignments'"
            class="py-3 px-4 text-xs font-semibold border-b-2 border-transparent hover:text-gray-700 transition-colors flex items-center gap-2 ml-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Task Role Assignment
          </button>
        </div>

        <!-- Tab Body -->
        <div class="overflow-y-auto p-6 flex-1 space-y-4">

          <!-- TAB 1: CURATED FREE MODELS -->
          @if (activeTab() === 'curated') {
            <div class="space-y-4">
              <div class="bg-blue-50/70 border border-blue-200/70 rounded-xl p-3.5 flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div class="text-xs text-blue-900 leading-relaxed">
                  <strong>Zero-Cost Pre-Trained Models:</strong> These models require no paid subscription or credit card. They are immediately available for grammar checks, text expansion, and document drafting.
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (m of modelService.freeModels; track m.id) {
                  <div class="border border-gray-200 rounded-xl p-4 bg-white shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3">
                    <div>
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <div class="flex items-center gap-2">
                            <h3 class="font-semibold text-gray-900 text-sm">{{ m.name }}</h3>
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">FREE</span>
                          </div>
                          <span class="text-[11px] text-gray-400">{{ m.provider }} • {{ m.version }}</span>
                        </div>
                        <span class="text-[10px] font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">{{ m.contextWindow }}</span>
                      </div>

                      <p class="text-xs text-gray-600 mt-2 leading-relaxed">{{ m.description }}</p>

                      <!-- Capabilities -->
                      <div class="flex flex-wrap gap-1.5 mt-3">
                        @for (cap of m.capabilities; track cap.name) {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" [class]="cap.badgeColor">
                            {{ cap.name }}
                          </span>
                        }
                      </div>

                      <!-- Limitations -->
                      <div class="mt-3 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <span class="font-semibold text-gray-600 block mb-1">Capabilities & Limitations:</span>
                        <ul class="list-disc list-inside space-y-0.5">
                          @for (lim of m.limitations; track lim) {
                            <li>{{ lim }}</li>
                          }
                        </ul>
                      </div>
                    </div>

                    <!-- Task Assignment Quick Actions -->
                    <div class="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                      <span class="text-[11px] font-medium text-gray-400">Use model for:</span>
                      <div class="flex gap-1">
                        <button
                          (click)="assignRole('grammar', m.id)"
                          [class.bg-purple-600]="modelService.taskRoles().grammarModelId === m.id"
                          [class.text-white]="modelService.taskRoles().grammarModelId === m.id"
                          [class.bg-gray-100]="modelService.taskRoles().grammarModelId !== m.id"
                          [class.text-gray-700]="modelService.taskRoles().grammarModelId !== m.id"
                          class="px-2 py-1 text-[10px] font-medium rounded hover:opacity-90 transition-colors"
                          title="Assign to Linguix Grammar & Style"
                        >
                          Grammar
                        </button>
                        <button
                          (click)="assignRole('drafting', m.id)"
                          [class.bg-indigo-600]="modelService.taskRoles().draftingModelId === m.id"
                          [class.text-white]="modelService.taskRoles().draftingModelId === m.id"
                          [class.bg-gray-100]="modelService.taskRoles().draftingModelId !== m.id"
                          [class.text-gray-700]="modelService.taskRoles().draftingModelId !== m.id"
                          class="px-2 py-1 text-[10px] font-medium rounded hover:opacity-90 transition-colors"
                          title="Assign to Notion Slash Drafting"
                        >
                          Drafting
                        </button>
                        <button
                          (click)="assignRole('chat', m.id)"
                          [class.bg-sky-600]="modelService.taskRoles().chatModelId === m.id"
                          [class.text-white]="modelService.taskRoles().chatModelId === m.id"
                          [class.bg-gray-100]="modelService.taskRoles().chatModelId !== m.id"
                          [class.text-gray-700]="modelService.taskRoles().chatModelId !== m.id"
                          class="px-2 py-1 text-[10px] font-medium rounded hover:opacity-90 transition-colors"
                          title="Assign to Eloqui Chat Assistant"
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

          <!-- TAB 2: CUSTOM & BYOK MODELS -->
          @if (activeTab() === 'custom') {
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700">Self-Hosted & Private Custom Models</h3>
                  <p class="text-xs text-gray-500">Connect local Ollama nodes, vLLM, HuggingFace inference, or fine-tuned weights</p>
                </div>
                <button
                  (click)="isAddingCustom.set(!isAddingCustom())"
                  class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {{ isAddingCustom() ? 'Cancel' : 'Upload / Add Model' }}
                </button>
              </div>

              <!-- Add/Upload Custom Model Form -->
              @if (isAddingCustom()) {
                <div class="border border-indigo-200 bg-indigo-50/30 rounded-xl p-4 space-y-4 animate-in fade-in duration-150">
                  <div class="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <span class="text-xs font-bold text-indigo-950 uppercase tracking-wider">Configure Custom Model Endpoint</span>
                    <!-- Model Spec / Weights Upload Helper -->
                    <label class="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer transition-colors flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Import Spec (.json / .gguf)
                      <input type="file" accept=".json,.gguf,.bin" (change)="onSpecFileUpload($event)" class="hidden"/>
                    </label>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Model Display Name</label>
                      <input type="text" [(ngModel)]="newModel.name" placeholder="e.g. My Private Llama-3 70B" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"/>
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Version</label>
                      <input type="text" [(ngModel)]="newModel.version" placeholder="e.g. v2.1-fp16" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"/>
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Architecture / Base</label>
                      <input type="text" [(ngModel)]="newModel.architecture" placeholder="e.g. Llama-3, Mistral, Qwen, DeepSeek" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"/>
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Provider Protocol</label>
                      <select [(ngModel)]="newModel.providerType" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs">
                        <option value="ollama">Ollama (localhost:11434)</option>
                        <option value="openai-compatible">OpenAI-Compatible Endpoint</option>
                        <option value="gemini-finetuned">Gemini Fine-Tuned Model</option>
                        <option value="custom-endpoint">Custom HTTP Inference API</option>
                      </select>
                    </div>
                    <div class="md:col-span-2">
                      <label class="block font-medium text-gray-700 mb-1">Endpoint URL</label>
                      <input type="text" [(ngModel)]="newModel.endpointUrl" placeholder="http://localhost:11434/v1/chat/completions" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono"/>
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">API Bearer Key (Optional / BYOK)</label>
                      <input type="password" [(ngModel)]="newModel.apiKey" placeholder="sk-..." class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"/>
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Context Window (Tokens)</label>
                      <input type="number" [(ngModel)]="newModel.contextWindow" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"/>
                    </div>
                    <div class="md:col-span-2">
                      <label class="block font-medium text-gray-700 mb-1">Description</label>
                      <input type="text" [(ngModel)]="newModel.description" placeholder="Short description of this model's capabilities and privacy guarantees" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"/>
                    </div>
                    <div class="md:col-span-2">
                      <label class="block font-medium text-gray-700 mb-1">System Prompt / Identity Instruction</label>
                      <textarea [(ngModel)]="newModel.systemPrompt" rows="2" placeholder="Custom instructions for tone, grammar, and zero data leakage" class="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"></textarea>
                    </div>
                  </div>

                  <div class="flex justify-end gap-2 pt-2 border-t border-indigo-100">
                    <button (click)="isAddingCustom.set(false)" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button (click)="saveNewCustomModel()" class="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm">Save Model</button>
                  </div>
                </div>
              }

              <!-- List Existing Custom Models -->
              <div class="space-y-3">
                @for (m of modelService.customModels(); track m.id) {
                  <div class="border border-gray-200 rounded-xl p-4 bg-white shadow-xs space-y-3">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="flex items-center gap-2">
                          <h4 class="text-sm font-semibold text-gray-900">{{ m.name }}</h4>
                          <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-100 text-purple-700">{{ m.architecture }}</span>
                          <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">{{ m.version }}</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">{{ m.description }}</p>
                        <div class="text-[11px] font-mono text-gray-400 mt-1 truncate max-w-lg">{{ m.endpointUrl }}</div>
                      </div>

                      <div class="flex items-center gap-2">
                        <!-- Test Connection Button -->
                        <button
                          (click)="testCustomModel(m)"
                          [disabled]="testingId() === m.id"
                          class="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1 text-gray-700"
                        >
                          @if (testingId() === m.id) {
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

                    <!-- Latency & Status -->
                    @if (m.testedLatencyMs) {
                      <div class="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md w-fit">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Status: Active & Reachable ({{ m.testedLatencyMs }}ms response)
                      </div>
                    }

                    <!-- Task Assignment Controls for Custom Model -->
                    <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span class="text-[11px] text-gray-400">Assign to Task:</span>
                      <div class="flex gap-1.5">
                        <button
                          (click)="assignRole('grammar', m.id)"
                          [class.bg-purple-600]="modelService.taskRoles().grammarModelId === m.id"
                          [class.text-white]="modelService.taskRoles().grammarModelId === m.id"
                          [class.bg-gray-100]="modelService.taskRoles().grammarModelId !== m.id"
                          [class.text-gray-700]="modelService.taskRoles().grammarModelId !== m.id"
                          class="px-2.5 py-1 text-[10px] font-medium rounded hover:opacity-90"
                        >
                          Grammar
                        </button>
                        <button
                          (click)="assignRole('drafting', m.id)"
                          [class.bg-indigo-600]="modelService.taskRoles().draftingModelId === m.id"
                          [class.text-white]="modelService.taskRoles().draftingModelId === m.id"
                          [class.bg-gray-100]="modelService.taskRoles().draftingModelId !== m.id"
                          [class.text-gray-700]="modelService.taskRoles().draftingModelId !== m.id"
                          class="px-2.5 py-1 text-[10px] font-medium rounded hover:opacity-90"
                        >
                          Drafting
                        </button>
                        <button
                          (click)="assignRole('chat', m.id)"
                          [class.bg-sky-600]="modelService.taskRoles().chatModelId === m.id"
                          [class.text-white]="modelService.taskRoles().chatModelId === m.id"
                          [class.bg-gray-100]="modelService.taskRoles().chatModelId !== m.id"
                          [class.text-gray-700]="modelService.taskRoles().chatModelId !== m.id"
                          class="px-2.5 py-1 text-[10px] font-medium rounded hover:opacity-90"
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

          <!-- TAB 3: TASK ROLE ASSIGNMENTS OVERVIEW -->
          @if (activeTab() === 'assignments') {
            <div class="space-y-4">
              <div class="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700">Active Task Routing Matrix</h3>
                <p class="text-xs text-gray-500">Configure which model executes each specific writing intelligence feature</p>

                <!-- Grammar Engine -->
                <div class="bg-white p-3.5 rounded-lg border border-gray-200 flex items-center justify-between">
                  <div>
                    <span class="text-xs font-bold text-purple-900 block">Linguix Grammar & Clarity Engine</span>
                    <span class="text-[11px] text-gray-500">Powering instant spelling, style, vocabulary, and grammar overlays</span>
                  </div>
                  <span class="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md">
                    {{ modelService.getModelNameById(modelService.taskRoles().grammarModelId) }}
                  </span>
                </div>

                <!-- Drafting Engine -->
                <div class="bg-white p-3.5 rounded-lg border border-gray-200 flex items-center justify-between">
                  <div>
                    <span class="text-xs font-bold text-indigo-900 block">Notion Slash (/) Drafting & Expansion</span>
                    <span class="text-[11px] text-gray-500">Powers block completions, creative drafting, and chapter outlines</span>
                  </div>
                  <span class="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                    {{ modelService.getModelNameById(modelService.taskRoles().draftingModelId) }}
                  </span>
                </div>

                <!-- Chat Engine -->
                <div class="bg-white p-3.5 rounded-lg border border-gray-200 flex items-center justify-between">
                  <div>
                    <span class="text-xs font-bold text-sky-900 block">Eloqui Conversational Assistant</span>
                    <span class="text-[11px] text-gray-500">Powers sidebar contextual book Q&A and RAG search</span>
                  </div>
                  <span class="text-xs font-semibold px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-md">
                    {{ modelService.getModelNameById(modelService.taskRoles().chatModelId) }}
                  </span>
                </div>
              </div>
            </div>
          }

        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button (click)="close.emit()" class="px-4 py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800">
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
  @Output() close = new EventEmitter<void>();

  activeTab = signal<'curated' | 'custom' | 'assignments'>('curated');
  isAddingCustom = signal<boolean>(false);
  testingId = signal<string | null>(null);

  newModel: CustomModel = {
    id: '',
    name: '',
    version: 'v1.0',
    description: '',
    architecture: 'Llama-3-8B',
    providerType: 'ollama',
    endpointUrl: 'http://localhost:11434/v1/chat/completions',
    contextWindow: 16384,
    temperature: 0.7,
    systemPrompt: 'You are Eloqui AI, an intelligent, privacy-first writing assistant.',
    assignedTasks: { grammar: false, drafting: true, chat: false },
    createdAt: Date.now()
  };

  assignRole(task: 'grammar' | 'drafting' | 'chat', modelId: string) {
    const map: Record<'grammar' | 'drafting' | 'chat', keyof TaskModelConfig> = {
      grammar: 'grammarModelId',
      drafting: 'draftingModelId',
      chat: 'chatModelId'
    };
    this.modelService.setTaskRole(map[task], modelId);
  }

  async testCustomModel(model: CustomModel) {
    this.testingId.set(model.id);
    await this.modelService.testModelConnection(model);
    this.testingId.set(null);
  }

  deleteModel(id: string) {
    if (confirm('Delete this custom model configuration?')) {
      this.modelService.deleteCustomModel(id);
    }
  }

  saveNewCustomModel() {
    if (!this.newModel.name.trim()) {
      alert('Please provide a name for the custom model.');
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

  onSpecFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed.name) this.newModel.name = parsed.name;
          if (parsed.version) this.newModel.version = parsed.version;
          if (parsed.architecture) this.newModel.architecture = parsed.architecture;
          if (parsed.endpointUrl) this.newModel.endpointUrl = parsed.endpointUrl;
          if (parsed.contextWindow) this.newModel.contextWindow = parsed.contextWindow;
          if (parsed.description) this.newModel.description = parsed.description;
        } catch (err) {
          console.warn('Failed to parse model JSON', err);
        }
      };
      reader.readAsText(file);
    } else {
      // GGUF or binary metadata
      this.newModel.name = file.name.replace(/\.[^/.]+$/, '');
      this.newModel.description = `Imported binary weights file: ${file.name} (${Math.round(file.size / (1024 * 1024))} MB)`;
      this.newModel.architecture = 'GGUF-Local';
    }
  }
}
