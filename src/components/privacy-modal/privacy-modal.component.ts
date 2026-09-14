import { Component, ChangeDetectionStrategy, inject, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrivacyService, AuditEvent } from '../../services/privacy.service';
import { CryptoService } from '../../services/crypto.service';

@Component({
  selector: 'app-privacy-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" (click)="close.emit()"></div>

      <div class="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/40">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-base font-semibold text-gray-900">Data Privacy & Sovereignty Dashboard</h2>
              <p class="text-xs text-gray-500">Monitor access logs, audit trails, and strict zero-knowledge policies</p>
            </div>
          </div>
          
          <button (click)="close.emit()" class="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="overflow-y-auto p-6 space-y-6 flex-1">

          <!-- Guarantee Badges Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            @for (policy of privacyService.policies; track policy.id) {
              <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-start gap-3">
                <div class="p-2 rounded-lg bg-white border border-gray-200 text-emerald-600 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="text-xs font-bold text-gray-900">{{ policy.title }}</h4>
                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                      {{ policy.status }}
                    </span>
                  </div>
                  <p class="text-[11px] text-gray-600 mt-1 leading-relaxed">{{ policy.description }}</p>
                </div>
              </div>
            }
          </div>

          <!-- Strict Telemetry Control -->
          <div class="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-emerald-950 block">Zero-Telemetry & Strict Local Mode</span>
              <span class="text-xs text-emerald-700">Blocks all analytical beaconing, crash reporters, and external tracking</span>
            </div>
            <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                [checked]="privacyService.isZeroTelemetry()"
                (change)="toggleTelemetry($event)"
                class="sr-only peer"
              />
              <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 relative"></div>
            </label>
          </div>

          <!-- Real-time Audit Trail -->
          <div class="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-800">Cryptographic & Access Audit Trail</h3>
                <p class="text-xs text-gray-500">Chronological records of every document access, encryption action, and AI query</p>
              </div>

              <div class="flex items-center gap-2">
                <input
                  type="text"
                  [(ngModel)]="searchQuery"
                  placeholder="Filter audit events..."
                  class="px-2.5 py-1 text-xs border border-gray-200 rounded-lg w-40"
                />
                <button
                  (click)="exportLogs()"
                  class="px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                  title="Export JSON audit log"
                >
                  Export
                </button>
                <button
                  (click)="clearLogs()"
                  class="px-2.5 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  title="Purge logs"
                >
                  Purge
                </button>
              </div>
            </div>

            <!-- Audit Log Table -->
            <div class="border border-gray-100 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-gray-50 text-[10px] font-semibold uppercase text-gray-400 border-b border-gray-100">
                  <tr>
                    <th class="py-2 px-3">Timestamp</th>
                    <th class="py-2 px-3">Category</th>
                    <th class="py-2 px-3">Action</th>
                    <th class="py-2 px-3">Details</th>
                    <th class="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 font-mono text-[11px]">
                  @for (log of filteredLogs(); track log.id) {
                    <tr class="hover:bg-gray-50/50">
                      <td class="py-2 px-3 text-gray-500 text-[10px]">{{ log.timestamp | date:'shortTime' }}</td>
                      <td class="py-2 px-3">
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-sans font-medium"
                          [class.bg-purple-100]="log.category === 'document'"
                          [class.text-purple-700]="log.category === 'document'"
                          [class.bg-emerald-100]="log.category === 'encryption'"
                          [class.text-emerald-700]="log.category === 'encryption'"
                          [class.bg-blue-100]="log.category === 'ai_inference'"
                          [class.text-blue-700]="log.category === 'ai_inference'"
                          [class.bg-gray-100]="log.category === 'auth'"
                          [class.text-gray-700]="log.category === 'auth'"
                        >
                          {{ log.category }}
                        </span>
                      </td>
                      <td class="py-2 px-3 font-sans font-medium text-gray-800">{{ log.action }}</td>
                      <td class="py-2 px-3 text-gray-600 font-sans truncate max-w-xs" [title]="log.details">{{ log.details }}</td>
                      <td class="py-2 px-3">
                        <span class="text-[9px] font-sans px-1.5 py-0.5 rounded"
                          [class.bg-emerald-50]="log.status === 'encrypted' || log.status === 'allowed'"
                          [class.text-emerald-700]="log.status === 'encrypted' || log.status === 'allowed'"
                          [class.bg-amber-50]="log.status === 'processed'"
                          [class.text-amber-700]="log.status === 'processed'"
                        >
                          {{ log.status }}
                        </span>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="py-4 text-center text-xs text-gray-400 font-sans">No audit events recorded matching criteria.</td>
                    </tr>
                  }
                </tbody>
              </table>
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
export class PrivacyModalComponent {
  privacyService = inject(PrivacyService);
  cryptoService = inject(CryptoService);
  @Output() close = new EventEmitter<void>();

  searchQuery = '';

  filteredLogs = computed(() => {
    const q = this.searchQuery.toLowerCase();
    const all = this.privacyService.auditLogs();
    if (!q) return all;
    return all.filter(l => 
      l.action.toLowerCase().includes(q) || 
      l.details.toLowerCase().includes(q) || 
      l.category.toLowerCase().includes(q)
    );
  });

  toggleTelemetry(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.privacyService.setZeroTelemetry(checked);
  }

  exportLogs() {
    const data = this.privacyService.exportAuditLogsJson();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eloqui-audit-trail-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clearLogs() {
    if (confirm('Clear local audit trail log?')) {
      this.privacyService.clearAuditLogs();
    }
  }
}
