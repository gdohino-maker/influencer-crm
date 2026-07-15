"use server";

import { prisma } from "@/lib/db";
import { checkNgWords } from "@/lib/ngwords";
import { generateText, generateJson } from "@/lib/gemini";
import { Type } from "@google/genai";
import { revalidatePath } from "next/cache";

// ローカルの完全一致チェックで漏れる言い換え表現をAIで補助検出する(失敗時はnullを返し投稿記録は継続する)
async function aiDetectNgWords(
  caption: string,
  ngWords: string | null,
  okWords: string | null
): Promise<string | null> {
  if (!caption.trim() || !ngWords || !ngWords.trim()) return null;
  try {
    const prompt = `以下のSNS投稿キャプションが、薬機法等の観点で使用禁止の表現の"言い換え・示唆"を含んでいないか判定してください。
完全一致していなくても、意味的に禁止表現をほのめかしている場合はヒットとしてください。

禁止表現リスト: ${ngWords}
許可されている表現例: ${okWords ?? "(指定なし)"}

投稿キャプション:
"""
${caption}
"""

出力項目:
- hits: 検出した禁止表現に該当する語句・言い回しの配列(該当なしの場合は空配列)`;

    const result = await generateJson<{ hits: string[] }>(prompt, {
      type: Type.OBJECT,
      properties: { hits: { type: Type.ARRAY, items: { type: Type.STRING } } },
      required: ["hits"],
    });
    const hits = result.hits.map((h) => h.trim()).filter(Boolean);
    return hits.length > 0 ? hits.join(",") : null;
  } catch {
    return null;
  }
}

export async function updateBlockA(memberId: number, campaignId: number, formData: FormData) {
  const blockA = String(formData.get("blockA") ?? "").trim();
  await prisma.campaignInfluencer.update({ where: { id: memberId }, data: { draftBlockA: blockA || null } });
  revalidatePath(`/campaigns/${campaignId}/members/${memberId}`);
}

export async function generateBlockA(memberId: number, campaignId: number) {
  const member = await prisma.campaignInfluencer.findUniqueOrThrow({
    where: { id: memberId },
    include: {
      influencer: true,
      campaign: { include: { brand: { include: { client: true } } } },
    },
  });
  const { influencer, campaign } = member;
  const { brand } = campaign;

  const prompt = `あなたはPR施策のインフルエンサーマーケティング担当者です。
以下のインフルエンサーに商品を無償提供し、感想投稿を依頼するDMの「依頼本文」だけを生成してください。
(投稿時の必須事項やNGワードのルールは別ブロックで自動付与されるため、ここには含めないでください)

条件:
- 丁寧語・敬語で書く
- 相手の直近の投稿や雰囲気に軽く触れているような、テンプレート感の薄い書き出しにする(ただし出典が不明な情報を捏造しない)
- 3〜5文程度の簡潔な文章
- 冒頭に宛名(〇〇様)、依頼企業名を入れる
- 効果効能を断定する表現(治る,痩せる等)は使わない

インフルエンサー: ${influencer.displayName ?? influencer.username}(@${influencer.username}, ${influencer.platform}）
ジャンルタグ: ${influencer.genreTags ?? "不明"}
bio: ${influencer.bio ?? "不明"}
依頼企業: ${brand.client.name}
商品名: ${brand.name}
商品説明: ${brand.description ?? "(なし)"}`;

  const text = await generateText(prompt);
  await prisma.campaignInfluencer.update({ where: { id: memberId }, data: { draftBlockA: text } });
  revalidatePath(`/campaigns/${campaignId}/members/${memberId}`);
}

