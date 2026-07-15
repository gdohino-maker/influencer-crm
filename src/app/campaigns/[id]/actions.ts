"use server";

import { prisma } from "@/lib/db";
import { calcScore } from "@/lib/score";
import { generateJson } from "@/lib/gemini";
import { Type } from "@google/genai";
import { revalidatePath } from "next/cache";

export async function addCandidate(campaignId: number, influencerId: number) {
  const existing = await prisma.campaignInfluencer.findUnique({
    where: { campaignId_influencerId: { campaignId, influencerId } },
  });
  if (existing) return;

  await prisma.campaignInfluencer.create({
    data: { campaignId, influencerId },
  });
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function updateFit(memberId: number, campaignId: number, formData: FormData) {
  const audienceFitRaw = String(formData.get("audienceFit") ?? "").trim();
  const genreFitRaw = String(formData.get("genreFit") ?? "").trim();
  const excludeFlags = String(formData.get("excludeFlags") ?? "").trim();

  const member = await prisma.campaignInfluencer.update({
    where: { id: memberId },
    data: {
      audienceFit: audienceFitRaw ? Number(audienceFitRaw) : null,
      genreFit: genreFitRaw ? Number(genreFitRaw) : null,
      excludeFlags: excludeFlags || null,
    },
    include: { influencer: true, campaign: { include: { brand: { include: { scoringProfile: true } } } } },
  });

  const score = calcScore(member.influencer, member, member.campaign.brand.scoringProfile);
  await prisma.campaignInfluencer.update({ where: { id: memberId }, data: { score } });

  revalidatePath(`/campaigns/${campaignId}`);
}

export async function suggestFit(memberId: number, campaignId: number) {
  const member = await prisma.campaignInfluencer.findUniqueOrThrow({
    where: { id: memberId },
    include: { influencer: true, campaign: { include: { brand: { include: { scoringProfile: true } } } } },
  });
  const { influencer } = member;
  const { brand } = member.campaign;

  const prompt = `あなたはインフルエンサーマーケティングのアサイン担当者です。
以下のブランドのターゲット条件と、インフルエンサーのプロフィールを突き合わせて、1〜5の整数で適合度を採点してください。
5=非常に合致, 3=普通, 1=ほぼ合致しない。判断根拠が乏しい場合も1〜5の中で最も妥当な推定値を出してください。

【ブランドのターゲット条件】
ターゲット年齢層: ${brand.targetAgeBands}
ターゲット性別: ${brand.targetGender}
ターゲットジャンル: ${brand.targetGenres}
カテゴリ: ${brand.category}

【インフルエンサープロフィール】
ジャンルタグ: ${influencer.genreTags ?? "不明"}
bio: ${influencer.bio ?? "不明"}
フォロワー推定年齢帯: ${influencer.audienceAgeGuess ?? "不明"}
フォロワー推定性別: ${influencer.audienceGenderGuess ?? "不明"}
発信者本人の年代: ${influencer.ageBand ?? "不明"}

出力項目:
- audienceFit: ターゲット層(年齢・性別)への適合度(1-5の整数)
- genreFit: ジャンルへの適合度(1-5の整数)
- reason: 採点理由(1〜2文の短い説明)`;

  const result = await generateJson<{ audienceFit: number; genreFit: number; reason: string }>(prompt, {
    type: Type.OBJECT,
    properties: {
      audienceFit: { type: Type.INTEGER },
      genreFit: { type: Type.INTEGER },
      reason: { type: Type.STRING },
    },
    required: ["audienceFit", "genreFit", "reason"],
  });

  const audienceFit = Math.min(5, Math.max(1, Math.round(result.audienceFit)));
  const genreFit = Math.min(5, Math.max(1, Math.round(result.genreFit)));

  const updated = await prisma.campaignInfluencer.update({
    where: { id: memberId },
    data: {
      audienceFit,
      genreFit,
      notes: member.notes ? `${member.notes}\n[AI採点理由] ${result.reason}` : `[AI採点理由] ${result.reason}`,
    },
    include: { influencer: true },
  });

  const score = calcScore(updated.influencer, updated, member.campaign.brand.scoringProfile);
  await prisma.campaignInfluencer.update({ where: { id: memberId }, data: { score } });

  revalidatePath(`/campaigns/${campaignId}`);
}

export async function recalcAllScores(campaignId: number) {
  const members = await prisma.campaignInfluencer.findMany({
    where: { campaignId },
    include: { influencer: true, campaign: { include: { brand: { include: { scoringProfile: true } } } } },
  });
  for (const m of members) {
    const score = calcScore(m.influencer, m, m.campaign.brand.scoringProfile);
    await prisma.campaignInfluencer.update({ where: { id: m.id }, data: { score } });
  }
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function updateMemberStatus(memberId: number, campaignId: number, formData: FormData) {
  const status = String(formData.get("status") ?? "").trim();
  await prisma.campaignInfluencer.update({ where: { id: memberId }, data: { status } });
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function removeCandidate(memberId: number, campaignId: number) {
  const [outreachCount, shipmentCount, postCount] = await Promise.all([
    prisma.outreach.count({ where: { campaignInfluencerId: memberId } }),
    prisma.shipment.count({ where: { campaignInfluencerId: memberId } }),
    prisma.post.count({ where: { campaignInfluencerId: memberId } }),
  ]);
  if (outreachCount > 0 || shipmentCount > 0 || postCount > 0) {
    throw new Error("DM送付・発送・投稿の記録がある候補者は削除できません。ステータスを「辞退」に変更してください。");
  }
  await prisma.campaignInfluencer.delete({ where: { id: memberId } });
  revalidatePath(`/campaigns/${campaignId}`);
}
