import type { Brand } from "@prisma/client";
import { generateJson } from "@/lib/gemini";
import { Type } from "@google/genai";

export type ReasonCandidate = {
  key: string;
  username: string;
  platform: string;
  genreTags?: string | null;
  audienceAgeGuess?: string | null;
  audienceGenderGuess?: string | null;
  followers?: number | null;
  engagementRate?: number | null;
  bio?: string | null;
  notes?: string | null;
};

// マスタ登録済み・YouTube検索の生候補(まだマスタ未登録)の両方に対応する単一の選定理由生成関数。
// まとめて1回のAPI呼び出しで生成する(候補ごとに呼ぶとレイテンシ・コストが増えるため)。
export async function generateUnifiedReasons(
  candidates: ReasonCandidate[],
  brand: Pick<Brand, "name" | "category" | "targetAgeBands" | "targetGender" | "targetGenres" | "description">
): Promise<Map<string, string>> {
  if (candidates.length === 0) return new Map();

  const prompt = `あなたはインフルエンサーマーケティングの担当者です。
以下のブランドのターゲット条件と、候補者一覧(実データ)を見て、それぞれの候補者について「なぜこの人が合うと考えられるか」を1文(50字以内、日本語)で説明してください。

厳守事項:
- 与えられたデータ(ジャンル・フォロワー層・フォロワー数・エンゲージメント率・bio・メモ)に書かれている具体的な内容だけを根拠にすること。データに無い性格・実績・雰囲気を憶測で作り出さない
- 「世界観が良い」「相性が良さそう」等の抽象的な言い回しだけで終わらせず、根拠になったデータ項目(例: ジャンルタグ、bio/メモの内容、フォロワー層)を具体的に触れること
- 参考にできるデータがほとんど無い候補者には、正直に「情報が少なく判断材料が限定的」である旨を書き、無理に理由を作らない
- 同じ言い回しの使い回しを避け、候補ごとにデータの違いが伝わるようにする

【ブランド】
商品名: ${brand.name}
カテゴリ: ${brand.category}
ターゲット年齢層: ${brand.targetAgeBands}
ターゲット性別: ${brand.targetGender}
ターゲットジャンル: ${brand.targetGenres}
商品説明: ${brand.description ?? "(なし)"}

【候補者一覧(実データ)】
${candidates
  .map(
    (c) =>
      `- key:${c.key} @${c.username}(${c.platform}) ジャンル:${c.genreTags ?? "不明"} フォロワー推定層:${c.audienceAgeGuess ?? "不明"}/${c.audienceGenderGuess ?? "不明"} フォロワー数:${c.followers ?? "不明"} ER:${c.engagementRate ?? "不明"}% bio:${c.bio ?? "不明"} メモ:${c.notes ?? "不明"}`
  )
  .join("\n")}`;

  const result = await generateJson<{ reasons: { key: string; reason: string }[] }>(prompt, {
    type: Type.OBJECT,
    properties: {
      reasons: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            key: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          required: ["key", "reason"],
        },
      },
    },
    required: ["reasons"],
  });

  return new Map(result.reasons.map((r) => [r.key, r.reason]));
}
