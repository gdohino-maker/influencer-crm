"use server";

import { prisma } from "@/lib/db";
import { generateJson } from "@/lib/gemini";
import { Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export async function createInfluencer(formData: FormData) {
  const platform = String(formData.get("platform") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const followersRaw = String(formData.get("followers") ?? "").trim();
  const engagementRateRaw = String(formData.get("engagementRate") ?? "").trim();
  const genreTags = String(formData.get("genreTags") ?? "").trim();
  const audienceAgeGuess = String(formData.get("audienceAgeGuess") ?? "").trim();
  const audienceGenderGuess = String(formData.get("audienceGenderGuess") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!platform || !username || !url) throw new Error("プラットフォーム/username/URLは必須です");

  await prisma.influencer.create({
    data: {
      platform,
      username,
      url,
      displayName: displayName || null,
      bio: bio || null,
      followers: followersRaw ? Number(followersRaw) : null,
      engagementRate: engagementRateRaw ? Number(engagementRateRaw) : null,
      genreTags: genreTags || null,
      audienceAgeGuess: audienceAgeGuess || null,
      audienceGenderGuess: audienceGenderGuess || null,
      notes: notes || null,
    },
  });
  revalidatePath("/influencers");
  redirect("/influencers");
}

export async function createInfluencersBulk(formData: FormData) {
  const platform = String(formData.get("platform") ?? "").trim();
  const raw = stripBom(String(formData.get("bulk") ?? ""));
  if (!platform || !raw.trim()) throw new Error("プラットフォームと一覧データは必須です");

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let created = 0;
  let skipped = 0;

  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim());
    const [username, url, displayName, followersStr, engagementRateStr, genreTags] = cols;
    if (!username) continue;

    const existing = await prisma.influencer.findUnique({
      where: { platform_username: { platform, username } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.influencer.create({
      data: {
        platform,
        username,
        url: url || `https://${platform}.com/${username}`,
        displayName: displayName || null,
        followers: followersStr ? Number(followersStr) : null,
        engagementRate: engagementRateStr ? Number(engagementRateStr) : null,
        genreTags: genreTags || null,
      },
    });
    created++;
  }

  revalidatePath("/influencers");
  redirect(`/influencers?bulkCreated=${created}&bulkSkipped=${skipped}`);
}

export async function updateInfluencer(id: number, formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const followersRaw = String(formData.get("followers") ?? "").trim();
  const postsCountRaw = String(formData.get("postsCount") ?? "").trim();
  const avgLikeRaw = String(formData.get("avgLike") ?? "").trim();
  const avgCommentRaw = String(formData.get("avgComment") ?? "").trim();
  const engagementRateRaw = String(formData.get("engagementRate") ?? "").trim();
  const ageBand = String(formData.get("ageBand") ?? "").trim();
  const audienceAgeGuess = String(formData.get("audienceAgeGuess") ?? "").trim();
  const audienceGenderGuess = String(formData.get("audienceGenderGuess") ?? "").trim();
  const genreTags = String(formData.get("genreTags") ?? "").trim();
  const photoQualityRaw = String(formData.get("photoQuality") ?? "").trim();
  const prFrequencyRaw = String(formData.get("prFrequency") ?? "").trim();
  const isBlacklisted = formData.get("isBlacklisted") === "on";
  const blacklistReason = String(formData.get("blacklistReason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.influencer.update({
    where: { id },
    data: {
      displayName: displayName || null,
      bio: bio || null,
      url,
      followers: followersRaw ? Number(followersRaw) : null,
      postsCount: postsCountRaw ? Number(postsCountRaw) : null,
      avgLike: avgLikeRaw ? Number(avgLikeRaw) : null,
      avgComment: avgCommentRaw ? Number(avgCommentRaw) : null,
      engagementRate: engagementRateRaw ? Number(engagementRateRaw) : null,
      ageBand: ageBand || null,
      audienceAgeGuess: audienceAgeGuess || null,
      audienceGenderGuess: audienceGenderGuess || null,
      genreTags: genreTags || null,
      photoQuality: photoQualityRaw ? Number(photoQualityRaw) : null,
      prFrequency: prFrequencyRaw ? Number(prFrequencyRaw) : null,
      isBlacklisted,
      blacklistReason: blacklistReason || null,
      notes: notes || null,
      lastEnrichedAt: new Date(),
    },
  });
  revalidatePath(`/influencers/${id}`);
  revalidatePath("/influencers");
}

export async function estimateAttributes(id: number) {
  const inf = await prisma.influencer.findUniqueOrThrow({ where: { id } });

  const prompt = `以下のSNSアカウント情報から、フォロワー層とジャンルを推定してください。
情報が不十分で判断できない項目は null にしてください。憶測で断定しすぎないよう注意してください。

プラットフォーム: ${inf.platform}
username: ${inf.username}
表示名: ${inf.displayName ?? "(不明)"}
bio: ${inf.bio ?? "(不明)"}
既存ジャンルタグ: ${inf.genreTags ?? "(不明)"}
フォロワー数: ${inf.followers ?? "(不明)"}

出力項目:
- genreTags: このアカウントのジャンルタグ(カンマ区切りの文字列、例: "暮らし,料理,美容")
- ageBand: 発信者本人の推定年代("20s","30s","40s","50s","60s+"のいずれか)
- audienceAgeGuess: フォロワー層の推定年齢帯(カンマ区切り、例: "40s,50s")
- audienceGenderGuess: フォロワー層の推定性別("male","female","mixed"のいずれか)`;

  const result = await generateJson<{
    genreTags: string | null;
    ageBand: string | null;
    audienceAgeGuess: string | null;
    audienceGenderGuess: string | null;
  }>(prompt, {
    type: Type.OBJECT,
    properties: {
      genreTags: { type: Type.STRING, nullable: true },
      ageBand: { type: Type.STRING, nullable: true },
      audienceAgeGuess: { type: Type.STRING, nullable: true },
      audienceGenderGuess: { type: Type.STRING, nullable: true },
    },
    required: ["genreTags", "ageBand", "audienceAgeGuess", "audienceGenderGuess"],
  });

  await prisma.influencer.update({
    where: { id },
    data: {
      genreTags: result.genreTags || inf.genreTags,
      ageBand: result.ageBand || inf.ageBand,
      audienceAgeGuess: result.audienceAgeGuess || inf.audienceAgeGuess,
      audienceGenderGuess: result.audienceGenderGuess || inf.audienceGenderGuess,
      lastEnrichedAt: new Date(),
    },
  });

  revalidatePath(`/influencers/${id}`);
}
