import { Component, ChangeDetectionStrategy, inject, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlockService } from '../../services/block.service';
import { WordCountHistoryPoint } from '../../services/storage.service';

@Component({
  selector: 'app-metrics-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" (click)="close.emit()"></div>

      <div class="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <div>
              <h2 class="text-base font-semibold text-gray-900">Document Productivity & Metrics</h2>
              <p class="text-xs text-gray-500">Historical word count line chart and custom writing goals</p>
            </div>
          </div>
          <button (click)="close.emit()" class="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="overflow-y-auto p-6 space-y-6 flex-1">

          <!-- Core Stat Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-gray-50/80 border border-gray-100 p-3 rounded-xl">
              <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wider block">Current Words</span>
              <span class="text-2xl font-bold text-gray-900 mt-1 block">{{ blockService.wordCount() | number }}</span>
              <span class="text-[10px] text-gray-400">{{ blockService.chapters().length }} chapter(s)</span>
            </div>
            <div class="bg-purple-50/60 border border-purple-100 p-3 rounded-xl">
              <span class="text-[11px] font-medium text-purple-700 uppercase tracking-wider block">Document Goal</span>
              <span class="text-2xl font-bold text-purple-900 mt-1 block">{{ blockService.documentProgress() }}%</span>
              <span class="text-[10px] text-purple-600 font-medium">{{ wordsLeftToDocTarget() }} words remaining</span>
            </div>
            <div class="bg-emerald-50/60 border border-emerald-100 p-3 rounded-xl">
              <span class="text-[11px] font-medium text-emerald-700 uppercase tracking-wider block">Reading Time</span>
              <span class="text-2xl font-bold text-emerald-900 mt-1 block">{{ blockService.readingTime() }} min</span>
              <span class="text-[10px] text-emerald-600 font-medium">at ~200 wpm</span>
            </div>
            <div class="bg-sky-50/60 border border-sky-100 p-3 rounded-xl">
              <span class="text-[11px] font-medium text-sky-700 uppercase tracking-wider block">Speaking Time</span>
              <span class="text-2xl font-bold text-sky-900 mt-1 block">{{ blockService.speakingTime() }} min</span>
              <span class="text-[10px] text-sky-600 font-medium">at ~130 wpm</span>
            </div>
          </div>

          <!-- Historical Word Count Line Chart Container -->
          <div class="border border-gray-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-600"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Historical Word Count Over Time
                </h3>
                <p class="text-[11px] text-gray-400 mt-0.5">Visual progression of document length across writing sessions</p>
              </div>
              <button 
                (click)="recordSnapshot()"
                class="px-2.5 py-1 text-[11px] font-medium rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors flex items-center gap-1.5"
                title="Record current word count point"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Log Checkpoint
              </button>
            </div>

            <!-- SVG Line Chart Canvas -->
            <div class="relative w-full h-44 bg-gradient-to-b from-gray-50/70 to-white rounded-lg border border-gray-100 p-2 overflow-hidden flex flex-col justify-end">
              @if (chartPoints().length > 1) {
                <svg class="w-full h-full overflow-visible" viewBox="0 0 500 130" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="wordCountGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.35"/>
                      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.0"/>
                    </linearGradient>
                  </defs>

                  <!-- Horizontal Grid Lines -->
                  <line x1="0" y1="20" x2="500" y2="20" stroke="#f3f4f6" stroke-width="1"/>
                  <line x1="0" y1="65" x2="500" y2="65" stroke="#f3f4f6" stroke-width="1"/>
                  <line x1="0" y1="110" x2="500" y2="110" stroke="#f3f4f6" stroke-width="1"/>

                  <!-- Area Path -->
                  <polygon [attr.points]="chartAreaPoints()" fill="url(#wordCountGradient)"/>

                  <!-- Line Path -->
                  <polyline
                    [attr.points]="chartPolylinePoints()"
                    fill="none"
                    stroke="#7c3aed"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />

                  <!-- Data Point Circles -->
                  @for (pt of chartPoints(); track pt.timestamp; let i = $index) {
                    <circle
                      [attr.cx]="pt.x"
                      [attr.cy]="pt.y"
                      r="4"
                      class="fill-white stroke-purple-600 stroke-2 hover:r-6 cursor-pointer transition-all"
                      (mouseenter)="hoveredPoint.set(pt)"
                      (mouseleave)="hoveredPoint.set(null)"
                    />
                  }
                </svg>

                <!-- Tooltip Overlay -->
                @if (hoveredPoint(); as h) {
                  <div 
                    class="absolute top-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-2.5 py-1 rounded-md text-[10px] shadow-lg pointer-events-none flex items-center gap-2 z-10"
                  >
                    <span class="font-bold text-purple-300">{{ h.count | number }} words</span>
                    <span class="text-gray-400 border-l border-gray-700 pl-2">{{ h.formattedTime }}</span>
                  </div>
                }
              } @else {
                <div class="h-full flex items-center justify-center text-xs text-gray-400">
                  Record more checkpoints as you write to populate trend analysis.
                </div>
              }
            </div>

            <!-- X-Axis Labels -->
            <div class="flex justify-between text-[10px] text-gray-400 px-1">
              <span>Start of Tracked Sessions</span>
              <span>Recent Output</span>
              <span>Current Checkpoint</span>
            </div>
          </div>

          <!-- Productivity Goal Target Controls -->
          <div class="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              Set Writing Productivity Targets
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Document Target -->
              <div class="bg-white p-3.5 rounded-lg border border-gray-200/80 shadow-sm space-y-2">
                <div class="flex justify-between items-center text-xs font-medium text-gray-800">
                  <span>Document Target</span>
                  <span class="font-bold text-purple-700">{{ docTargetInput }} words</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="50000"
                  step="500"
                  [(ngModel)]="docTargetInput"
                  (ngModelChange)="applyGoals()"
                  class="w-full accent-purple-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                />
                <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-2">
                  <div class="bg-purple-600 h-full rounded-full transition-all" [style.width.%]="blockService.documentProgress()"></div>
                </div>
                <div class="flex justify-between text-[10px] text-gray-400">
                  <span>{{ blockService.wordCount() }} written</span>
                  <span>{{ blockService.documentProgress() }}% achieved</span>
                </div>
              </div>

              <!-- Daily Target -->
              <div class="bg-white p-3.5 rounded-lg border border-gray-200/80 shadow-sm space-y-2">
                <div class="flex justify-between items-center text-xs font-medium text-gray-800">
                  <span>Daily Target</span>
                  <span class="font-bold text-emerald-700">{{ dailyTargetInput }} words/day</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  step="100"
                  [(ngModel)]="dailyTargetInput"
                  (ngModelChange)="applyGoals()"
                  class="w-full accent-emerald-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                />
                <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-2">
                  <div class="bg-emerald-600 h-full rounded-full transition-all" [style.width.%]="blockService.dailyProgress()"></div>
                </div>
                <div class="flex justify-between text-[10px] text-gray-400">
                  <span>Streak: {{ blockService.currentStreak() }} day(s)</span>
                  <span>{{ blockService.dailyProgress() }}% today</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            (click)="close.emit()"
            class="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  `
})
export class MetricsModalComponent {
  blockService = inject(BlockService);
  @Output() close = new EventEmitter<void>();

