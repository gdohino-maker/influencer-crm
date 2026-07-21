import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseInfluencerSearchQuery } from "@/lib/gemini";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const { query } = (await req.json()) as { query?: string };
  if (!query?.trim()) {
    return NextResponse.json({ error: "queryは必須です" }, { status: 400 });
  }

  let filter;
  try {
    filter = await parseInfluencerSearchQuery(query);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI検索条件の解析に失敗しました" },
      { status: 500 }
    );
  }

  const where: Prisma.InfluencerWhereInput = { isBlacklisted: false };
  if (filter.platform) where.platform = filter.platform;
  if (filter.genreKeywords.length) {
    where.OR = filter.genreKeywords.map((kw) => ({ genreTags: { contains: kw } }));
  }
  if (filter.audienceAgeBands.length) {
    where.AND = filter.audienceAgeBands.map((band) => ({ audienceAgeGuess: { contains: band } }));
  }
  if (filter.audienceGender) where.audienceGenderGuess = filter.audienceGender;
  if (filter.minPhotoQuality != null) where.photoQuality = { gte: filter.minPhotoQuality };
  if (filter.maxPrFrequency != null) where.prFrequency = { lte: filter.maxPrFrequency };
  if (filter.minFollowers != null || filter.maxFollowers != null) {
    where.followers = {
      ...(filter.minFollowers != null ? { gte: filter.minFollowers } : {}),
      ...(filter.maxFollowers != null ? { lte: filter.maxFollowers } : {}),
    };
  }

  const results = await prisma.influencer.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ filter, results });
}
