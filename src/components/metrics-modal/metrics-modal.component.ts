import { Component, ChangeDetectionStrategy, inject, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlockService } from '../../services/block.service';
import { ReadabilityService, AudienceLevelId, AudienceProfile, ReadabilityMetrics, AudienceMatchResult } from '../../services/readability.service';
import { WordCountHistoryPoint } from '../../services/storage.service';

@Component({
  selector: 'app-metrics-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div class="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity" (click)="close.emit()"></div>

      <div class="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-2xs">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                <path d="M6 6h10"/>
                <path d="M6 10h10"/>
                <path d="m14 16 2 2 4-4"/>
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-gray-900">Document Productivity & Readability</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                  Grade {{ currentMetrics().fleschKincaidGradeLevel }}
                </span>
              </div>
              <p class="text-xs text-gray-500">Quantitative complexity metrics, Flesch-Kincaid readability, and writing progression</p>
            </div>
          </div>
          <button 
            (click)="close.emit()" 
            class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Close dialog (Esc)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1 text-gray-800">

          <!-- Core Stat Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-gray-50/90 border border-gray-100 p-3 rounded-xl">
              <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wider block">Current Words</span>
              <span class="text-2xl font-bold text-gray-900 mt-1 block">{{ blockService.wordCount() | number }}</span>
              <span class="text-[10px] text-gray-400">{{ blockService.chapters().length }} chapter(s)</span>
            </div>
            <div class="bg-purple-50/70 border border-purple-100 p-3 rounded-xl">
              <span class="text-[11px] font-medium text-purple-700 uppercase tracking-wider block">Document Goal</span>
              <span class="text-2xl font-bold text-purple-900 mt-1 block">{{ blockService.documentProgress() }}%</span>
              <span class="text-[10px] text-purple-600 font-medium">{{ wordsLeftToDocTarget() }} words remaining</span>
            </div>
            <div class="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl">
              <span class="text-[11px] font-medium text-emerald-700 uppercase tracking-wider block">Reading Time</span>
              <span class="text-2xl font-bold text-emerald-900 mt-1 block">{{ blockService.readingTime() }} min</span>
              <span class="text-[10px] text-emerald-600 font-medium">at ~200 wpm</span>
            </div>
            <div class="bg-sky-50/70 border border-sky-100 p-3 rounded-xl">
              <span class="text-[11px] font-medium text-sky-700 uppercase tracking-wider block">Speaking Time</span>
              <span class="text-2xl font-bold text-sky-900 mt-1 block">{{ blockService.speakingTime() }} min</span>
              <span class="text-[10px] text-sky-600 font-medium">at ~130 wpm</span>
            </div>
          </div>

          <!-- ============================================================== -->
          <!-- READABILITY & AUDIENCE LEVEL CALIBRATION (THE REQUESTED FEATURE) -->
          <!-- ============================================================== -->
          <div class="border border-purple-100 bg-gradient-to-b from-purple-50/30 via-white to-white rounded-2xl p-5 shadow-xs space-y-5">
            
            <!-- Section Header & Scope Selector -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-600">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    Text Readability & Complexity Score
                  </h3>
                  <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    Live Analyzer
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">
                  Flesch-Kincaid & multi-index algorithms calibrated against intended reader demographics
                </p>
              </div>

              <!-- Scope Toggle: Active Chapter vs Whole Document -->
              <div class="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-medium self-start sm:self-auto shrink-0 border border-gray-200/80">
                <button
                  (click)="analysisScope.set('chapter')"
                  [class]="'px-3 py-1 rounded-lg transition-all ' + 
                    (analysisScope() === 'chapter' 
                      ? 'bg-white text-gray-900 font-bold shadow-2xs' 
                      : 'text-gray-500 hover:text-gray-800')"
                  title="Analyze only the currently active chapter"
                >
                  Active Chapter
                </button>
                <button
                  (click)="analysisScope.set('document')"
                  [class]="'px-3 py-1 rounded-lg transition-all ' + 
                    (analysisScope() === 'document' 
                      ? 'bg-white text-gray-900 font-bold shadow-2xs' 
                      : 'text-gray-500 hover:text-gray-800')"
                  title="Analyze full aggregated manuscript"
                >
                  Entire Manuscript
                </button>
              </div>
            </div>

            <!-- Intended Target Audience Selector -->
            <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label for="audienceSelect" class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Intended Audience Level:
                </label>

                <div class="flex items-center gap-2">
                  <select
                    id="audienceSelect"
                    [value]="selectedAudienceId()"
                    (change)="onAudienceChange($event)"
                    class="bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs cursor-pointer"
                  >
                    @for (profile of audienceProfiles; track profile.id) {
                      <option [value]="profile.id">
                        {{ profile.name }} (Grades {{ profile.targetGradeMin }}–{{ profile.targetGradeMax }})
                      </option>
                    }
                  </select>
                </div>
              </div>

              <!-- Active Profile Benchmark Info -->
              <div class="text-[11px] text-gray-600 flex flex-wrap items-center justify-between gap-y-1 gap-x-3 pt-1 border-t border-slate-200/60">
                <span class="text-gray-500">
                  <strong class="text-gray-700 font-semibold">Benchmark:</strong> {{ currentAudienceProfile().benchmarkExamples }}
                </span>
                <span class="text-gray-500">
                  <strong class="text-gray-700 font-semibold">Target Ease:</strong> {{ currentAudienceProfile().targetFleschMin }}–{{ currentAudienceProfile().targetFleschMax }} Flesch · 
                  <strong class="text-gray-700 font-semibold">Pacing:</strong> {{ currentAudienceProfile().recommendedSentenceLength }}
                </span>
              </div>
            </div>

            <!-- Audience Calibration Status Alert Banner -->
            <div 
              [class]="'p-3.5 rounded-xl border flex items-start gap-3 transition-colors ' + audienceMatch().badgeClass"
            >
              <div class="mt-0.5 shrink-0">
                @if (audienceMatch().status === 'optimal') {
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                } @else if (audienceMatch().status === 'slightly_dense' || audienceMatch().status === 'slightly_simple') {
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-600">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-600">
                    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                }
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <span class="text-xs font-bold uppercase tracking-wider">{{ audienceMatch().label }}</span>
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 border border-current shadow-2xs">
                    @if (audienceMatch().deltaGrade === 0) {
                      Perfect Target Alignment
                    } @else if (audienceMatch().deltaGrade > 0) {
                      +{{ audienceMatch().deltaGrade }} Grades vs Target Midpoint
                    } @else {
                      {{ audienceMatch().deltaGrade }} Grades vs Target Midpoint
                    }
                  </span>
                </div>
                <p class="text-xs mt-1 font-medium">{{ audienceMatch().message }}</p>
                <p class="text-[11px] opacity-90 mt-1 flex items-center gap-1">
                  <span class="font-semibold">Tip:</span> {{ audienceMatch().actionableTip }}
                </p>
              </div>
            </div>

            <!-- Dual Primary Readability Score Gauges -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              <!-- Card 1: Flesch-Kincaid Grade Level -->
              <div class="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs flex flex-col justify-between">
                <div class="flex items-start justify-between">
                  <div>
                    <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Flesch-Kincaid Grade</span>
                    <span class="text-xs text-gray-400">US Educational Grade Equivalent</span>
                  </div>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    FKGL Score
                  </span>
                </div>

                <div class="my-3 flex items-baseline gap-2">
                  <span class="text-3xl font-extrabold text-purple-900 tracking-tight">
                    Grade {{ currentMetrics().fleschKincaidGradeLevel }}
                  </span>
                  <span class="text-xs font-semibold text-gray-600">
                    ({{ currentMetrics().gradeLevelEquivalent }})
                  </span>
                </div>

                <div class="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Typical Reader Age:</span>
                  <span class="font-bold text-gray-800">{{ currentMetrics().typicalAgeRange }}</span>
                </div>
              </div>

              <!-- Card 2: Flesch Reading Ease -->
              <div class="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs flex flex-col justify-between">
                <div class="flex items-start justify-between">
                  <div>
                    <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Flesch Reading Ease</span>
                    <span class="text-xs text-gray-400">0 to 100 Scale (Higher = Easier to Read)</span>
                  </div>
                  <span [class]="'px-2 py-0.5 rounded-md text-[10px] font-bold border ' + currentMetrics().readingEaseColor">
                    {{ currentMetrics().readingEaseLabel }}
                  </span>
                </div>

                <div class="my-2.5">
                  <div class="flex items-baseline justify-between mb-1.5">
                    <span class="text-3xl font-extrabold text-gray-900 tracking-tight">
                      {{ currentMetrics().fleschReadingEase }} <span class="text-base font-normal text-gray-400">/ 100</span>
                    </span>
                    <span class="text-xs font-semibold text-gray-500">
                      {{ currentMetrics().fleschReadingEase >= 60 ? 'Accessible' : 'Dense' }}
                    </span>
                  </div>

                  <!-- Meter bar -->
                  <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden flex">
                    <div 
                      class="h-full rounded-full transition-all duration-300"
                      [style.width.%]="currentMetrics().fleschReadingEase"
                      [style.backgroundColor]="getReadingEaseBarColor(currentMetrics().fleschReadingEase)"
                    ></div>
                  </div>
                </div>

                <div class="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Target Range for {{ currentAudienceProfile().shortLabel }}:</span>
                  <span class="font-bold text-gray-800">{{ currentAudienceProfile().targetFleschMin }}–{{ currentAudienceProfile().targetFleschMax }}</span>
                </div>
              </div>

            </div>

            <!-- Detailed Quantitative Metrics Grid -->
            <div class="space-y-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                Quantitative Linguistic Breakdown
              </span>

              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-center">
                
                <div class="bg-gray-50 border border-gray-200/80 p-2.5 rounded-xl">
                  <span class="text-[10px] text-gray-500 font-medium block">Avg Sentence</span>
                  <span class="text-base font-bold text-gray-900 mt-0.5 block">
                    {{ currentMetrics().avgWordsPerSentence }}
                  </span>
                  <span class="text-[9px] text-gray-400">words/sentence</span>
                </div>

                <div class="bg-gray-50 border border-gray-200/80 p-2.5 rounded-xl">
                  <span class="text-[10px] text-gray-500 font-medium block">Avg Word</span>
                  <span class="text-base font-bold text-gray-900 mt-0.5 block">
                    {{ currentMetrics().avgSyllablesPerWord }}
                  </span>
                  <span class="text-[9px] text-gray-400">syllables/word</span>
                </div>

                <div class="bg-gray-50 border border-gray-200/80 p-2.5 rounded-xl">
                  <span class="text-[10px] text-gray-500 font-medium block">Complex Words</span>
                  <span class="text-base font-bold text-gray-900 mt-0.5 block">
                    {{ currentMetrics().complexWordPercentage }}%
                  </span>
                  <span class="text-[9px] text-gray-400">3+ syllables</span>
                </div>

                <div class="bg-gray-50 border border-gray-200/80 p-2.5 rounded-xl" title="Gunning Fog Index: Estimates years of formal education needed">
                  <span class="text-[10px] text-gray-500 font-medium block">Gunning Fog</span>
                  <span class="text-base font-bold text-indigo-900 mt-0.5 block">
                    {{ currentMetrics().gunningFogIndex }}
                  </span>
                  <span class="text-[9px] text-indigo-500 font-medium">Fog Index</span>
                </div>

                <div class="bg-gray-50 border border-gray-200/80 p-2.5 rounded-xl" title="Coleman-Liau Index: Character-based readability index">
                  <span class="text-[10px] text-gray-500 font-medium block">Coleman-Liau</span>
                  <span class="text-base font-bold text-indigo-900 mt-0.5 block">
                    {{ currentMetrics().colemanLiauIndex }}
                  </span>
                  <span class="text-[9px] text-indigo-500 font-medium">CLI Index</span>
                </div>

                <div class="bg-gray-50 border border-gray-200/80 p-2.5 rounded-xl" title="Automated Readability Index">
                  <span class="text-[10px] text-gray-500 font-medium block">Auto Index (ARI)</span>
                  <span class="text-base font-bold text-indigo-900 mt-0.5 block">
                    {{ currentMetrics().automatedReadabilityIndex }}
                  </span>
                  <span class="text-[9px] text-indigo-500 font-medium">ARI Score</span>
                </div>

              </div>
            </div>

            <!-- Sentence Length Cadence Distribution -->
            <div class="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3.5 space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-gray-700">Sentence Length Rhythm & Flow</span>
                <span class="text-gray-400 text-[11px]">{{ currentMetrics().sentenceCount }} total sentences detected</span>
              </div>

              <!-- Multi-color distribution bar -->
              <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
                <div 
                  class="bg-emerald-500 h-full transition-all" 
                  [style.width.%]="sentenceDistribution().shortPct"
                  title="Short Sentences (<12 words): {{ sentenceDistribution().shortPct }}%"
                ></div>
                <div 
                  class="bg-sky-500 h-full transition-all" 
                  [style.width.%]="sentenceDistribution().mediumPct"
                  title="Balanced Sentences (12-24 words): {{ sentenceDistribution().mediumPct }}%"
                ></div>
                <div 
                  class="bg-amber-500 h-full transition-all" 
                  [style.width.%]="sentenceDistribution().longPct"
                  title="Complex Sentences (>24 words): {{ sentenceDistribution().longPct }}%"
                ></div>
              </div>

              <!-- Legend -->
              <div class="flex flex-wrap items-center justify-between text-[11px] text-gray-500 pt-1">
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Short (&lt;12w): <strong>{{ currentMetrics().shortSentencesCount }}</strong> ({{ sentenceDistribution().shortPct }}%)</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                  <span>Balanced (12–24w): <strong>{{ currentMetrics().mediumSentencesCount }}</strong> ({{ sentenceDistribution().mediumPct }}%)</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>Complex (&gt;24w): <strong>{{ currentMetrics().longSentencesCount }}</strong> ({{ sentenceDistribution().longPct }}%)</span>
                </div>
              </div>

              <!-- Expandable Longest Sentences Inspector -->
              @if (currentMetrics().longestSentences.length > 0) {
                <div class="pt-2 border-t border-gray-200/80">
                  <button 
                    (click)="showSentenceInspector.update(v => !v)"
                    class="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 transition-colors"
                  >
                    <span>{{ showSentenceInspector() ? 'Hide' : 'Inspect' }} Longest / Most Complex Sentences</span>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      stroke-width="2" 
                      stroke-linecap="round" 
                      stroke-linejoin="round"
                      [class.rotate-180]="showSentenceInspector()"
                      class="transition-transform"
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  @if (showSentenceInspector()) {
                    <div class="mt-2 space-y-2 animate-in fade-in duration-150">
                      @for (s of currentMetrics().longestSentences; track s.text; let i = $index) {
                        <div class="bg-white p-2.5 rounded-lg border border-gray-200 text-xs shadow-2xs">
                          <div class="flex items-center justify-between mb-1">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-purple-700">Sentence #{{ i + 1 }}</span>
                            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              {{ s.wordCount }} words
                            </span>
                          </div>
                          <p class="text-gray-700 italic font-serif leading-relaxed">
                            "{{ s.text }}"
                          </p>
                        </div>
                      }
                    </div>
                  }
                </div>
              }

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
        <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
          <div class="text-[11px] text-gray-500 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Real-time analysis active across {{ blockService.chapters().length }} chapters</span>
          </div>
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
  readabilityService = inject(ReadabilityService);
  @Output() close = new EventEmitter<void>();

  // Scope: 'chapter' or 'document'
  analysisScope = signal<'chapter' | 'document'>('chapter');
  showSentenceInspector = signal(false);

  // Audience Profiles
  audienceProfiles = this.readabilityService.profiles;
  selectedAudienceId = this.readabilityService.selectedAudienceId;
  currentAudienceProfile = this.readabilityService.currentAudienceProfile;

  // Active Readability Metrics based on Scope
  currentMetrics = computed<ReadabilityMetrics>(() => {
    return this.analysisScope() === 'chapter'
      ? this.blockService.activeChapterReadability()
      : this.blockService.fullDocumentReadability();
  });

  // Audience Calibration Evaluation
  audienceMatch = computed<AudienceMatchResult>(() => {
    return this.readabilityService.evaluateAudienceMatch(
      this.currentMetrics(),
      this.currentAudienceProfile()
    );
  });

  // Sentence Distribution Percentages
  sentenceDistribution = computed(() => {
    const m = this.currentMetrics();
    const total = m.sentenceCount || 1;
    return {
      shortPct: Math.max(0, Math.min(100, Math.round((m.shortSentencesCount / total) * 100))),
      mediumPct: Math.max(0, Math.min(100, Math.round((m.mediumSentencesCount / total) * 100))),
      longPct: Math.max(0, Math.min(100, Math.round((m.longSentencesCount / total) * 100)))
    };
  });

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

  onAudienceChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.readabilityService.setTargetAudience(select.value as AudienceLevelId);
  }

  getReadingEaseBarColor(score: number): string {
    if (score >= 80) return '#10b981'; // emerald
    if (score >= 60) return '#059669'; // darker emerald
    if (score >= 50) return '#f59e0b'; // amber
    if (score >= 30) return '#6366f1'; // indigo
    return '#f43f5e'; // rose
  }

  applyGoals() {
    this.blockService.updateGoals(this.docTargetInput, this.dailyTargetInput);
  }

  recordSnapshot() {
    this.blockService.recordWordCountSnapshot();
  }
}