export async function logOutreach(memberId: number, campaignId: number, formData: FormData) {
  const channel = String(formData.get("channel") ?? "dm");
  const body = String(formData.get("body") ?? "").trim();
  const sentAtRaw = String(formData.get("sentAt") ?? "").trim();
  if (!body) throw new Error("本文は必須です");

  await prisma.outreach.create({
    data: {
      campaignInfluencerId: memberId,
      channel,
      body,
      sentAt: sentAtRaw ? new Date(sentAtRaw) : new Date(),
    },
  });

  await prisma.campaignInfluencer.update({
    where: { id: memberId },
    data: { status: "dm_sent" },
  });

  revalidatePath(`/campaigns/${campaignId}/members/${memberId}`);
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function logReply(outreachId: number, campaignId: number, memberId: number, formData: FormData) {
  const reply = String(formData.get("reply") ?? "").trim();
  const agreedTerms = String(formData.get("agreedTerms") ?? "").trim();
  await prisma.outreach.update({
    where: { id: outreachId },
    data: { reply: reply || null, repliedAt: new Date(), agreedTerms: agreedTerms || null },
  });
  revalidatePath(`/campaigns/${campaignId}/members/${memberId}`);
}

export async function logShipment(memberId: number, campaignId: number, formData: FormData) {
  const shippedAtRaw = String(formData.get("shippedAt") ?? "").trim();
  const trackingNo = String(formData.get("trackingNo") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const itemCostRaw = String(formData.get("itemCost") ?? "").trim();
  const shippingFeeRaw = String(formData.get("shippingFee") ?? "").trim();
  const rewardYenRaw = String(formData.get("rewardYen") ?? "").trim();

  await prisma.shipment.create({
    data: {
      campaignInfluencerId: memberId,
      shippedAt: shippedAtRaw ? new Date(shippedAtRaw) : new Date(),
      trackingNo: trackingNo || null,
      address: address || null,
      itemCost: itemCostRaw ? Number(itemCostRaw) : null,
      shippingFee: shippingFeeRaw ? Number(shippingFeeRaw) : null,
      rewardYen: rewardYenRaw ? Number(rewardYenRaw) : 0,
    },
  });

  await prisma.campaignInfluencer.update({ where: { id: memberId }, data: { status: "shipped" } });

  revalidatePath(`/campaigns/${campaignId}/members/${memberId}`);
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function logPost(memberId: number, campaignId: number, formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const postedAtRaw = String(formData.get("postedAt") ?? "").trim();
  const postType = String(formData.get("postType") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const reachRaw = String(formData.get("reach") ?? "").trim();
  const impressionsRaw = String(formData.get("impressions") ?? "").trim();
  const likesRaw = String(formData.get("likes") ?? "").trim();
  const savesRaw = String(formData.get("saves") ?? "").trim();
  const commentsRaw = String(formData.get("comments") ?? "").trim();
  const linkClicksRaw = String(formData.get("linkClicks") ?? "").trim();
  const hasPr = formData.get("hasPr") === "on";
  const hasRelation = formData.get("hasRelation") === "on";
  const hasCta = formData.get("hasCta") === "on";
  const secondaryUseOk = formData.get("secondaryUseOk") === "on";
  const assetUrl = String(formData.get("assetUrl") ?? "").trim();

  if (!url) throw new Error("投稿URLは必須です");

  const member = await prisma.campaignInfluencer.findUnique({
    where: { id: memberId },
    include: { campaign: { include: { brand: { include: { complianceProfile: true } } } } },
  });
  if (!member) throw new Error("member not found");

  const localHit = checkNgWords(caption, member.campaign.brand.complianceProfile.ngWords);
  const aiHit = await aiDetectNgWords(caption, member.campaign.brand.complianceProfile.ngWords, member.campaign.brand.complianceProfile.okWords);
  const hitSet = new Set([...(localHit ? localHit.split(",") : []), ...(aiHit ? aiHit.split(",") : [])]);
  const ngWordHit = hitSet.size > 0 ? [...hitSet].join(",") : null;

  await prisma.post.create({
    data: {
      campaignInfluencerId: memberId,
      url,
      postedAt: postedAtRaw ? new Date(postedAtRaw) : new Date(),
      postType: postType || null,
      caption: caption || null,
      reach: reachRaw ? Number(reachRaw) : null,
      impressions: impressionsRaw ? Number(impressionsRaw) : null,
      likes: likesRaw ? Number(likesRaw) : null,
      saves: savesRaw ? Number(savesRaw) : null,
      comments: commentsRaw ? Number(commentsRaw) : null,
      linkClicks: linkClicksRaw ? Number(linkClicksRaw) : null,
      hasPr,
      hasRelation,
      hasCta,
      ngWordHit,
      secondaryUseOk,
      assetUrl: assetUrl || null,
    },
  });

  await prisma.campaignInfluencer.update({ where: { id: memberId }, data: { status: "posted" } });

  revalidatePath(`/campaigns/${campaignId}/members/${memberId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
}
