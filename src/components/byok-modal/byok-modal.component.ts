import { Component, ChangeDetectionStrategy, inject, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CryptoService, ApiKeyConfig } from '../../services/crypto.service';
import { PrivacyService } from '../../services/privacy.service';

@Component({
  selector: 'app-byok-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" (click)="close.emit()"></div>

      <div class="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 2l-2 2m-1-1l-3 3m2 2l-3 3m2 2l-3 3M3 13a7 7 0 1 0 14 0 7 7 0 1 0-14 0z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-base font-semibold text-gray-900">BYOK & Zero-Knowledge Cryptography</h2>
              <p class="text-xs text-gray-500">Bring Your Own Key encryption at rest and direct provider transit</p>
            </div>
          </div>
          
          <button (click)="close.emit()" class="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="overflow-y-auto p-6 space-y-6 flex-1">

          <!-- Cryptographic Architecture Banner -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- At Rest -->
            <div class="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5">
              <div class="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Encryption At Rest
              </div>
              <p class="text-xs text-gray-600">
                All document blocks, chapters, and chats are encrypted using <strong>AES-GCM-256</strong> on your device before writing to IndexedDB.
              </p>
              <div class="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded w-fit">
                Algorithm: AES-GCM 256-bit + IV
              </div>
            </div>

            <!-- In Transit -->
            <div class="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5">
              <div class="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Encryption In Transit
              </div>
              <p class="text-xs text-gray-600">
                All model inference requests travel directly over <strong>TLS 1.3</strong> straight to the inference node with zero telemetry retention.
              </p>
              <div class="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded w-fit">
                Transport: TLS 1.3 Direct Outbound
              </div>
            </div>
          </div>

          <!-- Master Encryption Key Management -->
          <div class="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-800">Your Master Document Encryption Key</h3>
                <p class="text-xs text-gray-500">Only you hold this key. If lost, encrypted documents cannot be recovered.</p>
              </div>
              
              <!-- Toggle at-rest encryption -->
              <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                <span>Enable AES-256:</span>
                <input
                  type="checkbox"
                  [checked]="cryptoService.isAtRestEncryptionEnabled()"
                  (change)="toggleAtRest($event)"
                  class="sr-only peer"
                />
                <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 relative"></div>
              </label>
            </div>

            <!-- Key Fingerprint Display -->
            <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-gray-500">SHA-256 Fingerprint:</span>
                <span class="text-xs font-mono font-bold text-gray-900">{{ cryptoService.activeKeyFingerprint() }}</span>
              </div>
              <span class="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-medium">Active & Valid</span>
            </div>

            <!-- Key Actions -->
            <div class="flex flex-wrap gap-2 pt-1">
              <button
                (click)="revealKey.set(!revealKey())"
                class="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                {{ revealKey() ? 'Hide Raw Key' : 'Reveal Raw Key' }}
              </button>

              <button
                (click)="exportKeyFile()"
                class="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download .key File
              </button>

              <button
                (click)="generateNewKey()"
                class="px-3 py-1.5 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                Rotate / Generate Key
              </button>
            </div>

            @if (revealKey()) {
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1 animate-in fade-in duration-150">
                <span class="text-[11px] font-bold text-amber-900 block">Raw 256-bit Hex Key (Store Safely):</span>
                <input
                  type="text"
                  [value]="cryptoService.getRawKey()"
                  readonly
                  class="w-full font-mono text-xs p-2 bg-white border border-amber-300 rounded text-gray-800 select-all"
                />
              </div>
            }
          </div>

          <!-- Bring Your Own API Keys (BYOK LLM Providers) -->
          <div class="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-800">Bring Your Own API Keys (BYOK)</h3>
                <p class="text-xs text-gray-500">Configure personal API tokens for OpenAI, Anthropic, Groq, or OpenRouter</p>
              </div>
              <button
                (click)="isAddingKey.set(!isAddingKey())"
                class="px-3 py-1 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center gap-1"
              >
                + Add Key
              </button>
            </div>

            <!-- Add Key Form -->
            @if (isAddingKey()) {
              <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label class="block font-medium text-gray-700 mb-1">Provider</label>
                    <select [(ngModel)]="newKey.provider" class="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs">
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI (GPT-4o)</option>
                      <option value="groq">Groq (Ultra-fast Llama-3)</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="custom">Custom Endpoint</option>
                    </select>
                  </div>
                  <div>
                    <label class="block font-medium text-gray-700 mb-1">Key Label</label>
                    <input type="text" [(ngModel)]="newKey.name" placeholder="e.g. My Personal Production Key" class="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs"/>
                  </div>
                  <div class="sm:col-span-2">
                    <label class="block font-medium text-gray-700 mb-1">API Secret Key</label>
                    <input type="password" [(ngModel)]="newKey.key" placeholder="sk-..." class="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-mono"/>
                  </div>
                </div>

                <div class="flex justify-end gap-2">
                  <button (click)="isAddingKey.set(false)" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg">Cancel</button>
                  <button (click)="saveNewApiKey()" class="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg">Save Key</button>
                </div>
              </div>
            }

            <!-- Active BYOK Keys List -->
            <div class="space-y-2">
              @for (k of cryptoService.apiKeys(); track k.name) {
                <div class="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/70 hover:bg-gray-50">
                  <div class="flex items-center gap-3">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <div>
                      <span class="text-xs font-semibold text-gray-900 block">{{ k.name }}</span>
                      <span class="text-[10px] text-gray-400 uppercase tracking-wider">{{ k.provider }} • Added {{ k.addedAt | date:'shortDate' }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                      {{ k.key ? (k.key.substring(0, 4) + '••••' + k.key.slice(-4)) : 'System Default' }}
                    </span>
                    <button
                      (click)="cryptoService.removeApiKey(k.name)"
                      class="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      title="Remove key"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>

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
export class ByokModalComponent {
  cryptoService = inject(CryptoService);
  privacyService = inject(PrivacyService);
  @Output() close = new EventEmitter<void>();

  revealKey = signal<boolean>(false);
  isAddingKey = signal<boolean>(false);

  newKey: ApiKeyConfig = {
    provider: 'openai',
    name: '',
    key: '',
    isActive: true,
    addedAt: Date.now()
  };

  toggleAtRest(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.cryptoService.toggleAtRestEncryption(checked);
    this.privacyService.logEvent({
      category: 'encryption',
      action: checked ? 'AES-GCM Encryption Enabled' : 'AES-GCM Encryption Disabled',
      details: 'Storage policy modified by user',
      userEmail: 'current_user',
      status: 'allowed'
    });
  }

  async generateNewKey() {
    if (confirm('Generate a new master AES encryption key? (Ensure you export a backup of your current key)')) {
      const hex = await this.cryptoService.generateNewMasterKey();
      this.privacyService.logEvent({
        category: 'encryption',
        action: 'Master Encryption Key Rotated',
        details: 'New 256-bit AES-GCM master key derived',
        userEmail: 'current_user',
        status: 'encrypted'
      });
    }
  }

  exportKeyFile() {
    const raw = this.cryptoService.getRawKey();
    const blob = new Blob([raw], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eloqui-master-vault-${Date.now()}.key`;
    a.click();
    URL.revokeObjectURL(url);
  }

  saveNewApiKey() {
    if (!this.newKey.name.trim() || !this.newKey.key.trim()) {
      alert('Please provide a key label and secret key string.');
      return;
    }
    this.cryptoService.saveApiKey({ ...this.newKey, addedAt: Date.now() });
    this.privacyService.logEvent({
      category: 'byok',
      action: 'Custom Provider Key Added',
      details: `Key registered for ${this.newKey.provider} (${this.newKey.name})`,
      userEmail: 'current_user',
      status: 'encrypted'
    });
    this.isAddingKey.set(false);
    this.newKey = {
      provider: 'openai',
      name: '',
      key: '',
      isActive: true,
      addedAt: Date.now()
    };
  }
}
