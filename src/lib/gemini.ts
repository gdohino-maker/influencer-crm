import { GoogleGenAI, Type } from "@google/genai";

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

export interface InfluencerSearchFilter {
  genreKeywords: string[];
  audienceAgeBands: string[];
  audienceGender: "male" | "female" | "mixed" | null;
  minPhotoQuality: number | null;
  maxPrFrequency: number | null;
  minFollowers: number | null;
  maxFollowers: number | null;
  platform: "instagram" | "youtube" | "x" | "tiktok" | null;
}

// 自然文検索クエリをInfluencerマスタの絞り込み条件に変換する(Phase 1では通常フォーム検索、Phase 2でこれを追加)
export async function parseInfluencerSearchQuery(query: string): Promise<InfluencerSearchFilter> {
  const prompt = `以下はインフルエンサーマスタを検索するための自由文の検索クエリです。
検索条件をJSONの絞り込みパラメータに変換してください。読み取れない項目はnullまたは空配列にしてください。

クエリ: "${query}"

出力項目:
- genreKeywords: ジャンルタグに含まれるべきキーワードの配列(例: ["暮らし","健康"])
- audienceAgeBands: フォロワー層の年代の配列("20s"|"30s"|"40s"|"50s"|"60s+")
- audienceGender: フォロワー層の性別("male"|"female"|"mixed"のいずれか、指定なければnull)
- minPhotoQuality: 写真/世界観の質の下限(1-5の整数、「写真がきれい」等の言及があれば4以上を目安に)
- maxPrFrequency: 直近PR比率の上限(0-1、「PR慣れしていない」等の言及があれば0.3程度を目安に)
- minFollowers: フォロワー数の下限
- maxFollowers: フォロワー数の上限
- platform: プラットフォーム指定があれば("instagram"|"youtube"|"x"|"tiktok")、なければnull`;

  return generateJson<InfluencerSearchFilter>(prompt, {
    type: Type.OBJECT,
    properties: {
      genreKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      audienceAgeBands: { type: Type.ARRAY, items: { type: Type.STRING } },
      audienceGender: { type: Type.STRING, nullable: true },
      minPhotoQuality: { type: Type.NUMBER, nullable: true },
      maxPrFrequency: { type: Type.NUMBER, nullable: true },
      minFollowers: { type: Type.NUMBER, nullable: true },
      maxFollowers: { type: Type.NUMBER, nullable: true },
      platform: { type: Type.STRING, nullable: true },
    },
    required: [
      "genreKeywords",
      "audienceAgeBands",
      "audienceGender",
      "minPhotoQuality",
      "maxPrFrequency",
      "minFollowers",
      "maxFollowers",
      "platform",
    ],
  });
}
