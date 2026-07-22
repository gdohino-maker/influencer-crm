"use server";

import { prisma } from "@/lib/db";
import { parseSocialUrl } from "@/lib/parse-social-url";
import { parseInfluencerCsvRows, stripBom } from "@/lib/csv-import";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function readCsvSource(formData: FormData): Promise<string> {
  const file = formData.get("csvFile");
  if (file instanceof File && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    return stripBom(buffer.toString("utf-8"));
  }
  return stripBom(String(formData.get("csv") ?? ""));
}

// YouTube検索結果のチャンネルをインフルエンサーマスタに登録し、任意でキャンペーン候補に追加してDM作成画面へ遷移する
export async function addYoutubeCandidate(brandId: number, formData: FormData) {
  const channelId = String(formData.get("channelId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const customUrl = String(formData.get("customUrl") ?? "").trim();
  const subscriberCountRaw = String(formData.get("subscriberCount") ?? "").trim();
  const videoCountRaw = String(formData.get("videoCount") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const thumbnailUrl = String(formData.get("thumbnailUrl") ?? "").trim();
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
        avatarUrl: thumbnailUrl || null,
        followers: subscriberCountRaw ? Number(subscriberCountRaw) : null,
        postsCount: videoCountRaw ? Number(videoCountRaw) : null,
      },
    });
  }

  revalidatePath(`/brands/${brandId}/discover`);
  revalidatePath("/influencers");

  if (campaignIdRaw) {
    const campaignId = Number(campaignIdRaw);
    let member = await prisma.campaignInfluencer.findUnique({
      where: { campaignId_influencerId: { campaignId, influencerId: influencer.id } },
    });
    if (!member) {
      member = await prisma.campaignInfluencer.create({ data: { campaignId, influencerId: influencer.id } });
    }
    revalidatePath(`/campaigns/${campaignId}`);
    redirect(`/campaigns/${campaignId}/members/${member.id}`);
  }
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

// Claude for Chrome等でSNS(TikTok/Instagram)をリサーチした結果のCSVを貼り付けて一括登録する(任意で選択中キャンペーンにも追加)
export async function importSnsResearch(brandId: number, formData: FormData) {
  const platform = String(formData.get("platform") ?? "tiktok").trim();
  const raw = (await readCsvSource(formData)).trim();
  const campaignIdRaw = String(formData.get("campaignId") ?? "").trim();
  const qsCampaign = campaignIdRaw ? `&campaignId=${campaignIdRaw}` : "";

  if (!raw) throw new Error("CSVを貼り付けるか、ファイルをドロップしてください");

  const rows = parseInfluencerCsvRows(platform, raw);
  let created = 0;
  let skipped = 0;
  let addedToCampaign = 0;

  for (const row of rows) {
    let influencer = await prisma.influencer.findUnique({
      where: { platform_username: { platform, username: row.username } },
    });

    if (!influencer) {
      influencer = await prisma.influencer.create({ data: { platform, ...row } });
      created++;
    } else {
      skipped++;
    }

    if (campaignIdRaw) {
      const campaignId = Number(campaignIdRaw);
      const existing = await prisma.campaignInfluencer.findUnique({
        where: { campaignId_influencerId: { campaignId, influencerId: influencer.id } },
      });
      if (!existing) {
        await prisma.campaignInfluencer.create({ data: { campaignId, influencerId: influencer.id } });
        addedToCampaign++;
      }
    }
  }

  revalidatePath("/influencers");
  revalidatePath(`/brands/${brandId}/discover`);
  redirect(
    `/brands/${brandId}/discover?snsImported=${created}&snsSkipped=${skipped}&snsAddedToCampaign=${addedToCampaign}${qsCampaign}`
  );
}

// マスタ推薦のインフルエンサーを「決定」し、そのままメール文(DM下書き)作成画面へ遷移する
export async function decideRecommended(brandId: number, formData: FormData) {
  const influencerId = Number(formData.get("influencerId"));
  const campaignId = Number(formData.get("campaignId"));
  if (!influencerId || !campaignId) throw new Error("キャンペーンを選択してください");

  let member = await prisma.campaignInfluencer.findUnique({
    where: { campaignId_influencerId: { campaignId, influencerId } },
  });
  if (!member) {
    member = await prisma.campaignInfluencer.create({ data: { campaignId, influencerId } });
  }

  revalidatePath(`/brands/${brandId}/discover`);
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}/members/${member.id}`);
}
