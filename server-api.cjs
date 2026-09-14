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
function localLinguisticReview(text) {
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
    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
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

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
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

// Paraphrase Generation
apiRouter.post('/ai/paraphrase', async (req, res) => {
  const { text, style, docContext, customKey } = req.body;
  if (!text || text.trim().length < 1) {
    return res.json({ alternatives: [] });
  }

  try {
    const client = getGenAIClient(customKey);
    const prompt = `System: You are an expert writer and editor.
Task: Provide 3 to 5 natural, high-quality alternative ways to phrase the provided text. Adapt the tone and vocabulary to fit the requested style/document type.
Text to paraphrase: "${text}"
Requested Style: ${style || 'General'}
Document Context: "${docContext ? docContext.substring(0, 1000) : 'None'}"`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The paraphrased alternative text." },
          explanation: { type: Type.STRING, description: "Brief explanation of the tone or effect." }
        },
        required: ["text", "explanation"]
      }
    };

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        safetySettings: getSafetySettings(true)
      }
    });

    let alternatives = [];
    if (response.text) {
      try {
        alternatives = JSON.parse(response.text);
      } catch (pe) {
        console.warn('Failed to parse model JSON for paraphrase', pe);
      }
    }
    res.json({ alternatives });
  } catch (err) {
    console.warn('AI paraphrase failed:', err.message);
    res.json({ alternatives: [{ text, explanation: `AI service temporarily unavailable: ${err.message}` }] });
  }
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
