import { Injectable, signal, computed, inject } from '@angular/core';

export interface ReadabilityMetrics {
  // Counts
  characterCount: number;
  letterCount: number;
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
  complexWordCount: number; // Words with 3+ syllables

  // Averages
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  avgLettersPerWord: number;
  complexWordPercentage: number;

  // Readability Scores
  fleschReadingEase: number; // 0 to 100 (higher = easier)
  fleschKincaidGradeLevel: number; // US School Grade Level
  gunningFogIndex: number;
  colemanLiauIndex: number;
  automatedReadabilityIndex: number;

  // Qualitative interpretations
  readingEaseLabel: string;
  readingEaseColor: string; // Tailwind color class
  gradeLevelEquivalent: string;
  typicalAgeRange: string;
  estimatedReadingTimeMinutes: number;

  // Sentence distribution
  shortSentencesCount: number; // < 12 words
  mediumSentencesCount: number; // 12 - 24 words
  longSentencesCount: number; // > 24 words
  longestSentences: { text: string; wordCount: number }[];
}

export type AudienceLevelId =
  | 'middle_grade'
  | 'young_adult'
  | 'general_fiction'
  | 'literary_fiction'
  | 'academic_tech'
  | 'casual_web';

export interface AudienceProfile {
  id: AudienceLevelId;
  name: string;
  shortLabel: string;
  description: string;
  targetGradeMin: number;
  targetGradeMax: number;
  targetFleschMin: number;
  targetFleschMax: number;
  benchmarkExamples: string;
  recommendedSentenceLength: string;
}

export interface AudienceMatchResult {
  status: 'optimal' | 'slightly_dense' | 'too_dense' | 'slightly_simple' | 'too_simple';
  label: string;
  badgeClass: string;
  badgeBg: string;
  message: string;
  actionableTip: string;
  deltaGrade: number;
}

export const AUDIENCE_PROFILES: AudienceProfile[] = [
  {
    id: 'middle_grade',
    name: 'Middle Grade (Ages 8–12)',
    shortLabel: 'Middle Grade',
    description: 'Adventurous, accessible prose for late-elementary to middle school readers.',
    targetGradeMin: 4.0,
    targetGradeMax: 6.5,
    targetFleschMin: 75,
    targetFleschMax: 90,
    benchmarkExamples: 'Percy Jackson, Roald Dahl, Harry Potter (Books 1–2)',
    recommendedSentenceLength: '10–14 words'
  },
  {
    id: 'young_adult',
    name: 'Young Adult (Ages 12–16)',
    shortLabel: 'Young Adult',
    description: 'Punchy, emotionally resonant pacing with moderate syntactic complexity.',
    targetGradeMin: 6.0,
    targetGradeMax: 8.5,
    targetFleschMin: 65,
    targetFleschMax: 80,
    benchmarkExamples: 'The Hunger Games, Divergent, John Green, Leigh Bardugo',
    recommendedSentenceLength: '12–17 words'
  },
  {
    id: 'general_fiction',
    name: 'Commercial & Bestseller Fiction',
    shortLabel: 'Commercial Fiction',
    description: 'Gold-standard balance for broad adult fiction, thrillers, romance, and memoirs.',
    targetGradeMin: 7.0,
    targetGradeMax: 9.5,
    targetFleschMin: 60,
    targetFleschMax: 75,
    benchmarkExamples: 'Stephen King, Dan Brown, Gillian Flynn, Colleen Hoover',
    recommendedSentenceLength: '14–19 words'
  },
  {
    id: 'literary_fiction',
    name: 'Literary & Complex Fiction',
    shortLabel: 'Literary Fiction',
    description: 'Rich cadence, layered metaphors, multi-clause periods, and elevated vocabulary.',
    targetGradeMin: 9.5,
    targetGradeMax: 13.0,
    targetFleschMin: 45,
    targetFleschMax: 62,
    benchmarkExamples: 'Toni Morrison, Cormac McCarthy, Donna Tartt, Hilary Mantel',
    recommendedSentenceLength: '18–26 words'
  },
  {
    id: 'academic_tech',
    name: 'Academic & Non-Fiction',
    shortLabel: 'Academic / Technical',
    description: 'Dense analysis, specialized domain terminology, citations, and formal discourse.',
    targetGradeMin: 12.0,
    targetGradeMax: 18.0,
    targetFleschMin: 30,
    targetFleschMax: 50,
    benchmarkExamples: 'Scientific papers, University Press monographs, Law Reviews',
    recommendedSentenceLength: '20–30 words'
  },
  {
    id: 'casual_web',
    name: 'Casual Web & Serial Fiction',
    shortLabel: 'Casual / Web Serial',
    description: 'Crisp, scannable reading optimized for mobile screens and quick narrative consumption.',
    targetGradeMin: 5.0,
    targetGradeMax: 7.5,
    targetFleschMin: 70,
    targetFleschMax: 88,
    benchmarkExamples: 'Royal Road, Wattpad, Substack newsletters, AO3 serials',
    recommendedSentenceLength: '11–15 words'
  }
];

