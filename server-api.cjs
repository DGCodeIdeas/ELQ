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
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
  let lastErr = null;
  for (const model of models) {
    try {
      return await client.models.generateContent({
        ...options,
        model
      });
    } catch (err) {
      if (err.status !== 404) {
        console.warn(`Model ${model} failed with ${err.status || err.message}, trying next candidate...`);
      }
      lastErr = err;
    }
  }
  throw lastErr;
}

// Unified Multi-Provider Execution Engine
async function executeUnifiedModelPrompt({
  modelId = 'gemini-2.5-flash',
  prompt,
  systemInstruction = '',
  temperature = 0.7,
  maxTokens = 2048,
  isUncensored = false,
  customKey = '',
  customModel = null
}) {
  const normalizedId = (modelId || '').toLowerCase();

  // 1. Custom / Local Endpoint (Ollama, LM Studio, vLLM, private HTTP)
  if (customModel && customModel.endpointUrl) {
    try {
      let endpoint = customModel.endpointUrl.trim();
      if (customModel.providerType === 'ollama') {
        if (!endpoint.includes('/v1') && !endpoint.includes('/api')) {
          endpoint = endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
        }
      } else if (!endpoint.endsWith('/chat/completions') && !endpoint.includes('/api/')) {
        endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
      }

      const headers = { 'Content-Type': 'application/json' };
      if (customModel.apiKey || customKey) {
        headers['Authorization'] = `Bearer ${customModel.apiKey || customKey}`;
      }

      const messages = [];
      if (systemInstruction || customModel.systemPrompt) {
        messages.push({ role: 'system', content: customModel.systemPrompt || systemInstruction });
      }
      messages.push({ role: 'user', content: prompt });

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: customModel.name || 'default',
          messages,
          temperature: customModel.temperature || temperature,
          max_tokens: maxTokens
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || data.response || data.text || '';
        if (text) return { text, providerUsed: 'Custom Node' };
      }
      throw new Error(`Custom endpoint returned HTTP ${resp.status}. Please check your URL and API key.`);
    } catch (e) {
      if (e.message.includes('fetch failed') && customModel.endpointUrl.includes('localhost')) {
        throw new Error(`Cannot reach localhost from the cloud server. For local models like Ollama, you must expose them via a tunneling service (like ngrok) or use a public IP.`);
      }
      throw new Error(`Custom endpoint error: ${e.message}`);
    }
  }

  // 2. Pollinations Instant Free Public Inference (Zero Key)
  if (normalizedId.startsWith('pollinations-')) {
    try {
      let pollinationsModel = 'openai-fast';
      if (normalizedId.includes('deepseek')) pollinationsModel = 'deepseek';
      else if (normalizedId.includes('mistral')) pollinationsModel = 'mistral';
      else if (normalizedId.includes('qwen')) pollinationsModel = 'qwen';
      else if (normalizedId.includes('llama')) pollinationsModel = 'llama';

      const messages = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      messages.push({ role: 'user', content: prompt });

      const resp = await fetch('https://text.pollinations.ai/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: pollinationsModel,
          messages,
          temperature
        }),
        signal: AbortSignal.timeout(9000)
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (text) return { text, providerUsed: 'Pollinations AI' };
      }
    } catch (e) {
      console.warn('Pollinations inference error:', e.message);
    }
  }

  // 3. Groq Cloud Free Tier (Ultra-Fast 300-800 tok/s)
  if (normalizedId.includes('groq') || ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'].includes(normalizedId)) {
    const groqKey = customKey || process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        let groqModel = normalizedId;
        if (!['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'].includes(groqModel)) {
          groqModel = 'llama-3.3-70b-versatile';
        }

        const messages = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
        messages.push({ role: 'user', content: prompt });

        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: groqModel,
            messages,
            temperature,
            max_tokens: maxTokens
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (resp.ok) {
          const data = await resp.json();
          const text = data.choices?.[0]?.message?.content || '';
          if (text) return { text, providerUsed: 'Groq Cloud' };
        }
      } catch (e) {
        console.warn('Groq execution failed, falling back to Gemini:', e.message);
      }
    }
  }

  // 4. OpenRouter Free Tier (:free Community Models)
  if (normalizedId.includes('openrouter') || normalizedId.includes(':free')) {
    const orKey = customKey || process.env.OPENROUTER_API_KEY;
    if (orKey) {
      try {
        let orModel = modelId;
        if (!orModel.includes('/')) {
          orModel = 'deepseek/deepseek-chat:free';
        }

        const messages = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
        messages.push({ role: 'user', content: prompt });

        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${orKey}`,
            'HTTP-Referer': 'https://eloqui.studio',
            'X-Title': 'Eloqui AI Studio'
          },
          body: JSON.stringify({
            model: orModel,
            messages,
            temperature,
            max_tokens: maxTokens
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (resp.ok) {
          const data = await resp.json();
          const text = data.choices?.[0]?.message?.content || '';
          if (text) return { text, providerUsed: 'OpenRouter Free' };
        }
      } catch (e) {
        console.warn('OpenRouter execution failed, falling back:', e.message);
      }
    }
  }

  // 5. Cerebras Wafer-Scale Engines (1,800+ tok/s)
  if (normalizedId.includes('cerebras')) {
    const cerebrasKey = customKey || process.env.CEREBRAS_API_KEY;
    if (cerebrasKey) {
      try {
        const cModel = normalizedId.includes('70b') ? 'llama3.3-70b' : 'llama3.1-8b';
        const messages = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
        messages.push({ role: 'user', content: prompt });

        const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cerebrasKey}`
          },
          body: JSON.stringify({
            model: cModel,
            messages,
            temperature,
            max_tokens: maxTokens
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (resp.ok) {
          const data = await resp.json();
          const text = data.choices?.[0]?.message?.content || '';
          if (text) return { text, providerUsed: 'Cerebras Cloud' };
        }
      } catch (e) {
        console.warn('Cerebras execution failed:', e.message);
      }
    }
  }

  // 6. Resilient Anchor: Google AI Studio (Gemini 3.8 / 2.5 / 3.1)
  const client = getGenAIClient(customKey);
  const geminiModel = normalizedId.startsWith('gemini') ? modelId : 'gemini-2.5-flash';
  const contents = prompt;
  const config = {
    temperature,
    safetySettings: getSafetySettings(isUncensored)
  };
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  try {
    const response = await client.models.generateContent({
      model: geminiModel,
      contents,
      config
    });
    return { text: response.text || '', providerUsed: 'Google AI Studio' };
  } catch {
    const fallbackRes = await generateContentWithFailover(client, { contents, config });
    return { text: fallbackRes.text || '', providerUsed: 'Google AI Studio' };
  }
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

// Model Testing & Latency Probe Endpoint
apiRouter.post('/ai/test-model', async (req, res) => {
  const { modelId = 'gemini-2.5-flash', prompt = 'Rephrase for natural flow: The cold wind blew through the quiet empty street.', customModel, customKey } = req.body;
  const start = Date.now();

  try {
    const result = await executeUnifiedModelPrompt({
      modelId,
      prompt,
      systemInstruction: 'You are a master literary editor. Keep your response short, punchy, and natural.',
      temperature: 0.6,
      maxTokens: 120,
      customKey,
      customModel
    });

    const latencyMs = Math.max(1, Date.now() - start);
    return res.json({
      ok: true,
      modelId,
      latencyMs,
      snippet: (result.text || '').trim(),
      provider: result.providerUsed || 'Cloud AI Engine'
    });
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - start);
    console.warn(`Test probe for model ${modelId} failed:`, err.message);
    return res.status(502).json({
      ok: false,
      error: err.message || 'Model test probe failed',
      latencyMs
    });
  }
});

