"use server";

import { prisma } from "@/lib/db";
import { generateJson } from "@/lib/gemini";
import { Type } from "@google/genai";
import { redirect } from "next/navigation";

const CATEGORY_TO_COMPLIANCE_KEYWORD: Record<string, string> = {
  food: "食品",
  cosmetics: "化粧品",
  supplement: "サプリ",
};

type ParsedBrand = {
  category: "food" | "cosmetics" | "supplement" | "appliance" | "apparel" | "other";
  description: string;
  targetAgeBands: string[];
  targetGender: "male" | "female" | "all";
  targetGenres: string[];
  searchKeyword: string;
};

export async function createFromPrompt(formData: FormData) {
  const clientName = String(formData.get("clientName") ?? "").trim();
  const brandName = String(formData.get("brandName") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();

  if (!clientName || !brandName || !prompt) {
    throw new Error("企業名・ブランド名・説明文はすべて必須です");
  }

  const parsed = await generateJson<ParsedBrand>(
    `あなたはインフルエンサーマーケティングの担当者です。
以下の商品説明文から、ブランド情報を構造化して抽出してください。情報が不足している項目は妥当な値を推測してください。
特に薬機法対象カテゴリ(食品・化粧品・サプリ)の場合、断定的な効果効能を書いていなくても、カテゴリだけは正しく分類してください。

ブランド名: ${brandName}
商品説明文: ${prompt}

出力項目:
- category: "food"|"cosmetics"|"supplement"|"appliance"|"apparel"|"other" のいずれか
- description: 商品説明を1〜2文に整理したもの
- targetAgeBands: ターゲット年齢層の配列(例 ["40s","50s"])。不明なら ["all"]
- targetGender: "male"|"female"|"all"
- targetGenres: ターゲットのライフスタイル/興味ジャンルの配列(例 ["暮らし","健康"])。3〜5個
- searchKeyword: Amazon等で検索してほしいキーワード(通常ブランド名や商品名)`,
    {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING },
        description: { type: Type.STRING },
        targetAgeBands: { type: Type.ARRAY, items: { type: Type.STRING } },
        targetGender: { type: Type.STRING },
        targetGenres: { type: Type.ARRAY, items: { type: Type.STRING } },
        searchKeyword: { type: Type.STRING },
      },
      required: ["category", "description", "targetAgeBands", "targetGender", "targetGenres", "searchKeyword"],
    }
  );

  const complianceKeyword = CATEGORY_TO_COMPLIANCE_KEYWORD[parsed.category];
  const complianceProfile = complianceKeyword
    ? await prisma.complianceProfile.findFirst({ where: { name: { contains: complianceKeyword } } })
    : null;
  const fallbackCompliance = await prisma.complianceProfile.findFirstOrThrow({ orderBy: { id: "asc" } });

  const scoringProfile = await prisma.scoringProfile.findFirstOrThrow({ orderBy: { id: "asc" } });

  let client = await prisma.client.findFirst({ where: { name: clientName } });
  if (!client) {
    client = await prisma.client.create({ data: { name: clientName } });
  }

  const brand = await prisma.brand.create({
    data: {
      clientId: client.id,
      name: brandName,
      category: parsed.category,
      description: parsed.description,
      targetAgeBands: parsed.targetAgeBands.join(","),
      targetGender: parsed.targetGender,
      targetGenres: parsed.targetGenres.join(","),
      searchKeyword: parsed.searchKeyword || brandName,
      complianceProfileId: (complianceProfile ?? fallbackCompliance).id,
      scoringProfileId: scoringProfile.id,
    },
  });

  // 検索した候補をすぐ「決定」できるよう、既定のキャンペーンを自動作成しておく(履歴にも残る)
  const campaign = await prisma.campaign.create({
    data: {
      brandId: brand.id,
      name: `${brandName}の候補選定`,
      goal: "ugc_volume",
      status: "running",
    },
  });

  redirect(`/brands/${brand.id}/discover?new=1&campaignId=${campaign.id}`);
}
