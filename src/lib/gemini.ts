import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEYが設定されていません。.env.localに設定してください。");
  }
  return new GoogleGenAI({ apiKey });
}

export async function generateText(prompt: string): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });
  const text = response.text;
  if (!text) throw new Error("Geminiからの応答が空でした");
  return text.trim();
}

// responseSchemaはGemini APIのJSON Schemaサブセット(OBJECT/STRING/NUMBER/ARRAY等)を渡す
export async function generateJson<T>(prompt: string, responseSchema: object): Promise<T> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Geminiからの応答が空でした");
  return JSON.parse(text) as T;
}