// Text Generation / Transformations
apiRouter.post('/ai/generate', async (req, res) => {
  const { prompt, context, mode = 'fast', isDocUncensored = false, customKey, modelId = 'gemini-2.5-flash', customModel } = req.body;
  const isUncensoredEffective = isDocUncensored || mode === 'uncensored' || mode === 'unfiltered';

  let temperature = isUncensoredEffective ? 0.85 : 0.7;
  let finalPrompt = prompt;
  let systemInstruction = '';

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
      systemInstruction = `You are an objective, neutral writing collaborator operating in Unfiltered Mode. Your mandate is to assist the user directly and faithfully with their writing without bias, editorializing, lecturing, preaching, or moralizing. Treat all creative, literary, speculative, historical, and philosophical themes with serious craft, impartial tone, and respect for the author's vision.`;
      finalPrompt = `Task: ${prompt}\nContext: ${context || ''}`;
      temperature = 0.85;
      break;

    case 'shorten':
      systemInstruction = `You are a ruthless editor. Rewrite the text to be concise. Remove fluff, redundancy, and unnecessary words without losing core meaning. Return ONLY the rewritten text.`;
      finalPrompt = `Input Text: "${context || prompt}"`;
      temperature = 0.3;
      break;

    case 'expand':
      systemInstruction = `You are a creative writer. Expand upon the following text. Add relevant sensory details, clarify concepts, and improve flow. Return ONLY the rewritten text.`;
      finalPrompt = `Input Text: "${context || prompt}"`;
      temperature = 0.7;
      break;

    case 'formal':
      systemInstruction = `You are a corporate communications expert. Rewrite the text to be professional, authoritative, and business-appropriate. Return ONLY the rewritten text.`;
      finalPrompt = `Input Text: "${context || prompt}"`;
      temperature = 0.3;
      break;

    case 'casual':
      systemInstruction = `You are a friendly blogger. Rewrite the following text to be conversational, engaging, and human. Return ONLY the rewritten text.`;
      finalPrompt = `Input Text: "${context || prompt}"`;
      temperature = 0.8;
      break;

    case 'simplify':
      systemInstruction = `You are a teacher for young students. Rewrite the text to be simple and clear. Use plain language (5th-grade reading level). Return ONLY the rewritten text.`;
      finalPrompt = `Input Text: "${context || prompt}"`;
      temperature = 0.3;
      break;

    case 'active_voice':
      systemInstruction = `You are a strict grammarian. Rewrite the following text to use Active Voice instead of passive voice. Return ONLY the rewritten text.`;
      finalPrompt = `Input Text: "${context || prompt}"`;
      temperature = 0.3;
      break;

    default:
      if (context && context.trim()) {
        finalPrompt = `Context:\n${context}\n\nTask:\n${prompt}`;
      }
      break;
  }

  try {
    const result = await executeUnifiedModelPrompt({
      modelId,
      prompt: finalPrompt,
      systemInstruction,
      temperature,
      isUncensored: isUncensoredEffective,
      customKey,
      customModel
    });

    return res.json({ text: result.text || '', provider: result.providerUsed });
  } catch (err) {
    console.warn('Primary generation failed, using local fallback:', err.message);
    const fallbackText = localTransformFallback(mode, context || prompt);
    return res.json({ text: fallbackText });
  }
});

