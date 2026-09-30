import { Component, ChangeDetectionStrategy, inject, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackupService, BackupMethod, RemoteType, RemoteConfig, BackupInspectionResult, BackupLogItem } from '../../services/backup.service';
import { BlockService } from '../../services/block.service';

@Component({
  selector: 'app-backup-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" (click)="close.emit()"></div>

      <!-- Modal Card -->
      <div class="relative w-full max-w-4xl bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-400/30 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-white tracking-tight">Sovereign Backup Hub</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Varied Remotes & Methods
                </span>
              </div>
              <p class="text-xs text-purple-200/80">Encrypted vault snapshots, Markdown ZIP trees, delta sync & varied remotes (S3, GitHub, WebDAV, Webhooks)</p>
            </div>
          </div>
          
          <button 
            (click)="close.emit()" 
            class="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal (Esc)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div class="px-4 sm:px-6 pt-3 pb-1 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/90 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <button 
            (click)="activeTab.set('backup')"
            [class]="'px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer border ' + 
              (activeTab() === 'backup' 
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-750')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-7-7-7 7"/><path d="M12 4v16"/></svg>
            <span>Run Backup</span>
          </button>

          <button 
            (click)="activeTab.set('remotes')"
            [class]="'px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer border ' + 
              (activeTab() === 'remotes' 
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-750')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
            <span>Remotes ({{ backupService.remotes().length }})</span>
          </button>

          <button 
            (click)="activeTab.set('schedule')"
            [class]="'px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer border ' + 
              (activeTab() === 'schedule' 
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-750')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Auto Schedule</span>
            @if (backupService.autoSettings().enabled) {
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            }
          </button>

          <button 
            (click)="activeTab.set('restore')"
            [class]="'px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer border ' + 
              (activeTab() === 'restore' 
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-750')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span>Restore & Recovery</span>
          </button>

          <button 
            (click)="activeTab.set('logs')"
            [class]="'px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer border ' + 
              (activeTab() === 'logs' 
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-750')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span>Audit Logs ({{ backupService.backupLogs().length }})</span>
          </button>
        </div>

        <!-- Body Area -->
        <div class="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1 bg-[#fcfcfb] dark:bg-zinc-900/60 custom-scrollbar">

          <!-- ================= TAB 1: RUN BACKUP ================= -->
          @if (activeTab() === 'backup') {
            <div class="space-y-6 animate-in fade-in duration-150">
              
              <!-- 1. Choose Backup Method -->
              <div>
                <label class="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-2.5">
                  1. Select Backup Method
                </label>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                  <!-- Encrypted Vault -->
                  <div 
                    (click)="selectedMethod.set('encrypted_vault')"
                    [class]="'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ' + 
                      (selectedMethod() === 'encrypted_vault' 
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/50 shadow-xs ring-2 ring-purple-600/20' 
                        : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600')"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <div class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </div>
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">AES-256</span>
                    </div>
                    <div>
                      <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">Full Encrypted Vault</div>
                      <div class="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">Zero-knowledge PBKDF2 container. Encrypts all manuscripts, goals, chats, and configurations (.eloqui-backup.enc).</div>
                    </div>
                  </div>

                  <!-- Plain JSON Vault -->
                  <div 
                    (click)="selectedMethod.set('json_vault')"
                    [class]="'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ' + 
                      (selectedMethod() === 'json_vault' 
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/50 shadow-xs ring-2 ring-purple-600/20' 
                        : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600')"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                        JSON
                      </div>
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">Standard</span>
                    </div>
                    <div>
                      <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">Structured JSON Vault</div>
                      <div class="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">Portable, unencrypted JSON archive with full database schema, manifests, and timestamps (.eloqui-vault.json).</div>
                    </div>
                  </div>

                  <!-- Multi-Folder Markdown ZIP -->
                  <div 
                    (click)="selectedMethod.set('zip_bundle')"
                    [class]="'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ' + 
                      (selectedMethod() === 'zip_bundle' 
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/50 shadow-xs ring-2 ring-purple-600/20' 
                        : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600')"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <div class="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                        ZIP
                      </div>
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">Markdown</span>
                    </div>
                    <div>
                      <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">Manuscript Tree ZIP</div>
                      <div class="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">Hierarchical directory zip: chapter Markdown files, analytics CSV, chat logs, and folder structure (.zip).</div>
                    </div>
                  </div>

                  <!-- Incremental Delta -->
                  <div 
                    (click)="selectedMethod.set('incremental')"
                    [class]="'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ' + 
                      (selectedMethod() === 'incremental' 
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/50 shadow-xs ring-2 ring-purple-600/20' 
                        : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600')"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <div class="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                        Δ
                      </div>
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">Fast Delta</span>
                    </div>
                    <div>
                      <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">Incremental Delta</div>
                      <div class="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">Backs up only documents and chapters modified since last successful backup. Reduces remote bandwidth.</div>
                    </div>
                  </div>

                  <!-- Active Document Only -->
                  <div 
                    (click)="selectedMethod.set('active_doc')"
                    [class]="'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ' + 
                      (selectedMethod() === 'active_doc' 
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/50 shadow-xs ring-2 ring-purple-600/20' 
                        : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600')"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <div class="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs">
                        DOC
                      </div>
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">Isolated</span>
                    </div>
                    <div>
                      <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">Current Document Only</div>
                      <div class="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">Quick standalone snapshot of "{{ blockService.docTitle() || 'Active Document' }}" and its chapters.</div>
                    </div>
                  </div>

                  <!-- Disaster HTML Dump -->
                  <div 
                    (click)="selectedMethod.set('disaster_html')"
                    [class]="'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ' + 
                      (selectedMethod() === 'disaster_html' 
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/50 shadow-xs ring-2 ring-purple-600/20' 
                        : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600')"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <div class="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold text-xs">
                        HTML
                      </div>
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">Offline</span>
                    </div>
                    <div>
                      <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">Disaster Recovery Reader</div>
                      <div class="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">Single self-contained HTML offline reader. Openable in any web browser without internet or software.</div>
                    </div>
                  </div>

                </div>
              </div>

              <!-- 2. Choose Remote Destination -->
              <div>
                <div class="flex items-center justify-between mb-2.5">
                  <label class="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                    2. Select Remote Target
                  </label>
                  <button 
                    (click)="activeTab.set('remotes')" 
                    class="text-xs text-purple-700 dark:text-purple-400 font-semibold hover:underline cursor-pointer"
                  >
                    + Manage Remotes
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  @for (remote of backupService.remotes(); track remote.id) {
                    <div 
                      (click)="selectedRemoteId.set(remote.id)"
                      [class]="'p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ' + 
                        (selectedRemoteId() === remote.id 
                          ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/50 shadow-xs ring-2 ring-purple-600/20' 
                          : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600')"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
                          @if (remote.type === 'download') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          } @else if (remote.type === 'github') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                          } @else if (remote.type === 's3') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                          } @else if (remote.type === 'webdav') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
                          } @else if (remote.type === 'webhook') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                          }
                        </div>
                        <div class="min-w-0">
                          <div class="text-xs font-bold text-gray-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                            <span>{{ remote.name }}</span>
                            @if (remote.isDefault) {
                              <span class="text-[9px] font-bold px-1 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">Default</span>
                            }
                          </div>
                          <div class="text-[10px] text-gray-500 dark:text-zinc-400 capitalize">
                            {{ backupService.getRemoteLabel(remote.type) }}
                          </div>
                        </div>
                      </div>

                      <div class="flex items-center gap-1.5 shrink-0">
                        @if (remote.lastStatus === 'success') {
                          <span class="w-2 h-2 rounded-full bg-emerald-500" title="Last sync succeeded"></span>
                        } @else if (remote.lastStatus === 'failed') {
                          <span class="w-2 h-2 rounded-full bg-red-500" title="Last sync failed"></span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- 3. Optional Encryption Passphrase (for encrypted vault) -->
              @if (selectedMethod() === 'encrypted_vault') {
                <div class="p-3.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-200 dark:border-zinc-700 space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Vault Encryption Passphrase (Optional)
                    </label>
                    <span class="text-[10px] text-gray-500 dark:text-zinc-400 font-medium">Leave blank to use default master vault key</span>
                  </div>
                  <input 
                    type="password" 
                    [value]="customPassword()" 
                    (input)="customPassword.set($any($event.target).value)" 
                    placeholder="Enter custom passphrase for this snapshot..."
                    class="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none focus:border-purple-500 text-gray-900 dark:text-zinc-100 font-mono"
                  />
                  <p class="text-[10px] text-gray-500 dark:text-zinc-400 leading-relaxed">
                    Uses PBKDF2 with 100,000 iterations + SHA-256 + AES-GCM 256. Without this password, data cannot be decrypted by anyone.
                  </p>
                </div>
              }

              <!-- Execute Action Banner -->
              <div class="p-4 bg-purple-50/70 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </div>
                  <div>
                    <div class="text-xs font-bold text-gray-900 dark:text-zinc-100">
                      Ready to execute backup
                    </div>
                    <div class="text-[11px] text-gray-600 dark:text-zinc-300">
                      {{ backupService.getMethodLabel(selectedMethod()) }} &rarr; {{ getSelectedRemote()?.name || 'Selected Remote' }}
                    </div>
                  </div>
                </div>

                <button 
                  (click)="runBackupNow()"
                  [disabled]="backupService.isBackingUp()"
                  class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  @if (backupService.isBackingUp()) {
                    <span class="animate-spin text-white">⚙</span>
                    <span>{{ backupService.backupProgressMessage() || 'Backing up...' }}</span>
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-7-7-7 7"/><path d="M12 4v16"/></svg>
                    <span>Execute Backup Now</span>
                  }
                </button>
              </div>

              @if (statusMessage()) {
                <div [class]="'p-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150 ' + 
                  (statusIsError() ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800')">
                  <span>{{ statusMessage() }}</span>
                </div>
              }

            </div>
          }

          <!-- ================= TAB 2: REMOTES MANAGER ================= -->
          @if (activeTab() === 'remotes') {
            <div class="space-y-6 animate-in fade-in duration-150">
              
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wider">Configured Remote Destinations</h3>
                  <p class="text-[11px] text-gray-500 dark:text-zinc-400">Configure remote cloud storage, Git repositories, WebDAV accounts, and webhooks</p>
                </div>
                <button 
                  (click)="openAddRemoteModal()"
                  class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Add Remote Target</span>
                </button>
              </div>

              <!-- List of Remotes -->
              <div class="space-y-3">
                @for (remote of backupService.remotes(); track remote.id) {
                  <div class="p-4 bg-white dark:bg-zinc-800/80 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-2xs space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
                          @if (remote.type === 'download') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          } @else if (remote.type === 'github') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                          } @else if (remote.type === 's3') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                          } @else if (remote.type === 'webdav') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
                          } @else if (remote.type === 'webhook') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                          }
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-gray-900 dark:text-zinc-100">{{ remote.name }}</span>
                            <span class="text-[9px] uppercase px-1.5 py-0.2 rounded font-bold bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300">
                              {{ remote.type }}
                            </span>
                            @if (remote.isDefault) {
                              <span class="text-[9px] uppercase px-1.5 py-0.2 rounded font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                                Default Target
                              </span>
                            }
                          </div>
                          <div class="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                            @if (remote.type === 'github') {
                              Repository: {{ remote.github?.owner }}/{{ remote.github?.repo }} (Branch: {{ remote.github?.branch || 'main' }})
                            } @else if (remote.type === 's3') {
                              Bucket: {{ remote.s3?.bucket }} (Region: {{ remote.s3?.region || 'us-east-1' }})
                            } @else if (remote.type === 'webdav') {
                              URL: {{ remote.webdav?.serverUrl || 'Not configured' }}
                            } @else if (remote.type === 'webhook') {
                              URL: {{ remote.webhook?.endpointUrl || 'Not configured' }}
                            } @else {
                              Standard direct local storage
                            }
                          </div>
                        </div>
                      </div>

                      <div class="flex items-center gap-2">
                        <!-- Test Connection Button -->
                        <button 
                          (click)="testRemoteConnection(remote)"
                          [disabled]="isTestingRemote() === remote.id"
                          class="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 text-xs font-semibold text-gray-700 dark:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Test remote connectivity"
                        >
                          @if (isTestingRemote() === remote.id) {
                            <span class="animate-spin text-purple-600">⚙</span>
                            <span>Testing...</span>
                          } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            <span>Test</span>
                          }
                        </button>

                        <!-- Edit Button -->
                        <button 
                          (click)="openEditRemoteModal(remote)"
                          class="p-1.5 text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                          title="Edit settings"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>

                        <!-- Set Default -->
                        @if (!remote.isDefault) {
                          <button 
                            (click)="backupService.setDefaultRemote(remote.id)"
                            class="px-2 py-1 text-[11px] text-gray-500 hover:text-purple-600 dark:text-zinc-400 dark:hover:text-purple-300 font-semibold cursor-pointer"
                            title="Make default target"
                          >
                            Set Default
                          </button>
                        }

                        <!-- Delete Button -->
                        @if (remote.type !== 'download') {
                          <button 
                            (click)="backupService.deleteRemote(remote.id)"
                            class="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Delete remote"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        }
                      </div>
                    </div>

                    @if (remoteTestResults()[remote.id]) {
                      <div [class]="'p-2.5 rounded-xl text-xs font-medium ' + 
                        (remoteTestResults()[remote.id].ok 
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                          : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800')">
                        {{ remoteTestResults()[remote.id].message }}
                      </div>
                    }
                  </div>
                }
              </div>

            </div>
          }

          <!-- ================= TAB 3: AUTO SCHEDULE ================= -->
          @if (activeTab() === 'schedule') {
            <div class="space-y-6 animate-in fade-in duration-150">
              
              <div class="p-4 bg-white dark:bg-zinc-800/80 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-2xs space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-xs font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wider">Automated Background Backups</h3>
                    <p class="text-[11px] text-gray-500 dark:text-zinc-400">Silently backup manuscripts at specified intervals or on document saves</p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      [checked]="autoScheduleEnabled()" 
                      (change)="autoScheduleEnabled.set($any($event.target).checked)"
                      class="sr-only peer"
                    />
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-zinc-700">
                  
                  <!-- Interval -->
                  <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 dark:text-zinc-300">Backup Frequency</label>
                    <select 
                      [value]="autoInterval()" 
                      (change)="autoInterval.set(+$any($event.target).value)"
                      class="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-medium text-gray-800 dark:text-zinc-200"
                    >
                      <option [value]="10">Every 10 Minutes</option>
                      <option [value]="30">Every 30 Minutes (Recommended)</option>
                      <option [value]="60">Every 1 Hour</option>
                      <option [value]="120">Every 2 Hours</option>
                      <option [value]="-1">On Every Document Save</option>
                    </select>
                  </div>

                  <!-- Method -->
                  <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 dark:text-zinc-300">Preferred Backup Method</label>
                    <select 
                      [value]="autoMethod()" 
                      (change)="autoMethod.set($any($event.target).value)"
                      class="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-medium text-gray-800 dark:text-zinc-200"
                    >
                      <option value="encrypted_vault">Full Encrypted Vault (AES-256)</option>
                      <option value="json_vault">Structured JSON Vault</option>
                      <option value="zip_bundle">Markdown Tree ZIP</option>
                      <option value="incremental">Incremental Delta</option>
                    </select>
                  </div>

                  <!-- Remote Target -->
                  <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 dark:text-zinc-300">Target Remote</label>
                    <select 
                      [value]="autoRemoteId()" 
                      (change)="autoRemoteId.set($any($event.target).value)"
                      class="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-medium text-gray-800 dark:text-zinc-200"
                    >
                      @for (remote of backupService.remotes(); track remote.id) {
                        <option [value]="remote.id">{{ remote.name }} ({{ remote.type }})</option>
                      }
                    </select>
                  </div>

                  <!-- Retention Max -->
                  <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 dark:text-zinc-300">Retention Limit</label>
                    <select 
                      [value]="autoRetention()" 
                      (change)="autoRetention.set(+$any($event.target).value)"
                      class="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-medium text-gray-800 dark:text-zinc-200"
                    >
                      <option [value]="10">Keep last 10 snapshots</option>
                      <option [value]="25">Keep last 25 snapshots</option>
                      <option [value]="50">Keep last 50 snapshots</option>
                      <option [value]="100">Keep last 100 snapshots</option>
                    </select>
                  </div>

                </div>

                <div class="pt-2 flex justify-end">
                  <button 
                    (click)="saveAutoBackupSchedule()"
                    class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Save Auto Schedule Settings
                  </button>
                </div>
              </div>

            </div>
          }

          <!-- ================= TAB 4: RESTORE & RECOVERY ================= -->
          @if (activeTab() === 'restore') {
            <div class="space-y-6 animate-in fade-in duration-150">
              
              <div class="p-5 bg-white dark:bg-zinc-800/80 rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 text-center space-y-3">
                <div class="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-gray-900 dark:text-zinc-100">Select or Drop Backup Archive</h3>
                  <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1">Supports .eloqui-backup.enc, .eloqui-vault.json, and .zip manuscripts</p>
                </div>
                <div>
                  <button 
                    (click)="fileInput.click()"
                    class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Browse Backup File
                  </button>
                  <input #fileInput type="file" accept=".enc,.json,.zip" class="hidden" (change)="handleFileSelect($event)" />
                </div>
              </div>

              <!-- Inspection Preview Card -->
              @if (inspectionResult()) {
                <div class="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-700 space-y-4 animate-in fade-in">
                  
                  <div class="flex items-center justify-between border-b border-gray-100 dark:border-zinc-700 pb-3">
                    <div class="flex items-center gap-2.5">
                      <span [class]="'w-3 h-3 rounded-full ' + (inspectionResult()?.valid ? 'bg-emerald-500' : 'bg-red-500')"></span>
                      <h4 class="text-xs font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wider">
                        Archive Inspection: {{ inspectionResult()?.format | uppercase }}
                      </h4>
                    </div>
                    <span class="text-[11px] text-gray-500 dark:text-zinc-400 font-mono">
                      {{ inspectionResult()?.dateStr }}
                    </span>
                  </div>

                  @if (inspectionResult()?.requiresPassword) {
                    <div class="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2">
                      <div class="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Encrypted Archive — Password Required
                      </div>
                      <div class="flex gap-2">
                        <input 
                          type="password" 
                          [value]="restorePassword()" 
                          (input)="restorePassword.set($any($event.target).value)" 
                          placeholder="Enter vault decryption password..." 
                          class="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 rounded-lg outline-none font-mono"
                        />
                        <button 
                          (click)="retryInspectionWithPassword()"
                          class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Unlock
                        </button>
                      </div>
                    </div>
                  }

                  @if (inspectionResult()?.valid && !inspectionResult()?.requiresPassword) {
                    <div class="grid grid-cols-3 gap-3 text-center">
                      <div class="p-2.5 bg-gray-50 dark:bg-zinc-900 rounded-xl">
                        <div class="text-base font-bold text-purple-700 dark:text-purple-400">{{ inspectionResult()?.docCount }}</div>
                        <div class="text-[10px] text-gray-500 uppercase font-bold">Documents</div>
                      </div>
                      <div class="p-2.5 bg-gray-50 dark:bg-zinc-900 rounded-xl">
                        <div class="text-base font-bold text-purple-700 dark:text-purple-400">{{ inspectionResult()?.chapterCount }}</div>
                        <div class="text-[10px] text-gray-500 uppercase font-bold">Chapters</div>
                      </div>
                      <div class="p-2.5 bg-gray-50 dark:bg-zinc-900 rounded-xl">
                        <div class="text-base font-bold text-purple-700 dark:text-purple-400">{{ inspectionResult()?.totalWords | number }}</div>
                        <div class="text-[10px] text-gray-500 uppercase font-bold">Words</div>
                      </div>
                    </div>

                    <!-- Document Titles -->
                    <div class="space-y-1">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Included Manuscripts:</span>
                      <div class="flex flex-wrap gap-1.5">
                        @for (title of inspectionResult()?.docTitles; track title) {
                          <span class="px-2 py-0.5 rounded-lg text-xs bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-medium">
                            {{ title }}
                          </span>
                        }
                      </div>
                    </div>

                    <!-- Restore Actions -->
                    <div class="pt-3 border-t border-gray-100 dark:border-zinc-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div class="flex items-center gap-2">
                        <label class="text-xs font-bold text-gray-700 dark:text-zinc-300">Restore Mode:</label>
                        <select 
                          [value]="restoreMode()" 
                          (change)="restoreMode.set($any($event.target).value)"
                          class="px-2.5 py-1 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg outline-none font-medium text-gray-800 dark:text-zinc-200"
                        >
                          <option value="merge">Merge & Update (Safe - Keeps local work)</option>
                          <option value="replace">Clean Replace (Overwrites entire vault)</option>
                        </select>
                      </div>

                      <button 
                        (click)="executeRestoreAction()"
                        [disabled]="isRestoring()"
                        class="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        @if (isRestoring()) {
                          <span class="animate-spin text-white">⚙</span>
                          <span>Restoring Vault...</span>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          <span>Confirm & Restore Manuscripts</span>
                        }
                      </button>
                    </div>
                  }

                  @if (inspectionResult()?.error) {
                    <div class="p-3 bg-red-50 dark:bg-red-950/60 rounded-xl text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                      {{ inspectionResult()?.error }}
                    </div>
                  }

                </div>
              }

            </div>
          }

          <!-- ================= TAB 5: AUDIT LOGS ================= -->
          @if (activeTab() === 'logs') {
            <div class="space-y-4 animate-in fade-in duration-150">
              
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wider">Remote Backup History</h3>
                  <p class="text-[11px] text-gray-500 dark:text-zinc-400">Complete audit log of snapshots, dispatches, and verification checksums</p>
                </div>
                @if (backupService.backupLogs().length > 0) {
                  <button 
                    (click)="backupService.clearLogs()"
                    class="px-2.5 py-1 text-xs text-gray-500 hover:text-red-600 dark:text-zinc-400 font-medium cursor-pointer"
                  >
                    Clear History
                  </button>
                }
              </div>

              @if (backupService.backupLogs().length === 0) {
                <div class="p-8 text-center text-xs text-gray-400 dark:text-zinc-500">
                  No backup operations recorded yet. Execute your first backup above!
                </div>
              } @else {
                <div class="space-y-2">
                  @for (log of backupService.backupLogs(); track log.id) {
                    <div class="p-3 bg-white dark:bg-zinc-800/80 rounded-xl border border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <span [class]="'w-2 h-2 rounded-full shrink-0 ' + (log.status === 'success' ? 'bg-emerald-500' : 'bg-red-500')"></span>
                        <div class="min-w-0">
                          <div class="font-bold text-gray-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                            <span>{{ log.filename }}</span>
                            <span class="text-[9px] uppercase px-1 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold">
                              {{ log.method }}
                            </span>
                          </div>
                          <div class="text-[10px] text-gray-400 dark:text-zinc-500">
                            Target: {{ log.remoteName }} ({{ log.remoteType }}) &bull; {{ log.docCount }} docs, {{ log.chapterCount }} ch &bull; {{ (log.sizeBytes / 1024).toFixed(1) }} KB
                          </div>
                        </div>
                      </div>

                      <div class="text-[11px] text-gray-400 dark:text-zinc-500 font-mono shrink-0">
                        {{ log.timestamp | date:'short' }}
                        @if (log.remoteUrl) {
                          <a [href]="log.remoteUrl" target="_blank" class="ml-2 text-purple-600 hover:underline">View &rarr;</a>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

            </div>
          }

        </div>

      </div>
    </div>

    <!-- Sub-Modal: Add / Edit Remote Target -->
    @if (editingRemote()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
        <div class="fixed inset-0 bg-black/50 backdrop-blur-2xs" (click)="closeEditRemoteModal()"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 p-5 space-y-4 text-gray-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
          
          <div class="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
            <h3 class="text-sm font-bold text-gray-900 dark:text-zinc-100">
              {{ editingRemote()?.id ? 'Configure Remote Target' : 'Add New Remote Target' }}
            </h3>
            <button (click)="closeEditRemoteModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="space-y-3 text-xs">
            <!-- Remote Name -->
            <div class="space-y-1">
              <label class="font-bold text-gray-700 dark:text-zinc-300">Remote Display Name</label>
              <input 
                type="text" 
                [value]="editingName()" 
                (input)="editingName.set($any($event.target).value)" 
                placeholder="e.g. My Production S3 Bucket" 
                class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none"
              />
            </div>

            <!-- Remote Type -->
            <div class="space-y-1">
              <label class="font-bold text-gray-700 dark:text-zinc-300">Remote Target Type</label>
              <select 
                [value]="editingType()" 
                (change)="editingType.set($any($event.target).value)"
                class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-medium"
              >
                <option value="github">GitHub Repository / Gist</option>
                <option value="s3">AWS S3 / Cloudflare R2 / MinIO / Wasabi</option>
                <option value="webdav">Nextcloud / ownCloud / WebDAV</option>
                <option value="webhook">Custom HTTP Webhook / Automation</option>
                <option value="local_dir">Local Directory (Native Folder Sync)</option>
              </select>
            </div>

            <!-- Specific Type Fields: GitHub -->
            @if (editingType() === 'github') {
              <div class="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                <div>
                  <label class="font-bold text-gray-700 dark:text-zinc-300">GitHub Personal Access Token (PAT)</label>
                  <input 
                    type="password" 
                    [value]="editingGhToken()" 
                    (input)="editingGhToken.set($any($event.target).value)" 
                    placeholder="ghp_xxxxxxxxxxxx" 
                    class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-mono"
                  />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="font-bold text-gray-700 dark:text-zinc-300">Repo Owner / User</label>
                    <input 
                      type="text" 
                      [value]="editingGhOwner()" 
                      (input)="editingGhOwner.set($any($event.target).value)" 
                      placeholder="e.g. octocat" 
                      class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label class="font-bold text-gray-700 dark:text-zinc-300">Repository Name</label>
                    <input 
                      type="text" 
                      [value]="editingGhRepo()" 
                      (input)="editingGhRepo.set($any($event.target).value)" 
                      placeholder="e.g. writing-backups" 
                      class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none"
                    />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="font-bold text-gray-700 dark:text-zinc-300">Branch</label>
                    <input 
                      type="text" 
                      [value]="editingGhBranch()" 
                      (input)="editingGhBranch.set($any($event.target).value)" 
                      placeholder="main" 
                      class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label class="font-bold text-gray-700 dark:text-zinc-300">Directory Path</label>
                    <input 
                      type="text" 
                      [value]="editingGhPath()" 
                      (input)="editingGhPath.set($any($event.target).value)" 
                      placeholder="backups" 
                      class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none"
                    />
                  </div>
                </div>
              </div>
            }

            <!-- Specific Type Fields: S3 -->
            @if (editingType() === 's3') {
              <div class="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                <div>
                  <label class="font-bold text-gray-700 dark:text-zinc-300">Custom S3 Endpoint (Optional for Cloudflare R2/MinIO)</label>
                  <input 
                    type="text" 
                    [value]="editingS3Endpoint()" 
                    (input)="editingS3Endpoint.set($any($event.target).value)" 
                    placeholder="https://<account_id>.r2.cloudflarestorage.com or empty for AWS" 
                    class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-mono"
                  />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="font-bold text-gray-700 dark:text-zinc-300">Bucket Name</label>
                    <input 
                      type="text" 
                      [value]="editingS3Bucket()" 
                      (input)="editingS3Bucket.set($any($event.target).value)" 
                      placeholder="my-manuscripts-bucket" 
                      class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label class="font-bold text-gray-700 dark:text-zinc-300">Region</label>
                    <input 
                      type="text" 
                      [value]="editingS3Region()" 
                      (input)="editingS3Region.set($any($event.target).value)" 
                      placeholder="us-east-1 or auto" 
                      class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none"
                    />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="font-bold text-gray-700 dark:text-zinc-300">Access Key ID</label>
                    <input 
                      type="text" 
                      [value]="editingS3KeyId()" 
                      (input)="editingS3KeyId.set($any($event.target).value)" 
                      placeholder="AKIAIOSFODNN7EXAMPLE" 
                      class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label class="font-bold text-gray-700 dark:text-zinc-300">Secret Access Key</label>
                    <input 
                      type="password" 
                      [value]="editingS3Secret()" 
                      (input)="editingS3Secret.set($any($event.target).value)" 
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" 
                      class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            }

            <!-- Specific Type Fields: WebDAV -->
            @if (editingType() === 'webdav') {
              <div class="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                <div>
                  <label class="font-bold text-gray-700 dark:text-zinc-300">WebDAV Server URL</label>
                  <input 
                    type="text" 
                    [value]="editingDavUrl()" 
                    (input)="editingDavUrl.set($any($event.target).value)" 
                    placeholder="https://cloud.example.com/remote.php/dav/files/user/" 
                    class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-mono"
                  />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="font-bold text-gray-700 dark:text-zinc-300">Username</label>
                    <input 
                      type="text" 
                      [value]="editingDavUser()" 
                      (input)="editingDavUser.set($any($event.target).value)" 
                      placeholder="user" 
                      class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label class="font-bold text-gray-700 dark:text-zinc-300">Password / App Token</label>
                    <input 
                      type="password" 
                      [value]="editingDavPass()" 
                      (input)="editingDavPass.set($any($event.target).value)" 
                      placeholder="••••••••••••" 
                      class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none"
                    />
                  </div>
                </div>
              </div>
            }

            <!-- Specific Type Fields: Webhook -->
            @if (editingType() === 'webhook') {
              <div class="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                <div>
                  <label class="font-bold text-gray-700 dark:text-zinc-300">Webhook Endpoint URL</label>
                  <input 
                    type="text" 
                    [value]="editingWhUrl()" 
                    (input)="editingWhUrl.set($any($event.target).value)" 
                    placeholder="https://webhook.site/xxx or https://discord.com/api/webhooks/..." 
                    class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label class="font-bold text-gray-700 dark:text-zinc-300">HMAC Secret (Optional)</label>
                  <input 
                    type="password" 
                    [value]="editingWhSecret()" 
                    (input)="editingWhSecret.set($any($event.target).value)" 
                    placeholder="Secret for X-Eloqui-Signature header" 
                    class="w-full px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>
            }

            <!-- Specific Type Fields: Local Directory -->
            @if (editingType() === 'local_dir') {
              <div class="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 space-y-2">
                <p class="text-xs text-purple-900 dark:text-purple-300 leading-relaxed">
                  Local Folder Sync uses the native browser File System Access API to directly write snapshots into a chosen folder on your hard drive.
                </p>
                <button 
                  (click)="pickLocalFolder()" 
                  class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs cursor-pointer"
                >
                  Select Folder On Disk...
                </button>
              </div>
            }

          </div>

          <div class="pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button 
              (click)="closeEditRemoteModal()" 
              class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button 
              (click)="saveEditingRemote()" 
              class="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              Save Remote
            </button>
          </div>

        </div>
      </div>
    }
  `
})
export class BackupModalComponent implements OnInit {
  backupService = inject(BackupService);
  blockService = inject(BlockService);

  @Output() close = new EventEmitter<void>();

  activeTab = signal<'backup' | 'remotes' | 'schedule' | 'restore' | 'logs'>('backup');

  // Tab 1 state
  selectedMethod = signal<BackupMethod>('encrypted_vault');
  selectedRemoteId = signal<string>('remote-browser-download');
  customPassword = signal<string>('');
  statusMessage = signal<string | null>(null);
  statusIsError = signal<boolean>(false);

  // Tab 2 Remotes state
  editingRemote = signal<RemoteConfig | null>(null);
  editingName = signal<string>('');
  editingType = signal<RemoteType>('github');
  
  // GitHub fields
  editingGhToken = signal<string>('');
  editingGhOwner = signal<string>('');
  editingGhRepo = signal<string>('eloqui-backups');
  editingGhBranch = signal<string>('main');
  editingGhPath = signal<string>('backups');
  
  // S3 fields
  editingS3Endpoint = signal<string>('');
  editingS3Region = signal<string>('us-east-1');
  editingS3Bucket = signal<string>('');
  editingS3KeyId = signal<string>('');
  editingS3Secret = signal<string>('');
  
  // WebDAV fields
  editingDavUrl = signal<string>('');
  editingDavUser = signal<string>('');
  editingDavPass = signal<string>('');

  // Webhook fields
  editingWhUrl = signal<string>('');
  editingWhSecret = signal<string>('');

  isTestingRemote = signal<string | null>(null);
  remoteTestResults = signal<Record<string, { ok: boolean; message: string }>>({});

  // Tab 3 Schedule state
  autoScheduleEnabled = signal<boolean>(false);
  autoInterval = signal<number>(30);
  autoMethod = signal<BackupMethod>('encrypted_vault');
  autoRemoteId = signal<string>('remote-browser-download');
  autoRetention = signal<number>(50);

  // Tab 4 Restore state
  selectedRestoreFile = signal<File | null>(null);
  inspectionResult = signal<BackupInspectionResult | null>(null);
  restorePassword = signal<string>('');
  restoreMode = signal<'merge' | 'replace'>('merge');
  isRestoring = signal<boolean>(false);

  ngOnInit() {
    // Select default remote
    const def = this.backupService.remotes().find(r => r.isDefault);
    if (def) this.selectedRemoteId.set(def.id);

    // Load auto schedule settings into local signals
    const autoCfg = this.backupService.autoSettings();
    this.autoScheduleEnabled.set(autoCfg.enabled);
    this.autoInterval.set(autoCfg.intervalMinutes);
    this.autoMethod.set(autoCfg.preferredMethod);
    this.autoRemoteId.set(autoCfg.targetRemoteId);
    this.autoRetention.set(autoCfg.retentionMaxLogs);
  }

  getSelectedRemote(): RemoteConfig | undefined {
    return this.backupService.remotes().find(r => r.id === this.selectedRemoteId());
  }

  async runBackupNow() {
    this.statusMessage.set(null);
    try {
      const res = await this.backupService.executeBackup(
        this.selectedMethod(),
        this.selectedRemoteId(),
        this.customPassword()
      );
      this.statusIsError.set(false);
      this.statusMessage.set(`Successfully created and dispatched backup "${res.filename}" to ${res.remoteName}!`);
      setTimeout(() => this.statusMessage.set(null), 6000);
    } catch (e: any) {
      this.statusIsError.set(true);
      this.statusMessage.set(`Backup failed: ${e.message || 'Unknown error'}`);
    }
  }

  async testRemoteConnection(remote: RemoteConfig) {
    this.isTestingRemote.set(remote.id);
    try {
      const res = await this.backupService.testConnection(remote);
      this.remoteTestResults.update(all => ({
        ...all,
        [remote.id]: { ok: res.ok, message: res.message }
      }));
    } finally {
      this.isTestingRemote.set(null);
    }
  }

  openAddRemoteModal() {
    this.editingRemote.set({
      id: '',
      name: 'New Cloud Remote',
      type: 'github',
      isDefault: false,
      createdAt: Date.now()
    });
    this.editingName.set('New Cloud Remote');
    this.editingType.set('github');
    this.editingGhToken.set('');
    this.editingGhOwner.set('');
    this.editingGhRepo.set('eloqui-backups');
    this.editingGhBranch.set('main');
    this.editingGhPath.set('backups');
  }

  openEditRemoteModal(remote: RemoteConfig) {
    this.editingRemote.set(remote);
    this.editingName.set(remote.name);
    this.editingType.set(remote.type);

    if (remote.github) {
      this.editingGhToken.set(remote.github.token || '');
      this.editingGhOwner.set(remote.github.owner || '');
      this.editingGhRepo.set(remote.github.repo || '');
      this.editingGhBranch.set(remote.github.branch || 'main');
      this.editingGhPath.set(remote.github.path || 'backups');
    }
    if (remote.s3) {
      this.editingS3Endpoint.set(remote.s3.endpoint || '');
      this.editingS3Region.set(remote.s3.region || 'us-east-1');
      this.editingS3Bucket.set(remote.s3.bucket || '');
      this.editingS3KeyId.set(remote.s3.accessKeyId || '');
      this.editingS3Secret.set(remote.s3.secretAccessKey || '');
    }
    if (remote.webdav) {
      this.editingDavUrl.set(remote.webdav.serverUrl || '');
      this.editingDavUser.set(remote.webdav.username || '');
      this.editingDavPass.set(remote.webdav.password || '');
    }
    if (remote.webhook) {
      this.editingWhUrl.set(remote.webhook.endpointUrl || '');
      this.editingWhSecret.set(remote.webhook.secret || '');
    }
  }

  closeEditRemoteModal() {
    this.editingRemote.set(null);
  }

  async pickLocalFolder() {
    try {
      const id = await this.backupService.selectLocalDirectory();
      if (id) {
        this.closeEditRemoteModal();
      }
    } catch (e: any) {
      alert(e.message);
    }
  }

  saveEditingRemote() {
    const cur = this.editingRemote();
    if (!cur) return;

    const id = cur.id || `remote-${Date.now()}`;
    const name = this.editingName().trim() || 'Custom Remote';
    const type = this.editingType();

    const newRemote: RemoteConfig = {
      id,
      name,
      type,
      isDefault: cur.isDefault || false,
      createdAt: cur.createdAt || Date.now()
    };

    if (type === 'github') {
      newRemote.github = {
        token: this.editingGhToken().trim(),
        owner: this.editingGhOwner().trim(),
        repo: this.editingGhRepo().trim(),
        branch: this.editingGhBranch().trim() || 'main',
        path: this.editingGhPath().trim() || 'backups',
        isGist: false
      };
    } else if (type === 's3') {
      newRemote.s3 = {
        endpoint: this.editingS3Endpoint().trim(),
        region: this.editingS3Region().trim() || 'us-east-1',
        bucket: this.editingS3Bucket().trim(),
        accessKeyId: this.editingS3KeyId().trim(),
        secretAccessKey: this.editingS3Secret().trim(),
        prefix: 'backups'
      };
    } else if (type === 'webdav') {
      newRemote.webdav = {
        serverUrl: this.editingDavUrl().trim(),
        username: this.editingDavUser().trim(),
        password: this.editingDavPass().trim(),
        path: 'Backups'
      };
    } else if (type === 'webhook') {
      newRemote.webhook = {
        endpointUrl: this.editingWhUrl().trim(),
        method: 'POST',
        secret: this.editingWhSecret().trim()
      };
    }

    this.backupService.addOrUpdateRemote(newRemote);
    this.closeEditRemoteModal();
  }

  saveAutoBackupSchedule() {
    this.backupService.saveAutoSettings({
      enabled: this.autoScheduleEnabled(),
      intervalMinutes: this.autoInterval(),
      preferredMethod: this.autoMethod(),
      targetRemoteId: this.autoRemoteId(),
      retentionMaxLogs: this.autoRetention(),
      includeChatHistory: true,
      includeAnalytics: true
    });
    alert('Auto backup schedule updated successfully!');
  }

  async handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedRestoreFile.set(file);
      const res = await this.backupService.inspectBackupFile(file);
      this.inspectionResult.set(res);
    }
  }

  async retryInspectionWithPassword() {
    const file = this.selectedRestoreFile();
    if (!file) return;
    const res = await this.backupService.inspectBackupFile(file, this.restorePassword());
    this.inspectionResult.set(res);
  }

  async executeRestoreAction() {
    const res = this.inspectionResult();
    if (!res || !res.valid) return;

    this.isRestoring.set(true);
    try {
      const restoredCount = await this.backupService.restoreVault(res, this.restoreMode());
      alert(`Successfully restored ${restoredCount} documents into your vault!`);
      this.close.emit();
    } catch (e: any) {
      alert(`Restore failed: ${e.message}`);
    } finally {
      this.isRestoring.set(false);
    }
  }
}
