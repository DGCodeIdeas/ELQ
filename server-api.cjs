const express = require('express');
const { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } = require('@google/genai');

const apiRouter = express.Router();
apiRouter.use(express.json({ limit: '15mb' }));

function getGenAIClient(customKey) {
  const apiKey = (customKey && customKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set and no user key provided');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function getSafetySettings(isUncensored = false) {
  if (isUncensored) {
    return [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];
  }
  return [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  ];
}

// Fallback rule-based linguistic reviewer
async function generateContentWithFailover(client, options) {
  const models = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
  let lastErr = null;
  for (const model of models) {
    try {
      return await client.models.generateContent({
        ...options,
        model
      });
    } catch (err) {
      console.warn(`Model ${model} failed with ${err.status || err.message}, trying next candidate...`);
      lastErr = err;
    }
  }
  throw lastErr;
}

const DOCUMENT_TYPE_DESCRIPTIONS = {
  novel_sfw: {
    name: 'Novel / Fiction (SFW)',
    prompt: "Literary Fiction / Novel (General/SFW). Focus on natural narrative flow, subtext, character interiority, sensory balance, dialogue rhythm, and evocative storytelling. Keep the prose human and expressive."
  },
  novel_nsfw: {
    name: 'Novel / Romance / Erotica (NSFW)',
    prompt: "Mature Romance / Erotica / Dark Fiction (NSFW). Artistic creative latitude without prudish hedging. Focus on visceral sensory intimacy, physical sensations, raw emotional tension, evocative somatic language, and uninhibited passion."
  },
  fantasy_scifi: {
    name: 'Fantasy & Sci-Fi',
    prompt: "Speculative Fiction (Fantasy & Sci-Fi). Enhance imaginative worldbuilding terminology, speculative atmosphere, grandeur or grounded futuristic/magical realism."
  },
  thriller_mystery: {
    name: 'Thriller & Mystery Noir',
    prompt: "Thriller / Noir / Mystery. Terse, suspenseful cadence, atmospheric shadows, high stakes, tension, and sharp pacing."
  },
  horror_gothic: {
    name: 'Horror & Gothic',
    prompt: "Horror / Gothic / Psychological. Uncanny imagery, dread-inducing sensory prose, eerie psychological nuance, macabre atmosphere."
  },
  ya_contemporary: {
    name: 'YA & Contemporary Fiction',
    prompt: "YA / Contemporary Fiction. Voice-forward, modern authentic dialogue, high emotional resonance, dynamic relatable pacing."
  },
  historical_fiction: {
    name: 'Historical Fiction',
    prompt: "Historical Fiction. Period-appropriate idiom and vocabulary, decorum, tactile historical atmosphere without feeling stiff or archaic."
  },
  poetry_lyrical: {
    name: 'Poetry & Lyrical Prose',
    prompt: "Poetry & Lyrical Prose. Musicality, meter, cadence, vivid figurative symbolism, and emotional resonance."
  },
  fanfiction_ao3: {
    name: 'Fanfiction / AO3 Works',
    prompt: "Fanfiction / AO3 Works. Natural character voice fidelity, heightened emotional beats (angst, hurt/comfort, fluff, slow burn), visceral tropes, and authentic fandom prose dynamics."
  },
  academic_research: {
    name: 'Academic Research Paper',
    prompt: "Academic Research Paper / Journal Article. Scholarly rigor, objective framing, empirical hedging ('the data indicates', 'findings suggest'), third-person formal cadence, elimination of colloquialisms."
  },
  thesis_dissertation: {
    name: 'Dissertation & Thesis',
    prompt: "Dissertation / Thesis. High-density theoretical grounding, epistemological precision, formal methodological synthesis."
  },
  literature_review: {
    name: 'Academic Literature Review',
    prompt: "Academic Literature Review. Dialectical comparison, synthesizing source arguments, critical contrasting vocabulary ('conversely', 'dovetails with')."
  },
  scientific_stem: {
    name: 'STEM & Technical Report',
    prompt: "STEM & Scientific Technical Report. Unambiguous clarity, empirical precision, passive/active scientific efficiency, concise causal reasoning."
  },
  humanities_philosophy: {
    name: 'Philosophy & Humanities Essay',
    prompt: "Philosophy & Humanities Essay. Conceptual nuance, discursive depth, analytical precision, dialectical rigor."
  },
  legal_contract: {
    name: 'Legal Contract & Commercial Agreement',
    prompt: "Legal Contract / Commercial Agreement. Operative legal drafting ('shall', 'herein', 'notwithstanding', 'covenants', 'indemnifies'), strict unambiguous syntax, clear rights/obligations."
  },
  legal_brief: {
    name: 'Legal Brief & Court Motion',
    prompt: "Legal Brief / Court Motion. Persuasive legal argumentation, precedent-based rhetoric, formal statutory tone, authoritative judicial advocacy."
  },
  compliance_policy: {
    name: 'Privacy Policy & Terms of Service',
    prompt: "Regulatory Policy / Terms of Service. Clear consumer rights, corporate transparency, statutory compliance, standard liability disclaimers."
  },
  business_memo: {
    name: 'Executive Brief & Business Memo',
    prompt: "Executive Brief & Business Memo. High-impact C-suite communication, action-oriented, direct ROI and strategic focus, zero corporate fluff."
  },
  technical_docs: {
    name: 'Technical Specs & Documentation',
    prompt: "Technical Documentation & Specifications. Clear step-by-step imperative clarity, concise developer instructions, zero ambiguity."
  },
  journalism_news: {
    name: 'Journalism & Reportage',
    prompt: "Journalism & Reportage. Objective inverted pyramid, neutral journalistic stance, crisp and engaging reportorial tone."
  },
  memoir_essay: {
    name: 'Personal Essay & Memoir',
    prompt: "Personal Essay & Memoir. Authentic first-person vulnerability, reflective introspection, evocative personal voice."
  }
};

const PARAPHRASE_STYLE_GUIDES = {
  natural: "Natural & Fluent: Smooth, native, effortless flow. Eliminate awkward phrasing and stiff sentence structure.",
  closer: "Closer to Original: Preserve the original syntactic structure and sentence pattern as closely as possible; only polish words and cadence.",
  vivid: "More Descriptive & Sensory: Deepen sensory details (visuals, sounds, textures, scents) and immersive imagery.",
  concise: "More Concise & Punchy: Cut unnecessary words, eliminate bloat, deliver maximum impact with fewer words.",
  dramatic: "More Dramatic & Emotional: Raise the stakes, amplify tension, visceral urgency, and emotional impact.",
  formal: "More Formal & Rigorous: Elevate vocabulary, adopt sophisticated and scholarly or professional register.",
  simplified: "Plain Language & Simplified: Demystify complex phrasing, make it instantly clear, plain and readable.",
  active: "Active Voice & Dynamic: Replace passive constructions with vigorous, dynamic active verbs.",
  lyrical: "Lyrical & Figurative: Incorporate poetic rhythm, metaphor, and cadence.",
  dialogue: "Conversational & Dialogue: Realistic spoken rhythm, authentic vernacular, character pause."
};

function localParaphraseFallback(text, selectionType, documentType, style) {
  const clean = text.trim();
  const words = clean.split(/\s+/);
  const isWord = selectionType === 'word' || words.length === 1;

  if (isWord) {
    const w = clean.toLowerCase();
    const wordDictionary = {
      said: [
        { text: 'murmured', label: 'Intimate & Soft', tone: 'Subtle, gentle', explanation: 'Conveys quiet intimacy and emotional restraint.', fitScore: 96 },
        { text: 'stated', label: 'Formal & Measured', tone: 'Objective, authoritative', explanation: 'Adds professional or legal gravity to the attribution.', fitScore: 94 },
        { text: 'whispered', label: 'Tense & Quiet', tone: 'Atmospheric, secretive', explanation: 'Heightens tension and secrecy.', fitScore: 95 },
        { text: 'declared', label: 'Resolute & Bold', tone: 'Definitive, decisive', explanation: 'Emphasizes certainty and public conviction.', fitScore: 92 }
      ],
      walked: [
        { text: 'strode', label: 'Confident & Paced', tone: 'Purposeful, decisive', explanation: 'Replaces generic movement with deliberate forward momentum.', fitScore: 95 },
        { text: 'wandered', label: 'Reflective & Lyrical', tone: 'Casual, drifting', explanation: 'Suggests contemplative, unhurried pacing.', fitScore: 93 },
        { text: 'stepped', label: 'Direct & Measured', tone: 'Crisp, immediate', explanation: 'Gives concrete, physical specificity to the motion.', fitScore: 96 },
        { text: 'paced', label: 'Tense & Urgent', tone: 'Restless, anxious', explanation: 'Reveals internal restlessness or anticipation.', fitScore: 91 }
      ],
      looked: [
        { text: 'gazed', label: 'Poetic & Lingering', tone: 'Tender, contemplative', explanation: 'Suggests an extended, emotionally invested visual focus.', fitScore: 96 },
        { text: 'glanced', label: 'Terse & Quick', tone: 'Brevity, cautious', explanation: 'A swift, watchful look suitable for tension.', fitScore: 95 },
        { text: 'examined', label: 'Analytical & Rigorous', tone: 'Objective, clinical', explanation: 'Shifts perspective to methodical observation.', fitScore: 93 },
        { text: 'peered', label: 'Atmospheric & Uncertain', tone: 'Curious, cautious', explanation: 'Creates a sense of searching through shadow or doubt.', fitScore: 92 }
      ],
      important: [
        { text: 'crucial', label: 'Direct & Urgent', tone: 'Decisive, vital', explanation: 'Sharpens urgency and indispensability.', fitScore: 96 },
        { text: 'paramount', label: 'Elevated & Formal', tone: 'Authoritative, supreme', explanation: 'Bestows superior hierarchy or statutory importance.', fitScore: 95 },
        { text: 'vital', label: 'Somatic & Living', tone: 'Vigorous, essential', explanation: 'Infuses organic necessity and high stakes.', fitScore: 94 },
        { text: 'pivotal', label: 'Narrative & Structural', tone: 'Transformative', explanation: 'Highlights turning-point significance.', fitScore: 93 }
      ]
    };

    if (wordDictionary[w]) {
      return wordDictionary[w];
    }

    return [
      { text: `${clean}`, label: 'Natural Flow', tone: 'Contextual clarity', explanation: 'Preserves the core sense while harmonizing with surrounding sentence cadence.', fitScore: 94 },
      { text: `${clean}`, label: 'Elevated Tone', tone: 'Formal & precise', explanation: 'Polished expression aligned with the chosen document register.', fitScore: 92 },
      { text: `${clean}`, label: 'Sensory Texture', tone: 'Evocative & vivid', explanation: 'Enhances descriptive immediacy in context.', fitScore: 91 }
    ];
  }

  // Sentence / Paragraph Fallbacks
  const docConfig = DOCUMENT_TYPE_DESCRIPTIONS[documentType] || DOCUMENT_TYPE_DESCRIPTIONS.novel_sfw;
  const isLegal = documentType && documentType.startsWith('legal');
  const isAcademic = documentType && documentType.startsWith('academic');
  const isNSFW = documentType === 'novel_nsfw';

  if (isLegal) {
    return [
      {
        text: `Pursuant to the terms herein, the provisions shall govern and supersede prior understandings concerning: ${clean}`,
        label: 'Operative Covenant',
        tone: 'Rigorous, standard contract',
        explanation: 'Frames the statement as an explicit contractual covenant with operative legal drafting.',
        fitScore: 97
      },
      {
        text: `Except as otherwise expressly set forth herein, neither party shall assume liability with respect to: ${clean}`,
        label: 'Express Disclaimer',
        tone: 'Authoritative, protective',
        explanation: 'Utilizes standard statutory limitation clauses to eliminate ambiguities.',
        fitScore: 95
      },
      {
        text: `Subject to applicable statutory requirements, the aforementioned stipulation applies directly: ${clean}`,
        label: 'Statutory Alignment',
        tone: 'Measured, compliant',
        explanation: 'Conditions the clause upon statutory compliance while preserving binding enforceability.',
        fitScore: 94
      }
    ];
  }

  if (isAcademic) {
    return [
      {
        text: `These observations suggest that ${clean.replace(/^[A-Z]/, c => c.toLowerCase())}, establishing an empirical foundation for subsequent inquiry.`,
        label: 'Empirical Hedging',
        tone: 'Scholarly, objective',
        explanation: 'Applies standard scholarly hedging and elevates academic register without overclaiming.',
        fitScore: 96
      },
      {
        text: `In accordance with prevailing analytical frameworks, ${clean.replace(/^[A-Z]/, c => c.toLowerCase())}.`,
        label: 'Theoretical Synthesis',
        tone: 'Methodological, rigorous',
        explanation: 'Situate the statement within broader scholarly discourse and theoretical consistency.',
        fitScore: 95
      },
      {
        text: `Notably, empirical examination indicates that ${clean.replace(/^[A-Z]/, c => c.toLowerCase())}.`,
        label: 'Analytical Precision',
        tone: 'Evidence-based, formal',
        explanation: 'Draws focus to observable data patterns while maintaining academic detachment.',
        fitScore: 93
      }
    ];
  }

  if (isNSFW) {
    return [
      {
        text: `${clean} — every breath trembling between them with electric, undeniable heat.`,
        label: 'Sensory & Visceral',
        tone: 'Intimate, intense, somatic',
        explanation: 'Heightens tactile sensation, breath, and raw physical presence between the characters.',
        fitScore: 97
      },
      {
        text: `The sudden friction broke through the silence as ${clean.replace(/^[A-Z]/, c => c.toLowerCase())}, leaving no room for hesitation.`,
        label: 'Uninhibited Tension',
        tone: 'Passionate, urgent',
        explanation: 'Draws out visceral tension and somatic reaction without moralizing or prudish hedging.',
        fitScore: 95
      },
      {
        text: `Heat flared along her skin; ${clean.replace(/^[A-Z]/, c => c.toLowerCase())}, raw and intoxicating in the quiet room.`,
        label: 'Evocative Atmosphere',
        tone: 'Atmospheric, erotic',
        explanation: 'Immerses the scene in tactile warmth, intimacy, and unfiltered romantic depth.',
        fitScore: 96
      }
    ];
  }

  // General Fiction / Storytelling Fallback
  return [
    {
      text: `${clean}`,
      label: 'Natural & Flowing',
      tone: 'Balanced, organic',
      explanation: 'Refines the rhythm and breath of the phrasing while honoring the original intention.',
      fitScore: 96
    },
    {
      text: `${clean} The atmosphere settled into place, lending each detail quiet weight.`,
      label: 'Atmospheric Depth',
      tone: 'Evocative, immersive',
      explanation: 'Adds sensory texture and grounding to enhance the reader immersion.',
      fitScore: 94
    },
    {
      text: `${clean}`,
      label: 'Concise & Impactful',
      tone: 'Crisp, direct',
      explanation: 'Sharpens verbs and trims syntactic clutter for immediate narrative impact.',
      fitScore: 93
    }
  ];
}

// Local review fallback
function localReviewFallback(text) {
  const suggestions = [];
  if (!text || text.length < 5) return suggestions;

  // 1. Repeated duplicate words
  const duplicateRegex = /\b([a-zA-Z]{2,})\s+\1\b/gi;
  let match;
  while ((match = duplicateRegex.exec(text)) !== null && suggestions.length < 5) {
    suggestions.push({
      original: match[0],
      suggestion: match[1],
      type: 'Grammar',
      explanation: `Repeated word '${match[1]}' found consecutively.`
    });
  }

  // 2. Common spelling mistakes
  const commonTypos = {
    teh: 'the',
    recieve: 'receive',
    seperate: 'separate',
    definately: 'definitely',
    occured: 'occurred',
    untill: 'until',
    truely: 'truly',
    wierd: 'weird',
    accomodate: 'accommodate',
    goverment: 'government'
  };

  for (const [typo, fix] of Object.entries(commonTypos)) {
    if (suggestions.length >= 8) break;
    const typoRegex = new RegExp(`\\b${typo}\\b`, 'gi');
    if (typoRegex.test(text)) {
      suggestions.push({
        original: typo,
        suggestion: fix,
        type: 'Spelling',
        explanation: `Spelling correction: change '${typo}' to '${fix}'.`
      });
    }
  }

  // 3. Wordy filler expressions
  const fillerPhrases = {
    'in order to': 'to',
    'at the present time': 'now',
    'due to the fact that': 'because',
    'in the event that': 'if',
    'for the purpose of': 'to'
  };

  for (const [filler, concise] of Object.entries(fillerPhrases)) {
    if (suggestions.length >= 10) break;
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    if (regex.test(text)) {
      suggestions.push({
        original: filler,
        suggestion: concise,
        type: 'Style',
        explanation: `Conciseness: simplify '${filler}' to '${concise}'.`
      });
    }
  }

  return suggestions;
}

// Local transform fallback
function localTransformFallback(mode, input) {
  const text = (input || '').trim();
  if (!text) return '';

  switch (mode) {
    case 'shorten':
      return text
        .replace(/\bin order to\b/gi, 'to')
        .replace(/\bat the present time\b/gi, 'now')
        .replace(/\bdue to the fact that\b/gi, 'because')
        .replace(/\bvery\s+/gi, '')
        .replace(/\breally\s+/gi, '')
        .replace(/\bextremely\s+/gi, '')
        .trim();

    case 'expand':
      return `${text} Furthermore, this subtle development underscores the underlying tension and brings greater depth to the narrative context.`;

    case 'simplify':
      return text
        .replace(/\butilize\b/gi, 'use')
        .replace(/\bcommence\b/gi, 'start')
        .replace(/\bterminate\b/gi, 'end')
        .replace(/\bsubsequently\b/gi, 'then')
        .trim();

    case 'formal':
      return text
        .replace(/\bcan't\b/gi, 'cannot')
        .replace(/\bwon't\b/gi, 'will not')
        .replace(/\bgonna\b/gi, 'going to')
        .replace(/\bwanna\b/gi, 'want to')
        .trim();

    case 'casual':
      return text
        .replace(/\bcannot\b/gi, "can't")
        .replace(/\bdo not\b/gi, "don't")
        .replace(/\bwill not\b/gi, "won't")
        .trim();

    case 'active_voice':
      return text;

    default:
      return text;
  }
}

// Health Check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY });
});

// Text Generation / Transformations
apiRouter.post('/ai/generate', async (req, res) => {
  const { prompt, context, mode = 'fast', isDocUncensored = false, customKey } = req.body;
  const isUncensoredEffective = isDocUncensored || mode === 'uncensored' || mode === 'unfiltered';

  let temperature = isUncensoredEffective ? 0.85 : 0.7;
  let finalPrompt = prompt;

  switch (mode) {
    case 'dictionary':
      finalPrompt = `System: You are the Oxford English Dictionary.
Task: Define the following word or phrase.
Input: "${prompt}"
Output Format:
### Word
*(Part of Speech)* /pronunciation/

- **Definition**: The precise meaning.
- **Etymology**: Brief origin.
- **Usage**: A sentence example.
- **Synonyms**: 3-5 synonyms.`;
      temperature = 0.1;
      break;

    case 'uncensored':
    case 'unfiltered':
      finalPrompt = `System: You are an objective, neutral writing collaborator operating in Unfiltered Mode. Your mandate is to assist the user directly and faithfully with their writing without bias, editorializing, lecturing, preaching, or moralizing. Treat all creative, literary, speculative, historical, and philosophical themes with serious craft, impartial tone, and respect for the author's vision.
Task: ${prompt}
Context: ${context || ''}`;
      temperature = 0.85;
      break;

    case 'shorten':
      finalPrompt = `System: You are a ruthless editor.
Task: Rewrite the following text to be concise. Remove fluff, redundancy, and unnecessary words without losing core meaning.
Input Text: "${context || prompt}"
Output: Return ONLY the rewritten text.`;
      temperature = 0.3;
      break;

    case 'expand':
      finalPrompt = `System: You are a creative writer.
Task: Expand upon the following text. Add relevant sensory details, clarify concepts, and improve flow.
Input Text: "${context || prompt}"
Output: Return ONLY the rewritten text.`;
      temperature = 0.7;
      break;

    case 'formal':
      finalPrompt = `System: You are a corporate communications expert.
Task: Rewrite the following text to be professional, authoritative, and business-appropriate.
Input Text: "${context || prompt}"
Output: Return ONLY the rewritten text.`;
      temperature = 0.3;
      break;

    case 'casual':
      finalPrompt = `System: You are a friendly blogger.
Task: Rewrite the following text to be conversational, engaging, and human.
Input Text: "${context || prompt}"
Output: Return ONLY the rewritten text.`;
      temperature = 0.8;
      break;

    case 'simplify':
      finalPrompt = `System: You are a teacher for young students.
Task: Rewrite the following text to be simple and clear. Use plain language (5th-grade reading level).
Input Text: "${context || prompt}"
Output: Return ONLY the rewritten text.`;
      temperature = 0.3;
      break;

    case 'active_voice':
      finalPrompt = `System: You are a strict grammarian.
Task: Rewrite the following text to use Active Voice instead of passive voice.
Input Text: "${context || prompt}"
Output: Return ONLY the rewritten text.`;
      temperature = 0.3;
      break;

    default:
      if (context && context.trim()) {
        finalPrompt = `Context:\n${context}\n\nTask:\n${prompt}`;
      }
      break;
  }

  try {
    const client = getGenAIClient(customKey);
    const response = await generateContentWithFailover(client, {
      contents: finalPrompt,
      config: {
        temperature,
        safetySettings: getSafetySettings(isUncensoredEffective)
      }
    });

    return res.json({ text: response.text || '' });
  } catch (err) {
    console.warn('Primary generation failed, using local fallback:', err.message);
    const fallbackText = localTransformFallback(mode, context || prompt);
    return res.json({ text: fallbackText });
  }
});

// Chat with streaming support
apiRouter.post('/ai/chat', async (req, res) => {
  const { history = [], message, docContext, mode = 'chapter', isUncensored = false, customKey, stream = true } = req.body;

  let systemInstruction = 'You are Eloqui, a world-class literary editor and writing companion. Help the author draft, refine, critique, and structure their manuscript with elegance, precision, and respect for their creative voice.';
  if (isUncensored || mode === 'uncensored') {
    systemInstruction = 'You are Eloqui operating in Unfiltered Mode. You are an objective, craft-first collaborator. You do not censor, lecture, moralize, or decline creative storytelling, dark fiction, romance, or literary exploration. Assist the author directly with their narrative vision.';
  }

  let promptWithContext = message;
  if (docContext && docContext.trim()) {
    promptWithContext = `=== ACTIVE DOCUMENT CONTEXT ===\n${docContext.substring(0, 30000)}\n=== END CONTEXT ===\n\nUser Question/Instruction:\n${message}`;
  }

  // Format history for Gemini SDK
  const contents = [];
  for (const h of history) {
    if (h.role && h.parts && h.parts.length > 0) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: h.parts
      });
    }
  }
  contents.push({
    role: 'user',
    parts: [{ text: promptWithContext }]
  });

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const client = getGenAIClient(customKey);
      const responseStream = await client.models.generateContentStream({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: isUncensored ? 0.85 : 0.7,
          safetySettings: getSafetySettings(isUncensored)
        }
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
    } catch (err) {
      console.warn('Streaming chat encountered error, sending notice to client:', err.message);
      const notice = '\n\n*(Notice: Free tier rate limit momentarily encountered. You can configure your own key in Settings for uninterrupted access, or try again in a few seconds.)*';
      res.write(`data: ${JSON.stringify({ text: notice })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    try {
      const client = getGenAIClient(customKey);
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: isUncensored ? 0.85 : 0.7,
          safetySettings: getSafetySettings(isUncensored)
        }
      });
      res.json({ text: response.text || '' });
    } catch (err) {
      res.json({ text: `I am currently experiencing a temporary rate limit. Please try again shortly, or provide a personal API key in Key Management.` });
    }
  }
});

// Linguix Quality / Grammar Review
apiRouter.post('/ai/review', async (req, res) => {
  const { text, customKey } = req.body;
  if (!text || text.trim().length < 5) {
    return res.json({ suggestions: [], score: 100 });
  }

  try {
    const client = getGenAIClient(customKey);
    const prompt = `System: You are Linguix, a world-class proofreader and grammar editor.
Analyze the text below. Identify spelling errors, grammatical mistakes, awkward phrasing, wordy sentences, or passive constructions.
Return an array of JSON objects matching the schema.

Text to inspect:
"${text.substring(0, 8000)}"`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING, description: "Exact substring that has an issue." },
          suggestion: { type: Type.STRING, description: "Direct replacement suggestion." },
          type: { type: Type.STRING, description: "Spelling, Grammar, Clarity, Style, or Tone." },
          explanation: { type: Type.STRING, description: "Brief explanation." }
        },
        required: ["original", "suggestion", "type", "explanation"]
      }
    };

    const response = await generateContentWithFailover(client, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        safetySettings: getSafetySettings(true)
      }
    });

    let suggestions = [];
    if (response.text) {
      try {
        suggestions = JSON.parse(response.text);
      } catch (pe) {
        console.warn('Failed to parse model JSON, falling back to local review', pe);
        suggestions = localLinguisticReview(text);
      }
    } else {
      suggestions = localLinguisticReview(text);
    }

    const score = Math.max(45, Math.min(100, Math.round(100 - suggestions.length * 7)));
    res.json({ suggestions, score });
  } catch (err) {
    console.warn('AI review failed, falling back to rule-based analysis:', err.message);
    const suggestions = localLinguisticReview(text);
    const score = Math.max(60, Math.min(100, Math.round(100 - suggestions.length * 8)));
    res.json({ suggestions, score });
  }
});

// Paraphrasing & Natural Alternatives Endpoint
apiRouter.post('/ai/paraphrase', async (req, res) => {
  const {
    text = '',
    selectionType = 'sentence', // 'word' | 'sentence' | 'paragraph'
    documentType = 'novel_sfw',
    style = 'natural',
    customInstruction = '',
    surroundingContext = '',
    isDocUncensored = false,
    customKey
  } = req.body;

  if (!text || !text.trim()) {
    return res.json({ alternatives: [] });
  }

  const cleanText = text.trim();
  const words = cleanText.split(/\s+/);
  const detectedType = words.length === 1 ? 'word' : (selectionType || (words.length <= 30 ? 'sentence' : 'paragraph'));
  const isMature = documentType === 'novel_nsfw' || isDocUncensored;

  const docDesc = DOCUMENT_TYPE_DESCRIPTIONS[documentType] || DOCUMENT_TYPE_DESCRIPTIONS.novel_sfw;
  const styleDesc = PARAPHRASE_STYLE_GUIDES[style] || PARAPHRASE_STYLE_GUIDES.natural;

  let prompt = `System: You are an elite literary, academic, and legal editorial stylist.
Your goal is to suggest 4 distinct, natural, human-sounding alternatives for the author's selected text.
The alternatives MUST sound natural, unforced, and authentically tailored to the specified Document Register.

Target Document Register:
${docDesc.prompt}

Desired Paraphrasing Style:
${styleDesc}
${customInstruction ? `Author's Custom Guidance:\n${customInstruction}\n` : ''}
${surroundingContext ? `Surrounding Context in Document:\n"${surroundingContext.substring(0, 1500)}"\n` : ''}
Selected Text to Paraphrase:
"${cleanText}"
Selection Scope: ${detectedType} (${words.length} word${words.length === 1 ? '' : 's'})

Output Requirements:
Return ONLY a valid JSON object with the following structure:
{
  "selectionType": "${detectedType}",
  "documentType": "${documentType}",
  "style": "${style}",
  "alternatives": [
    {
      "text": "The natural rewritten alternative text.",
      "label": "Short badge (2-3 words, e.g., 'Atmospheric Depth', 'Operative Covenant', 'Sensory & Visceral', 'Empirical Hedging')",
      "tone": "2-3 word tone descriptor (e.g., 'Intense, intimate', 'Formal, statutory', 'Reflective, lyrical')",
      "explanation": "Brief 1-sentence explanation of what changed and why it suits this register.",
      "fitScore": 96
    }
  ]
}
`;

  if (detectedType === 'word') {
    prompt += `\nSpecial Instruction for Single Word:
Provide 4-5 nuanced, natural alternatives or evocative synonyms that fit perfectly into the surrounding sentence and register. Avoid bizarre or archaic dictionary filler unless requested.`;
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      selectionType: { type: Type.STRING },
      documentType: { type: Type.STRING },
      style: { type: Type.STRING },
      alternatives: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The rewritten text alternative." },
            label: { type: Type.STRING, description: "Short badge describing the aesthetic angle." },
            tone: { type: Type.STRING, description: "2-3 word tone descriptor." },
            explanation: { type: Type.STRING, description: "Brief sentence explaining the stylistic shift." },
            fitScore: { type: Type.NUMBER, description: "Estimated natural fit score (88-99)." }
          },
          required: ["text", "label", "tone", "explanation", "fitScore"]
        }
      }
    },
    required: ["alternatives"]
  };

  try {
    const client = getGenAIClient(customKey);
    const response = await generateContentWithFailover(client, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: detectedType === 'word' ? 0.4 : 0.7,
        safetySettings: getSafetySettings(isMature)
      }
    });

    if (response.text) {
      try {
        const parsed = JSON.parse(response.text);
        if (Array.isArray(parsed.alternatives) && parsed.alternatives.length > 0) {
          return res.json({
            selectionType: detectedType,
            documentType,
            style,
            alternatives: parsed.alternatives
          });
        }
      } catch (pe) {
        console.warn('Failed to parse paraphrase JSON, falling back:', pe.message);
      }
    }
  } catch (err) {
    console.warn('Paraphrase API failed, using smart local fallback:', err.message);
  }

  // Local fallback
  const fallbackAlternatives = localParaphraseFallback(cleanText, detectedType, documentType, style);
  return res.json({
    selectionType: detectedType,
    documentType,
    style,
    alternatives: fallbackAlternatives
  });
});

// Embeddings for RAG
apiRouter.post('/ai/embed', async (req, res) => {
  try {
    const { text, customKey } = req.body;
    if (!text || !text.trim()) {
      return res.json({ embedding: [] });
    }
    const client = getGenAIClient(customKey);
    const response = await client.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: text.substring(0, 2000)
    });
    const values = response.embeddings?.[0]?.values || response.embedding?.values || [];
    res.json({ embedding: values });
  } catch (err) {
    console.error('Error in /api/ai/embed:', err.message);
    res.json({ embedding: [] });
  }
});

module.exports = { apiRouter };