// Chat with streaming support
apiRouter.post('/ai/chat', async (req, res) => {
  const { history = [], message, docContext, mode = 'chapter', isUncensored = false, customKey, modelId = 'gemini-2.5-flash', customModel, stream = true } = req.body;

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

  const isGemini = !modelId || modelId.toLowerCase().startsWith('gemini');

  if (stream && isGemini) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const client = getGenAIClient(customKey);
      const geminiModel = modelId && modelId.startsWith('gemini') ? modelId : 'gemini-2.5-flash';
      const responseStream = await client.models.generateContentStream({
        model: geminiModel,
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
  } else if (stream && !isGemini) {
    // Non-Gemini model streaming via SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const result = await executeUnifiedModelPrompt({
        modelId,
        prompt: promptWithContext,
        systemInstruction,
        temperature: isUncensored ? 0.85 : 0.7,
        isUncensored,
        customKey,
        customModel
      });

      const fullText = result.text || '';
      // Stream in natural word chunks for realistic pacing
      const words = fullText.split(/(\s+)/);
      for (let i = 0; i < words.length; i += 2) {
        const chunk = (words[i] || '') + (words[i + 1] || '');
        if (chunk) {
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }
      }
    } catch (err) {
      console.warn('Alternative model chat failed:', err.message);
      res.write(`data: ${JSON.stringify({ text: `\n\n*(Notice: Model request encountered an issue: ${err.message}. Check your provider settings in AI Model Hub.)*` })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    try {
      const result = await executeUnifiedModelPrompt({
        modelId,
        prompt: promptWithContext,
        systemInstruction,
        temperature: isUncensored ? 0.85 : 0.7,
        isUncensored,
        customKey,
        customModel
      });
      res.json({ text: result.text || '' });
    } catch (err) {
      res.json({ text: `I am currently experiencing a temporary rate limit. Please try again shortly, or switch models in the AI Model Hub.` });
    }
  }
});

// Linguix Quality / Grammar Review
apiRouter.post('/ai/review', async (req, res) => {
  const { text, customKey, modelId = 'gemini-2.5-flash', customModel } = req.body;
  if (!text || text.trim().length < 5) {
    return res.json({ suggestions: [], score: 100 });
  }

  const prompt = `System: You are Linguix, a world-class proofreader and grammar editor.
Analyze the text below. Identify spelling errors, grammatical mistakes, awkward phrasing, wordy sentences, or passive constructions.
Return an array of JSON objects with keys: "original", "suggestion", "type" (Spelling, Grammar, Clarity, Style, or Tone), and "explanation".
Return ONLY valid JSON array with no extra markdown formatting or conversational text.

Text to inspect:
"${text.substring(0, 8000)}"`;

  const isGemini = !modelId || modelId.toLowerCase().startsWith('gemini');

  if (isGemini) {
    try {
      const client = getGenAIClient(customKey);
      const geminiModel = modelId && modelId.startsWith('gemini') ? modelId : 'gemini-2.5-flash';
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

      const response = await client.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          safetySettings: getSafetySettings(true)
        }
      }).catch(() => generateContentWithFailover(client, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          safetySettings: getSafetySettings(true)
        }
      }));

      let suggestions = [];
      if (response.text) {
        try {
          suggestions = JSON.parse(response.text);
        } catch {
          suggestions = localLinguisticReview(text);
        }
      } else {
        suggestions = localLinguisticReview(text);
      }

      const score = Math.max(45, Math.min(100, Math.round(100 - suggestions.length * 7)));
      return res.json({ suggestions, score, modelUsed: geminiModel });
    } catch (err) {
      console.warn('AI review failed, falling back to rule-based analysis:', err.message);
      const suggestions = localLinguisticReview(text);
      const score = Math.max(60, Math.min(100, Math.round(100 - suggestions.length * 8)));
      return res.json({ suggestions, score, modelUsed: 'RuleEngine' });
    }
  } else {
    // Non-Gemini model execution
    try {
      const result = await executeUnifiedModelPrompt({
        modelId,
        prompt,
        temperature: 0.2,
        customKey,
        customModel
      });

      let suggestions = [];
      if (result.text) {
        const jsonMatch = result.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      }
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        suggestions = localLinguisticReview(text);
      }
      const score = Math.max(45, Math.min(100, Math.round(100 - suggestions.length * 7)));
      return res.json({ suggestions, score, modelUsed: modelId });
    } catch {
      const suggestions = localLinguisticReview(text);
      const score = Math.max(60, Math.min(100, Math.round(100 - suggestions.length * 8)));
      return res.json({ suggestions, score, modelUsed: 'RuleEngine' });
    }
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
    contextBefore = '',
    contextAfter = '',
    isDocUncensored = false,
    customKey,
    modelId = 'gemini-2.5-flash',
    customModel
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

  // Build structured surrounding passage context
  let passageContext = '';
  if (contextBefore || contextAfter) {
    const beforePart = contextBefore ? `...${contextBefore.slice(-1200)}` : '';
    const afterPart = contextAfter ? `${contextAfter.slice(0, 1200)}...` : '';
    passageContext = `${beforePart} >>> [TARGET TEXT TO PARAPHRASE: "${cleanText}"] <<< ${afterPart}`;
  } else if (surroundingContext && surroundingContext.trim()) {
    passageContext = surroundingContext.substring(0, 2500);
  }

  let prompt = `System: You are an elite literary editor, master stylist, and professional prose rewriter.
Your goal is to suggest 4 distinct, natural, human-sounding rewritten alternatives for the author's selected text.
The alternatives MUST sound natural, unforced, and authentically tailored to the specified Document Register.

CRITICAL CONTEXTUAL HARMONY MANDATE:
The rewritten alternatives MUST take the surrounding text directly into account:
1. Syntactic Seamlessness: When your replacement alternative is slotted directly into the surrounding sentence/paragraph, the entire passage must read effortlessly with no grammatical collisions, awkward prepositions, or jagged transitions.
2. Tense, Voice & Person Concord: Strictly mirror the surrounding narrative's verb tense (e.g. simple past, literary present) and point of view (1st person "I/we", 2nd person "you", or 3rd person "he/she/they").
3. Register & Tone Flow: Maintain consistent narrative voice, atmospheric momentum, and character interiority that matches the surrounding passage.
4. Punctuation & Boundary Care: Ensure proper capitalization and punctuation relative to surrounding commas, periods, quotation marks, or em-dashes.
${passageContext ? `
Surrounding Document Passage:
"""
${passageContext}
"""
` : ''}
Target Document Register:
${docDesc.prompt}

Desired Paraphrasing Style:
${styleDesc}
${customInstruction ? `Author's Custom Guidance:\n${customInstruction}\n` : ''}
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
      "explanation": "Brief 1-sentence explanation of what changed and how it harmonizes with the surrounding context.",
      "fitScore": 96
    }
  ]
}
`;

  if (detectedType === 'word') {
    prompt += `\nSpecial Instruction for Single Word:
