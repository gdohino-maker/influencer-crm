"use server";

import { prisma } from "@/lib/db";
import { generateJson } from "@/lib/gemini";
import { Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function parseCsvField(v: FormDataEntryValue | null): string {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");
}

export async function createBrand(clientId: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const asin = String(formData.get("asin") ?? "").trim();
  const productUrl = String(formData.get("productUrl") ?? "").trim();
  const priceYenRaw = String(formData.get("priceYen") ?? "").trim();
  const targetAgeBands = parseCsvField(formData.get("targetAgeBands"));
  const targetGender = String(formData.get("targetGender") ?? "all");
  const targetGenres = parseCsvField(formData.get("targetGenres"));
  const searchKeyword = String(formData.get("searchKeyword") ?? "").trim();
  const complianceProfileId = Number(formData.get("complianceProfileId"));
  const scoringProfileId = Number(formData.get("scoringProfileId"));

  if (!name || !category || !targetAgeBands || !targetGenres || !searchKeyword) {
    throw new Error("必須項目が不足しています");
  }

  const brand = await prisma.brand.create({
    data: {
      clientId,
      name,
      category,
      description: description || null,
      asin: asin || null,
      productUrl: productUrl || null,
      priceYen: priceYenRaw ? Number(priceYenRaw) : null,
      targetAgeBands,
      targetGender,
      targetGenres,
      searchKeyword,
      complianceProfileId,
      scoringProfileId,
    },
  });
  revalidatePath(`/clients/${clientId}`);
  redirect(`/brands/${brand.id}`);
}

export async function updateBrand(id: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const asin = String(formData.get("asin") ?? "").trim();
  const productUrl = String(formData.get("productUrl") ?? "").trim();
  const priceYenRaw = String(formData.get("priceYen") ?? "").trim();
  const targetAgeBands = parseCsvField(formData.get("targetAgeBands"));
  const targetGender = String(formData.get("targetGender") ?? "all");
  const targetGenres = parseCsvField(formData.get("targetGenres"));
  const searchKeyword = String(formData.get("searchKeyword") ?? "").trim();
  const complianceProfileId = Number(formData.get("complianceProfileId"));
  const scoringProfileId = Number(formData.get("scoringProfileId"));

  await prisma.brand.update({
    where: { id },
    data: {
      name,
      category,
      description: description || null,
      asin: asin || null,
      productUrl: productUrl || null,
      priceYen: priceYenRaw ? Number(priceYenRaw) : null,
      targetAgeBands,
      targetGender,
      targetGenres,
      searchKeyword,
      complianceProfileId,
      scoringProfileId,
    },
  });
  revalidatePath(`/brands/${id}`);
}

export async function updateDiscoveryKeywords(id: number, formData: FormData) {
  const discoveryKeywords = parseCsvField(formData.get("discoveryKeywords"));
  await prisma.brand.update({ where: { id }, data: { discoveryKeywords: discoveryKeywords || null } });
  revalidatePath(`/brands/${id}`);
}

export async function generateDiscoveryKeywords(id: number) {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id } });

  const prompt = `あなたはインフルエンサーマーケティングの専門家です。
以下の商品情報から、YouTube Data API v3 で「type=channel」検索する際に使う日本語の検索キーワード群を7〜10個生成してください。
商品名そのものやブランド名だけでなく、ターゲット層のライフスタイル・悩み・関心事から連想されるキーワードも含めてください。
特に該当カテゴリが薬機法規制対象の場合、効果効能を断定する表現(治る、痩せる等)はキーワードとして生成しないでください。

商品名: ${brand.name}
カテゴリ: ${brand.category}
商品説明: ${brand.description ?? "(なし)"}
ターゲット年齢層: ${brand.targetAgeBands}
ターゲット性別: ${brand.targetGender}
ターゲットジャンル: ${brand.targetGenres}`;

  const result = await generateJson<{ keywords: string[] }>(prompt, {
    type: Type.OBJECT,
    properties: {
      keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["keywords"],
  });

  const discoveryKeywords = result.keywords.map((k) => k.trim()).filter(Boolean).join(",");
  await prisma.brand.update({ where: { id }, data: { discoveryKeywords } });
  revalidatePath(`/brands/${id}`);
}
