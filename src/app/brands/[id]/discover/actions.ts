"use server";

import { prisma } from "@/lib/db";
import { parseSocialUrl } from "@/lib/parse-social-url";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

// Instagram/X/TikTokのプロフィールURLを貼るだけでマスタに簡易登録する(手動発掘の摩擦を下げるため)
export async function addQuickInfluencer(brandId: number, formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const campaignIdRaw = String(formData.get("campaignId") ?? "").trim();
  const qsCampaign = campaignIdRaw ? `&campaignId=${campaignIdRaw}` : "";

  const parsed = parseSocialUrl(url);
  if (!parsed) {
    redirect(`/brands/${brandId}/discover?quickError=1${qsCampaign}`);
  }

  let influencer = await prisma.influencer.findUnique({
    where: { platform_username: { platform: parsed.platform, username: parsed.username } },
  });

  if (!influencer) {
    influencer = await prisma.influencer.create({
      data: {
        platform: parsed.platform,
        username: parsed.username,
        url: url.startsWith("http") ? url : `https://${url}`,
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

  revalidatePath("/influencers");
  redirect(`/brands/${brandId}/discover?quickAdded=${encodeURIComponent(influencer.username)}${qsCampaign}`);
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
