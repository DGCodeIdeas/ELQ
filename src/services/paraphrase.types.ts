export interface DocumentTypeDefinition {
  id: string;
  name: string;
  category: 'Fiction & Creative' | 'Academic & Research' | 'Legal & Regulatory' | 'Professional & Business' | 'Specialized & Media';
  description: string;
  badge: string;
  isMature?: boolean;
  icon: string;
}

export interface ParaphraseStyleDefinition {
  id: string;
  name: string;
  description: string;
  badge: string;
  icon: string;
}

export interface ParaphraseAlternative {
  id?: string;
  text: string;
  label: string;
  tone: string;
  explanation: string;
  fitScore: number;
}

export interface ParaphraseRequest {
  text: string;
  selectionType?: 'word' | 'sentence' | 'paragraph';
  documentType?: string;
  style?: string;
  customInstruction?: string;
  surroundingContext?: string;
  isDocUncensored?: boolean;
  customKey?: string;
}

export interface ParaphraseResponse {
  selectionType: 'word' | 'sentence' | 'paragraph';
  documentType: string;
  style: string;
  alternatives: ParaphraseAlternative[];
}

export const DOCUMENT_TYPES: DocumentTypeDefinition[] = [
  // Fiction & Creative
  {
    id: 'novel_sfw',
    name: 'Novel / Fiction (SFW)',
    category: 'Fiction & Creative',
    description: 'Literary narrative cadence, dialogue realism, character interiority, balanced pacing.',
    badge: 'SFW Fiction',
    icon: 'auto_stories'
  },
  {
    id: 'novel_nsfw',
    name: 'Novel / Romance / Erotica (NSFW)',
    category: 'Fiction & Creative',
    description: 'Visceral sensory intimacy, uninhibited emotional tension, tactile prose, somatic descriptions.',
    badge: 'Mature 18+',
    isMature: true,
    icon: 'favorite'
  },
  {
    id: 'fantasy_scifi',
    name: 'Fantasy & Sci-Fi',
    category: 'Fiction & Creative',
    description: 'Imaginative worldbuilding terminology, speculative atmosphere, epic or grounded scale.',
    badge: 'Speculative',
    icon: 'rocket_launch'
  },
  {
    id: 'thriller_mystery',
    name: 'Thriller & Mystery Noir',
    category: 'Fiction & Creative',
    description: 'Terse suspense, atmospheric shadows, high narrative stakes, punchy pacing.',
    badge: 'Suspense',
    icon: 'visibility'
  },
  {
    id: 'horror_gothic',
    name: 'Horror & Gothic',
    category: 'Fiction & Creative',
    description: 'Macabre imagery, psychological dread, uncanny details, atmospheric tension.',
    badge: 'Dark Fiction',
    icon: 'dark_mode'
  },
  {
    id: 'ya_contemporary',
    name: 'YA & Contemporary Fiction',
    category: 'Fiction & Creative',
    description: 'Emotionally resonant, youthful cadence, voice-forward dialogue, modern pacing.',
    badge: 'Contemporary',
    icon: 'sentiment_satisfied'
  },
  {
    id: 'historical_fiction',
    name: 'Historical Fiction',
    category: 'Fiction & Creative',
    description: 'Period-authentic idiom, historical decorum, tactile epochal atmosphere.',
    badge: 'Historical',
    icon: 'history_edu'
  },
  {
    id: 'poetry_lyrical',
    name: 'Poetry & Lyrical Prose',
    category: 'Fiction & Creative',
    description: 'Rhythmic cadence, meter, figurative resonance, evocative sensory symbolism.',
    badge: 'Lyrical',
    icon: 'format_quote'
  },
  {
    id: 'fanfiction_ao3',
    name: 'Fanfiction / AO3 Works',
    category: 'Fiction & Creative',
    description: 'Character voice fidelity, emotional beats (fluff, angst, hurt/comfort, slow burn), trope awareness.',
    badge: 'Fandom / Tropes',
    icon: 'diversity_3'
  },

  // Academic & Research
  {
    id: 'academic_research',
    name: 'Academic Research Paper',
    category: 'Academic & Research',
    description: 'Scholarly rigor, empirical hedging ("the data suggests"), third-person formal authority.',
    badge: 'Peer-Reviewed',
    icon: 'school'
  },
  {
    id: 'thesis_dissertation',
    name: 'Dissertation & Thesis',
    category: 'Academic & Research',
    description: 'High-density theoretical grounding, formal methodology, systematic epistemological synthesis.',
    badge: 'Postgraduate',
    icon: 'menu_book'
  },
  {
    id: 'literature_review',
    name: 'Academic Literature Review',
    category: 'Academic & Research',
    description: 'Dialectical synthesis, critical contrasting of sources, scholarly consensus analysis.',
    badge: 'Scholarly',
    icon: 'library_books'
  },
  {
    id: 'scientific_stem',
    name: 'STEM & Technical Report',
    category: 'Academic & Research',
    description: 'Empirical precision, unambiguous terminology, clear causal logic, active/passive efficiency.',
    badge: 'STEM Precision',
    icon: 'science'
  },
  {
    id: 'humanities_philosophy',
    name: 'Philosophy & Humanities Essay',
    category: 'Academic & Research',
    description: 'Conceptual nuance, dialectical argumentation, discursive clarity, philosophical rigor.',
    badge: 'Humanities',
    icon: 'psychology'
  },

  // Legal & Regulatory
  {
    id: 'legal_contract',
    name: 'Legal Contract & Commercial Agreement',
    category: 'Legal & Regulatory',
    description: 'Operative covenants, conditions precedent ("shall", "herein", "notwithstanding"), strict unambiguous drafting.',
    badge: 'Binding Contract',
    icon: 'gavel'
  },
  {
    id: 'legal_brief',
    name: 'Legal Brief & Court Motion',
    category: 'Legal & Regulatory',
    description: 'Persuasive jurisprudence, precedent-oriented argumentation, statutory rhetoric.',
    badge: 'Jurisprudence',
    icon: 'balance'
  },
  {
    id: 'compliance_policy',
    name: 'Privacy Policy & Terms (ToS)',
    category: 'Legal & Regulatory',
    description: 'Regulatory clarity, statutory transparency, consumer rights, standard liability disclaimers.',
    badge: 'Regulatory',
    icon: 'policy'
  },

  // Professional & Business
  {
    id: 'business_memo',
    name: 'Executive Brief & Business Memo',
    category: 'Professional & Business',
    description: 'High-impact executive clarity, action-oriented, direct ROI and strategic focus, zero fluff.',
    badge: 'Executive',
    icon: 'trending_up'
  },
  {
    id: 'technical_docs',
    name: 'Technical Specs & Documentation',
    category: 'Professional & Business',
    description: 'Unambiguous step-by-step clarity, concise developer instructions, active imperative tone.',
    badge: 'Tech Specs',
    icon: 'code'
  },
  {
    id: 'marketing_copy',
    name: 'Strategic Marketing Copy',
    category: 'Professional & Business',
    description: 'Compelling value proposition, persuasive hook, engaging cadence, customer empathy.',
    badge: 'Copywriting',
    icon: 'campaign'
  },

  // Specialized & Media
  {
    id: 'journalism_news',
    name: 'Journalism & Reportage',
    category: 'Specialized & Media',
    description: 'Inverted pyramid structure, journalistic objectivity, crisp and engaging reportorial tone.',
    badge: 'Editorial',
    icon: 'newspaper'
  },
  {
    id: 'memoir_essay',
    name: 'Personal Essay & Memoir',
    category: 'Specialized & Media',
    description: 'Intimate first-person vulnerability, reflective introspection, evocative personal voice.',
    badge: 'Creative Non-Fiction',
    icon: 'draw'
  }
];

