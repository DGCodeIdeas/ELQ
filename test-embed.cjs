const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: 'hello world'
    });
    console.log('Success text-embedding-004!', res.embeddings?.[0]?.values?.slice(0,3));
  } catch(e) {
    console.error('text-embedding-004 error:', e.message);
  }

  try {
    const res2 = await ai.models.embedContent({
      model: 'gemini-embedding-exp-03-07',
      contents: 'hello world'
    });
    console.log('Success gemini-embedding-exp-03-07!', res2.embeddings?.[0]?.values?.slice(0,3));
  } catch(e) {
    console.error('gemini-embedding-exp-03-07 error:', e.message);
  }
}
run();
