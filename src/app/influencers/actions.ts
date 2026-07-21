"use server";

import { prisma } from "@/lib/db";
import { generateJson } from "@/lib/gemini";
import { fetchInstagramBusinessDiscovery } from "@/lib/instagram";
import { Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normalizeNfkc(text: string): string {
  return text.normalize("NFKC");
}

async function readBulkSource(formData: FormData): Promise<string> {
  const file = formData.get("csvFile");
  if (file instanceof File && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    return stripBom(buffer.toString("utf-8"));
  }
  return stripBom(String(formData.get("bulk") ?? ""));
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

// Claude for Chromeのリサーチ結果CSV(ヘッダー付き)の想定カラム名
const RICH_CSV_HEADERS = [
  "username",
  "url",
  "displayname",
  "followers",
  "totallikes",
  "postscount",
  "avgview",
  "avglike",
  "avgengagement",
  "avgcomment",
  "videoavgscore",
  "postfreqweek",
  "lastpublished",
  "contact",
  "notes",
];

function parseCsvLine(line: string): string[] {
  // 簡易CSVパーサ(ダブルクォート囲み・エスケープに対応)
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols.map((c) => c.trim());
}

export async function createInfluencersBulk(formData: FormData) {
  const platform = String(formData.get("platform") ?? "").trim();
  const raw = await readBulkSource(formData);
  if (!platform || !raw.trim()) throw new Error("プラットフォームと一覧データ(貼り付けまたはCSVファイル)は必須です");

  const lines = raw
    .split(/\r?\n/)
    .map((l) => normalizeNfkc(l.trim()))
    .filter(Boolean);

  let created = 0;
  let skipped = 0;

  // 先頭行がリッチCSVのヘッダーか判定
  const firstCols = lines.length > 0 ? parseCsvLine(lines[0]).map((c) => c.toLowerCase()) : [];
  const isRichHeader = RICH_CSV_HEADERS.every((h) => firstCols.includes(h));
  const dataLines = isRichHeader || /^username\s*,/i.test(lines[0] ?? "") ? lines.slice(1) : lines;

  for (const line of dataLines) {
    const cols = parseCsvLine(line);

    let username: string;
    let url: string;
    let displayName: string;
    let followersStr: string;
    let totalLikesStr = "";
    let postsCountStr = "";
    let avgViewStr = "";
    let avgLikeStr = "";
    let avgEngagementStr = "";
    let avgCommentStr = "";
    let videoAvgScoreStr = "";
    let postFreqWeekStr = "";
    let lastPublishedStr = "";
    let contact = "";
    let notes = "";
    let genreTags = "";
    let engagementRateStr = "";

    if (isRichHeader) {
      [
        username,
        url,
        displayName,
        followersStr,
        totalLikesStr,
        postsCountStr,
        avgViewStr,
        avgLikeStr,
        avgEngagementStr,
        avgCommentStr,
        videoAvgScoreStr,
        postFreqWeekStr,
        lastPublishedStr,
        contact,
        notes,
      ] = cols;
    } else {
      let genreRest: string[];
      [username, url, displayName, followersStr, engagementRateStr, ...genreRest] = cols;
      genreTags = genreRest.join(",").trim();
    }
    if (!username) continue;

    const existing = await prisma.influencer.findUnique({
      where: { platform_username: { platform, username } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const avgLikeNum = avgLikeStr ? Number(avgLikeStr) : null;
    const avgViewNum = avgViewStr ? Number(avgViewStr) : null;
    const avgCommentNum = avgCommentStr ? Number(avgCommentStr) : null;
    const followersNum = followersStr ? Number(followersStr) : null;
    const computedEr =
      avgLikeNum != null && avgCommentNum != null && followersNum ? ((avgLikeNum + avgCommentNum) / followersNum) * 100 : null;

    await prisma.influencer.create({
      data: {
        platform,
        username,
        url: url || `https://${platform}.com/${username}`,
        displayName: displayName || null,
        followers: followersNum,
        engagementRate: engagementRateStr ? Number(engagementRateStr) : computedEr,
        genreTags: genreTags || null,
        totalLikes: totalLikesStr ? Number(totalLikesStr) : null,
        postsCount: postsCountStr ? Number(postsCountStr) : null,
        avgView: avgViewNum,
        avgLike: avgLikeNum,
        avgEngagement: avgEngagementStr ? Number(avgEngagementStr) : null,
        avgComment: avgCommentNum,
        videoAvgScore: videoAvgScoreStr ? Number(videoAvgScoreStr) : null,
        postFreqWeek: postFreqWeekStr ? Number(postFreqWeekStr) : null,
        lastPublishedAt: lastPublishedStr ? new Date(lastPublishedStr) : null,
        contact: contact || null,
        notes: notes || null,
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
  const totalLikesRaw = String(formData.get("totalLikes") ?? "").trim();
  const avgViewRaw = String(formData.get("avgView") ?? "").trim();
  const avgEngagementRaw = String(formData.get("avgEngagement") ?? "").trim();
  const videoAvgScoreRaw = String(formData.get("videoAvgScore") ?? "").trim();
  const postFreqWeekRaw = String(formData.get("postFreqWeek") ?? "").trim();
  const lastPublishedAtRaw = String(formData.get("lastPublishedAt") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
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
      totalLikes: totalLikesRaw ? Number(totalLikesRaw) : null,
      avgView: avgViewRaw ? Number(avgViewRaw) : null,
      avgEngagement: avgEngagementRaw ? Number(avgEngagementRaw) : null,
      videoAvgScore: videoAvgScoreRaw ? Number(videoAvgScoreRaw) : null,
      postFreqWeek: postFreqWeekRaw ? Number(postFreqWeekRaw) : null,
      lastPublishedAt: lastPublishedAtRaw ? new Date(lastPublishedAtRaw) : null,
      contact: contact || null,
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

export async function enrichFromInstagram(id: number) {
  const inf = await prisma.influencer.findUniqueOrThrow({ where: { id } });
  if (inf.platform !== "instagram") {
    throw new Error("Instagram enrichはplatform=instagramのアカウントのみ対応です");
  }

  const result = await fetchInstagramBusinessDiscovery(inf.username);

  await prisma.influencer.update({
    where: { id },
    data: {
      followers: result.followersCount ?? inf.followers,
      postsCount: result.mediaCount ?? inf.postsCount,
      avgLike: result.avgLike ?? inf.avgLike,
      avgComment: result.avgComment ?? inf.avgComment,
      engagementRate: result.engagementRate ?? inf.engagementRate,
      lastEnrichedAt: new Date(),
    },
  });

  revalidatePath(`/influencers/${id}`);
}