@Injectable({
  providedIn: 'root'
})
export class ReadabilityService {
  readonly profiles = AUDIENCE_PROFILES;

  // Selected Target Audience (persisted in localStorage)
  readonly selectedAudienceId = signal<AudienceLevelId>(this.getInitialAudience());

  readonly currentAudienceProfile = computed(() => {
    const id = this.selectedAudienceId();
    return this.profiles.find(p => p.id === id) || this.profiles[2]; // Default to general_fiction
  });

  setTargetAudience(audienceId: AudienceLevelId) {
    this.selectedAudienceId.set(audienceId);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('doc_target_audience_level', audienceId);
      } catch {
        // Ignore storage exceptions
      }
    }
  }

  private getInitialAudience(): AudienceLevelId {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem('doc_target_audience_level') as AudienceLevelId;
        if (saved && AUDIENCE_PROFILES.some(p => p.id === saved)) {
          return saved;
        }
      } catch {
        // Fallback
      }
    }
    return 'general_fiction';
  }

  /**
   * Main analysis function: computes comprehensive readability metrics for any HTML or text input.
   */
  analyzeText(rawInput: string): ReadabilityMetrics {
    if (!rawInput || !rawInput.trim()) {
      return this.getEmptyMetrics();
    }

    // Strip HTML tags and normalize whitespace
    const plainText = this.stripHtml(rawInput);
    if (!plainText.trim()) {
      return this.getEmptyMetrics();
    }

    const sentences = this.splitIntoSentences(plainText);
    const words = this.extractWords(plainText);

    const wordCount = words.length;
    if (wordCount === 0) {
      return this.getEmptyMetrics();
    }

    const sentenceCount = Math.max(1, sentences.length);
    const characterCount = plainText.length;
    const letterCount = plainText.replace(/[^a-zA-Z]/g, '').length;

    // Syllable calculation
    let totalSyllables = 0;
    let complexWordCount = 0;

    for (const word of words) {
      const syl = this.countSyllables(word);
      totalSyllables += syl;
      if (syl >= 3) {
        complexWordCount++;
      }
    }

    // Averages
    const avgWordsPerSentence = wordCount / sentenceCount;
    const avgSyllablesPerWord = totalSyllables / wordCount;
    const avgLettersPerWord = letterCount / wordCount;
    const complexWordPercentage = (complexWordCount / wordCount) * 100;

    // 1. Flesch Reading Ease
    // Formula: 206.835 - (1.015 * ASL) - (84.6 * ASW)
    let fleschReadingEase = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    fleschReadingEase = Math.max(0, Math.min(100, Math.round(fleschReadingEase * 10) / 10));

    // 2. Flesch-Kincaid Grade Level
    // Formula: (0.39 * ASL) + (11.8 * ASW) - 15.59
    let fleschKincaidGradeLevel = (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59;
    fleschKincaidGradeLevel = Math.max(0, Math.round(fleschKincaidGradeLevel * 10) / 10);

    // 3. Gunning Fog Index
    // Formula: 0.4 * (ASL + complexWordPercentage)
    let gunningFogIndex = 0.4 * (avgWordsPerSentence + complexWordPercentage);
    gunningFogIndex = Math.max(0, Math.round(gunningFogIndex * 10) / 10);

    // 4. Coleman-Liau Index
    // Formula: 0.0588 * L - 0.296 * S - 15.8 (L = letters per 100 words, S = sentences per 100 words)
    const L = (letterCount / wordCount) * 100;
    const S = (sentenceCount / wordCount) * 100;
    let colemanLiauIndex = (0.0588 * L) - (0.296 * S) - 15.8;
    colemanLiauIndex = Math.max(0, Math.round(colemanLiauIndex * 10) / 10);

    // 5. Automated Readability Index (ARI)
    // Formula: 4.71 * (chars / words) + 0.5 * (words / sentences) - 21.43
    let automatedReadabilityIndex = 4.71 * (letterCount / wordCount) + 0.5 * avgWordsPerSentence - 21.43;
    automatedReadabilityIndex = Math.max(0, Math.round(automatedReadabilityIndex * 10) / 10);

    // Sentence length distributions
    let shortSentencesCount = 0;
    let mediumSentencesCount = 0;
    let longSentencesCount = 0;

    const sentenceDetails: { text: string; wordCount: number }[] = [];

    for (const s of sentences) {
      const sWords = this.extractWords(s);
      const count = sWords.length;
      if (count === 0) continue;

      if (count < 12) shortSentencesCount++;
      else if (count <= 24) mediumSentencesCount++;
      else longSentencesCount++;

      sentenceDetails.push({
        text: s.trim(),
        wordCount: count
      });
    }

    // Top longest sentences (up to 3 for user review)
    sentenceDetails.sort((a, b) => b.wordCount - a.wordCount);
    const longestSentences = sentenceDetails.slice(0, 3);

    const interpretations = this.interpretFleschScore(fleschReadingEase, fleschKincaidGradeLevel);

    return {
      characterCount,
      letterCount,
      wordCount,
      sentenceCount,
      syllableCount: totalSyllables,
      complexWordCount,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
      avgLettersPerWord: Math.round(avgLettersPerWord * 10) / 10,
      complexWordPercentage: Math.round(complexWordPercentage * 10) / 10,
      fleschReadingEase,
      fleschKincaidGradeLevel,
      gunningFogIndex,
      colemanLiauIndex,
      automatedReadabilityIndex,
      readingEaseLabel: interpretations.readingEaseLabel,
      readingEaseColor: interpretations.readingEaseColor,
      gradeLevelEquivalent: interpretations.gradeLevelEquivalent,
      typicalAgeRange: interpretations.typicalAgeRange,
      estimatedReadingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
      shortSentencesCount,
      mediumSentencesCount,
      longSentencesCount,
      longestSentences
    };
  }

  /**
   * Matches calculated metrics against a selected audience profile and gives actionable feedback.
   */
  evaluateAudienceMatch(metrics: ReadabilityMetrics, profile: AudienceProfile): AudienceMatchResult {
    if (metrics.wordCount < 15) {
      return {
        status: 'optimal',
        label: 'Awaiting Content',
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
        badgeBg: '#64748b',
        message: 'Write a few paragraphs to calculate audience calibration.',
        actionableTip: 'At least 50–100 words provide optimal statistical accuracy.',
        deltaGrade: 0
      };
    }

    const currentGrade = metrics.fleschKincaidGradeLevel;
    const targetMid = (profile.targetGradeMin + profile.targetGradeMax) / 2;
    const deltaGrade = Math.round((currentGrade - targetMid) * 10) / 10;

    if (currentGrade >= profile.targetGradeMin && currentGrade <= profile.targetGradeMax) {
      return {
        status: 'optimal',
        label: 'Optimal Audience Match',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badgeBg: '#10b981',
        message: `Your prose matches the complexity level of typical ${profile.shortLabel} works.`,
        actionableTip: `Current sentence rhythm (${metrics.avgWordsPerSentence} words/sentence) and vocabulary fit comfortably within ${profile.recommendedSentenceLength}.`,
        deltaGrade
      };
    }

    if (currentGrade > profile.targetGradeMax + 2.5) {
      return {
        status: 'too_dense',
        label: 'Significantly Too Dense',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        badgeBg: '#f43f5e',
        message: `Grade ${currentGrade} is much higher than the ${profile.targetGradeMin}–${profile.targetGradeMax} target for ${profile.shortLabel}.`,
        actionableTip: `Average sentence length is ${metrics.avgWordsPerSentence} words (target is ${profile.recommendedSentenceLength}). Split multi-clause sentences and replace high-syllable terms.`,
        deltaGrade
      };
    }

    if (currentGrade > profile.targetGradeMax) {
      return {
        status: 'slightly_dense',
        label: 'Slightly Dense for Audience',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        badgeBg: '#f59e0b',
        message: `Grade ${currentGrade} slightly exceeds the ${profile.targetGradeMin}–${profile.targetGradeMax} range for ${profile.shortLabel}.`,
        actionableTip: `A few longer sentences or polysyllabic words are elevating the score. Review the longest sentences flagged below.`,
        deltaGrade
      };
    }

    if (currentGrade < profile.targetGradeMin - 2.5) {
      return {
        status: 'too_simple',
        label: 'Substantially Too Simple',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        badgeBg: '#3b82f6',
        message: `Grade ${currentGrade} is noticeably below the ${profile.targetGradeMin}–${profile.targetGradeMax} expectation for ${profile.shortLabel}.`,
        actionableTip: `Prose may feel overly choppy or repetitive. Consider combining short simple sentences to build narrative cadence.`,
        deltaGrade
      };
    }

    // Slightly simple
    return {
      status: 'slightly_simple',
      label: 'Slightly More Accessible',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
      badgeBg: '#0ea5e9',
      message: `Grade ${currentGrade} is slightly below the ${profile.targetGradeMin}–${profile.targetGradeMax} target, making it very quick and accessible.`,
      actionableTip: `Easy to read, but you have room to introduce more nuanced sentence structures if you want richer narrative texture.`,
      deltaGrade
    };
  }

  /**
   * Helper: Strip HTML and preserve sentence punctuation boundaries.
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '.\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Helper: Accurately split text into sentences, protecting common abbreviations.
   */
  private splitIntoSentences(text: string): string[] {
    if (!text.trim()) return [];

    // Replace common abbreviations to prevent incorrect splits
    let protectedText = text
      .replace(/\bMr\./gi, 'Mr__DOT__')
      .replace(/\bMrs\./gi, 'Mrs__DOT__')
      .replace(/\bMs\./gi, 'Ms__DOT__')
      .replace(/\bDr\./gi, 'Dr__DOT__')
      .replace(/\bProf\./gi, 'Prof__DOT__')
      .replace(/\bSt\./gi, 'St__DOT__')
      .replace(/\bSr\./gi, 'Sr__DOT__')
      .replace(/\bJr\./gi, 'Jr__DOT__')
      .replace(/\be\.g\./gi, 'eg__DOT__')
      .replace(/\bi\.e\./gi, 'ie__DOT__')
      .replace(/\betc\./gi, 'etc__DOT__')
      .replace(/\bvs\./gi, 'vs__DOT__')
      .replace(/\bapprox\./gi, 'approx__DOT__')
      .replace(/\bNo\./gi, 'No__DOT__')
      .replace(/(\d+)\.(\d+)/g, '$1__DECIMAL__$2')
      .replace(/\.{3,}/g, '__ELLIPSIS__');

    // Split on terminal punctuation followed by space or end of string
    const rawSentences = protectedText.split(/(?<=[.!?])\s+(?=[A-Z0-9"“'‘—])|[\r\n]+/);

    const cleanSentences: string[] = [];
    for (const raw of rawSentences) {
      const restored = raw
        .replace(/__DOT__/g, '.')
        .replace(/__DECIMAL__/g, '.')
        .replace(/__ELLIPSIS__/g, '...')
        .trim();

      // Only count segments that contain at least one word character
      if (restored && /[a-zA-Z0-9]/.test(restored)) {
        cleanSentences.push(restored);
      }
    }

    return cleanSentences.length > 0 ? cleanSentences : [text.trim()];
  }

  /**
   * Helper: Extract clean words from text.
   */
  private extractWords(text: string): string[] {
    const matched = text.match(/[a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?/g);
    return matched ? matched.filter(w => w.length > 0) : [];
  }

  /**
   * Robust English syllable counter with heuristics for common endings and diphthongs.
   */
  countSyllables(rawWord: string): number {
    const word = rawWord.toLowerCase().replace(/[^a-z]/g, '');
    if (!word) return 0;
    if (word.length <= 3) return 1;

    let clean = word;

    // Handle silent 'e' at end
    if (clean.endsWith('e')) {
      // If preceded by 'le' after consonant, 'le' is its own syllable (bottle, middle, table)
      if (clean.length > 2 && clean.endsWith('le') && !/[aeiouy]/.test(clean[clean.length - 3])) {
        // keep it
      } else {
        clean = clean.slice(0, -1);
      }
    }

    // Handle trailing 'ed'
    if (clean.endsWith('ed')) {
      // 'ted' and 'ded' form a syllable (hunted, decided), others don't (walked, looked)
      if (!clean.endsWith('ted') && !clean.endsWith('ded')) {
        clean = clean.slice(0, -2);
      }
    }

    // Handle trailing 'es'
    if (clean.endsWith('es')) {
      // 'ses', 'zes', 'ches', 'shes' form a syllable, others don't (makes, takes)
      if (!/(?:s|z|ch|sh)es$/.test(clean)) {
        clean = clean.slice(0, -2);
      }
    }

    // Count vowel groups
    const vowelMatches = clean.match(/[aeiouy]+/g);
    let count = vowelMatches ? vowelMatches.length : 0;

    // Special case adjustments
    if (/ia|io|iu|eo|ua|uo/.test(clean)) {
      count++; // often separate syllables like in 'radiant', 'champion', 'video'
    }

    return Math.max(1, count);
  }

  private interpretFleschScore(fre: number, grade: number): {
    readingEaseLabel: string;
    readingEaseColor: string;
    gradeLevelEquivalent: string;
    typicalAgeRange: string;
  } {
    let readingEaseLabel = 'Standard / Plain English';
    let readingEaseColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';

    if (fre >= 90) {
      readingEaseLabel = 'Very Easy / Conversational';
      readingEaseColor = 'text-teal-700 bg-teal-50 border-teal-200';
    } else if (fre >= 80) {
      readingEaseLabel = 'Easy / Plain English';
      readingEaseColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (fre >= 70) {
      readingEaseLabel = 'Fairly Easy / Fluid';
      readingEaseColor = 'text-green-700 bg-green-50 border-green-200';
    } else if (fre >= 60) {
      readingEaseLabel = 'Standard / Commercial';
      readingEaseColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (fre >= 50) {
      readingEaseLabel = 'Fairly Difficult / Sophisticated';
      readingEaseColor = 'text-amber-700 bg-amber-50 border-amber-200';
    } else if (fre >= 30) {
      readingEaseLabel = 'Difficult / Academic';
      readingEaseColor = 'text-indigo-700 bg-indigo-50 border-indigo-200';
    } else {
      readingEaseLabel = 'Very Difficult / Technical';
      readingEaseColor = 'text-rose-700 bg-rose-50 border-rose-200';
    }

    let gradeLevelEquivalent = '8th & 9th Grade';
    let typicalAgeRange = '13–15 years old';

    if (grade < 5) {
      gradeLevelEquivalent = '3rd–4th Grade (Elementary)';
      typicalAgeRange = '8–10 years old';
    } else if (grade < 7) {
      gradeLevelEquivalent = '5th–6th Grade (Middle School)';
      typicalAgeRange = '10–12 years old';
    } else if (grade < 9) {
      gradeLevelEquivalent = '7th–8th Grade (Junior High)';
      typicalAgeRange = '12–14 years old';
    } else if (grade < 11) {
      gradeLevelEquivalent = '9th–10th Grade (High School)';
      typicalAgeRange = '14–16 years old';
    } else if (grade < 13) {
      gradeLevelEquivalent = '11th–12th Grade (Senior High)';
      typicalAgeRange = '16–18 years old';
    } else if (grade < 16) {
      gradeLevelEquivalent = 'College Undergraduate';
      typicalAgeRange = '18–22 years old';
    } else {
      gradeLevelEquivalent = 'College Graduate / Professional';
      typicalAgeRange = '22+ years old';
    }

    return {
      readingEaseLabel,
      readingEaseColor,
      gradeLevelEquivalent,
      typicalAgeRange
    };
  }

  private getEmptyMetrics(): ReadabilityMetrics {
    return {
      characterCount: 0,
      letterCount: 0,
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      complexWordCount: 0,
      avgWordsPerSentence: 0,
      avgSyllablesPerWord: 0,
      avgLettersPerWord: 0,
      complexWordPercentage: 0,
      fleschReadingEase: 100,
      fleschKincaidGradeLevel: 0,
      gunningFogIndex: 0,
      colemanLiauIndex: 0,
      automatedReadabilityIndex: 0,
      readingEaseLabel: 'No Text Analyzed',
      readingEaseColor: 'text-gray-600 bg-gray-50 border-gray-200',
      gradeLevelEquivalent: 'N/A',
      typicalAgeRange: 'N/A',
      estimatedReadingTimeMinutes: 0,
      shortSentencesCount: 0,
      mediumSentencesCount: 0,
      longSentencesCount: 0,
      longestSentences: []
    };
  }
}