  docTargetInput = this.blockService.documentTarget();
  dailyTargetInput = this.blockService.dailyTarget();

  hoveredPoint = signal<{ x: number; y: number; count: number; formattedTime: string } | null>(null);

  wordsLeftToDocTarget = computed(() => {
    const rem = this.blockService.documentTarget() - this.blockService.wordCount();
    return rem > 0 ? rem : 0;
  });

  chartPoints = computed(() => {
    const raw = this.blockService.wordCountHistory();
    if (!raw || raw.length === 0) return [];

    const counts = raw.map(p => p.wordCount);
    const max = Math.max(...counts, this.blockService.documentTarget(), 100);
    const min = 0;
    const range = max - min || 1;

    const width = 500;
    const height = 110;
    const paddingX = 15;
    const paddingY = 15;

    return raw.map((pt, idx) => {
      const x = raw.length === 1 ? width / 2 : paddingX + (idx / (raw.length - 1)) * (width - 2 * paddingX);
      const normalizedY = (pt.wordCount - min) / range;
      const y = height - (normalizedY * (height - 2 * paddingY)) + paddingY;
      
      const date = new Date(pt.timestamp);
      const formattedTime = `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      return {
        x: Math.round(x),
        y: Math.round(y),
        count: pt.wordCount,
        timestamp: pt.timestamp,
        formattedTime
      };
    });
  });

  chartPolylinePoints = computed(() => {
    return this.chartPoints().map(p => `${p.x},${p.y}`).join(' ');
  });

  chartAreaPoints = computed(() => {
    const points = this.chartPoints();
    if (points.length === 0) return '';
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const baseline = 130;
    const lineCoords = points.map(p => `${p.x},${p.y}`).join(' ');
    return `${firstX},${baseline} ${lineCoords} ${lastX},${baseline}`;
  });

  applyGoals() {
    this.blockService.updateGoals(this.docTargetInput, this.dailyTargetInput);
  }

  recordSnapshot() {
    this.blockService.recordWordCountSnapshot();
  }
}
