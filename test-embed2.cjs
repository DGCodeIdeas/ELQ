const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: 'hello world'
    });
    console.log('Success gemini-embedding-001!', res.embeddings?.[0]?.values?.slice(0,3));
  } catch(e) {
    console.error('gemini-embedding-001 error:', e.message);
  }
}
run();
