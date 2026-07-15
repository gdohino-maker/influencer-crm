"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// YouTube検索結果のチャンネルをインフルエンサーマスタに登録し、任意でキャンペーン候補にも追加する
export async function addYoutubeCandidate(brandId: number, formData: FormData) {
  const channelId = String(formData.get("channelId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const customUrl = String(formData.get("customUrl") ?? "").trim();
  const subscriberCountRaw = String(formData.get("subscriberCount") ?? "").trim();
  const videoCountRaw = String(formData.get("videoCount") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const campaignIdRaw = String(formData.get("campaignId") ?? "").trim();

  if (!channelId) throw new Error("channelIdは必須です");

  const username = customUrl ? customUrl.replace(/^@/, "") : channelId;

  let influencer = await prisma.influencer.findUnique({
    where: { platform_username: { platform: "youtube", username } },
  });

  if (!influencer) {
    influencer = await prisma.influencer.create({
      data: {
        platform: "youtube",
        username,
        url: `https://www.youtube.com/channel/${channelId}`,
        displayName: title || null,
        bio: description || null,
        followers: subscriberCountRaw ? Number(subscriberCountRaw) : null,
        postsCount: videoCountRaw ? Number(videoCountRaw) : null,
      },
    });
  }

  if (campaignIdRaw) {
    const campaignId = Number(campaignIdRaw);
    const existing = await prisma.campaignInfluencer.findUnique({
      where: { campaignId_influencerId: { campaignId, influencerId: influencer.id } },
    });
    if (!existing) {
      await prisma.campaignInfluencer.create({ data: { campaignId, influencerId: influencer.id } });
    }
  }

  revalidatePath(`/brands/${brandId}/discover`);
  revalidatePath("/influencers");
}

// マスタ推薦のインフルエンサーを指定キャンペーンの候補に追加する
export async function addRecommendedToCampaign(brandId: number, formData: FormData) {
  const influencerId = Number(formData.get("influencerId"));
  const campaignId = Number(formData.get("campaignId"));
  if (!influencerId || !campaignId) throw new Error("キャンペーンを選択してください");

  const existing = await prisma.campaignInfluencer.findUnique({
    where: { campaignId_influencerId: { campaignId, influencerId } },
  });
  if (!existing) {
    await prisma.campaignInfluencer.create({ data: { campaignId, influencerId } });
  }

  revalidatePath(`/brands/${brandId}/discover`);
  revalidatePath(`/campaigns/${campaignId}`);
}