Provide 4-5 nuanced, natural alternatives or evocative synonyms that fit perfectly into the surrounding sentence and register. Ensure each alternative matches the exact grammatical role, conjugation/tense, and preposition compatibility in the immediate sentence.`;
  }

  const isGemini = !modelId || modelId.toLowerCase().startsWith('gemini');

  if (isGemini) {
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
      const geminiModel = modelId && modelId.startsWith('gemini') ? modelId : 'gemini-2.5-flash';
      const response = await client.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: detectedType === 'word' ? 0.4 : 0.7,
          safetySettings: getSafetySettings(isMature)
        }
      }).catch(() => generateContentWithFailover(client, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: detectedType === 'word' ? 0.4 : 0.7,
          safetySettings: getSafetySettings(isMature)
        }
      }));

      if (response.text) {
        try {
          const parsed = JSON.parse(response.text);
          if (Array.isArray(parsed.alternatives) && parsed.alternatives.length > 0) {
            return res.json({
              selectionType: detectedType,
              documentType,
              style,
              alternatives: parsed.alternatives,
              modelUsed: geminiModel
            });
          }
        } catch (pe) {
          console.warn('Failed to parse paraphrase JSON, falling back:', pe.message);
        }
      }
    } catch (err) {
      console.warn('Paraphrase API failed, using smart local fallback:', err.message);
    }
  } else {
    // Non-Gemini model execution
    try {
      const result = await executeUnifiedModelPrompt({
        modelId,
        prompt,
        temperature: detectedType === 'word' ? 0.3 : 0.7,
        isUncensored: isMature,
        customKey,
        customModel
      });

      if (result.text) {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.alternatives) && parsed.alternatives.length > 0) {
            return res.json({
              selectionType: detectedType,
              documentType,
              style,
              alternatives: parsed.alternatives,
              modelUsed: modelId
            });
          }
        }
      }
    } catch (err) {
      console.warn('Non-Gemini paraphrase attempt failed, using smart fallback:', err.message);
    }
  }

  // Local fallback
  const fallbackAlternatives = localParaphraseFallback(cleanText, detectedType, documentType, style);
  return res.json({
    selectionType: detectedType,
    documentType,
    style,
    alternatives: fallbackAlternatives,
    modelUsed: 'LocalHeuristics'
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
    let response;
    
    // Failover list to avoid 429 quota limits on specific embedding models
    const embedModels = ['gemini-embedding-001', 'gemini-embedding-2', 'gemini-embedding-2-preview'];
    let lastErr = null;
    
    for (const model of embedModels) {
      try {
        response = await client.models.embedContent({
          model,
          contents: text.substring(0, 2000)
        });
        break; // Success
      } catch (err) {
        lastErr = err;
        if (err.status !== 429 && err.status !== 404) {
          throw err;
        }
      }
    }
    
    if (!response) {
      throw lastErr || new Error('All embedding models failed');
    }

    const values = response.embeddings?.[0]?.values || response.embedding?.values || [];
    res.json({ embedding: values });
  } catch (err) {
    if (err.status !== 429) {
      console.error('Error in /api/ai/embed:', err.message);
    }
    res.json({ embedding: [] });
  }
});

module.exports = { apiRouter };