export const PARAPHRASE_STYLES: ParaphraseStyleDefinition[] = [
  {
    id: 'natural',
    name: 'Natural & Fluent',
    description: 'Smooth, native, effortless flow. Eliminates awkwardness while maintaining core meaning.',
    badge: 'Balanced',
    icon: 'waves'
  },
  {
    id: 'closer',
    name: 'Closer to Original',
    description: 'Micro-edit preserving your exact sentence structure and syntax, only refining cadence.',
    badge: 'Minimal Change',
    icon: 'tune'
  },
  {
    id: 'vivid',
    name: 'Descriptive & Sensory',
    description: 'Enriches visual, tactile, and auditory imagery with immersive atmosphere.',
    badge: 'Sensory Texture',
    icon: 'palette'
  },
  {
    id: 'concise',
    name: 'Concise & Punchy',
    description: 'Trims bloat, cuts filler words, and delivers maximum impact with fewer words.',
    badge: 'Direct Impact',
    icon: 'content_cut'
  },
  {
    id: 'dramatic',
    name: 'Dramatic & Intense',
    description: 'Heightens urgency, emotional stakes, tension, and visceral resonance.',
    badge: 'High Tension',
    icon: 'bolt'
  },
  {
    id: 'formal',
    name: 'Formal & Rigorous',
    description: 'Elevates vocabulary, enhances scholarly/professional polish and authoritative poise.',
    badge: 'Elevated Poise',
    icon: 'verified'
  },
  {
    id: 'simplified',
    name: 'Plain Language',
    description: 'Clears away dense jargon, making the thought direct, transparent, and readable.',
    badge: 'Crystal Clear',
    icon: 'lightbulb'
  },
  {
    id: 'active',
    name: 'Active & Dynamic',
    description: 'Replaces passive constructions with strong, vibrant, forward-moving verbs.',
    badge: 'Dynamic Action',
    icon: 'directions_run'
  },
  {
    id: 'lyrical',
    name: 'Lyrical & Figurative',
    description: 'Infuses poetic rhythm, evocative metaphors, and musical sentence cadence.',
    badge: 'Poetic Flow',
    icon: 'music_note'
  },
  {
    id: 'dialogue',
    name: 'Conversational & Dialogue',
    description: 'Natural spoken vernacular, authentic pauses, and human vocal rhythm.',
    badge: 'Spoken Voice',
    icon: 'chat'
  }
];
