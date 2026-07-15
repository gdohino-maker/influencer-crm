import type { Brand, Influencer } from "@prisma/client";
import { generateJson } from "@/lib/gemini";
import { Type } from "@google/genai";

// 上位候補まとめて1回のAPI呼び出しで「選定理由」を生成する(候補ごとに呼ぶとレイテンシ・コストが増えるため)
export async function generateRecommendReasons(
  candidates: Influencer[],
  brand: Pick<Brand, "name" | "category" | "targetAgeBands" | "targetGender" | "targetGenres" | "description">
): Promise<Map<number, string>> {
  if (candidates.length === 0) return new Map();

  const prompt = `あなたはインフルエンサーマーケティングの担当者です。
以下のブランドのターゲット条件と、候補者一覧を見て、それぞれの候補者について「なぜこの人が合うと考えられるか」を1文(40字以内、日本語)で説明してください。
根拠が薄い場合でも、分かっている情報から言える範囲で前向きに説明してください。

【ブランド】
商品名: ${brand.name}
カテゴリ: ${brand.category}
ターゲット年齢層: ${brand.targetAgeBands}
ターゲット性別: ${brand.targetGender}
ターゲットジャンル: ${brand.targetGenres}
商品説明: ${brand.description ?? "(なし)"}

【候補者一覧】
${candidates
  .map(
    (c) =>
      `- id:${c.id} @${c.username}(${c.platform}) ジャンル:${c.genreTags ?? "不明"} フォロワー推定層:${c.audienceAgeGuess ?? "不明"}/${c.audienceGenderGuess ?? "不明"} フォロワー数:${c.followers ?? "不明"}`
  )
  .join("\n")}`;

  const result = await generateJson<{ reasons: { influencerId: number; reason: string }[] }>(prompt, {
    type: Type.OBJECT,
    properties: {
      reasons: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            influencerId: { type: Type.INTEGER },
            reason: { type: Type.STRING },
          },
          required: ["influencerId", "reason"],
        },
      },
    },
    required: ["reasons"],
  });

  return new Map(result.reasons.map((r) => [r.influencerId, r.reason]));
}
