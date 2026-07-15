import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaignId = Number(id);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      brand: { include: { client: true } },
      members: {
        include: {
          influencer: true,
          posts: true,
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const headers = [
    "platform",
    "username",
    "displayName",
    "followers",
    "engagementRate",
    "status",
    "score",
    "postUrl",
    "postedAt",
    "postType",
    "reach",
    "impressions",
    "likes",
    "saves",
    "comments",
    "linkClicks",
    "hasPr",
    "hasRelation",
    "hasCta",
    "secondaryUseOk",
  ];

  const rows: string[] = [headers.join(",")];

  for (const m of campaign.members) {
    if (m.posts.length === 0) {
      rows.push(
        [
          m.influencer.platform,
          m.influencer.username,
          m.influencer.displayName,
          m.influencer.followers,
          m.influencer.engagementRate,
          m.status,
          m.score,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]
          .map(csvEscape)
          .join(",")
      );
      continue;
    }
    for (const p of m.posts) {
      rows.push(
        [
          m.influencer.platform,
          m.influencer.username,
          m.influencer.displayName,
          m.influencer.followers,
          m.influencer.engagementRate,
          m.status,
          m.score,
          p.url,
          p.postedAt ? p.postedAt.toISOString().slice(0, 10) : "",
          p.postType,
          p.reach,
          p.impressions,
          p.likes,
          p.saves,
          p.comments,
          p.linkClicks,
          p.hasPr,
          p.hasRelation,
          p.hasCta,
          p.secondaryUseOk,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
  }

  // 個人情報(発送先住所・DM本文/返信)はクライアント提出レポートの対象外
  const csv = "﻿" + rows.join("\r\n");
  const fileName = `report_${campaign.brand.client.name}_${campaign.name}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
