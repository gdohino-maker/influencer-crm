import { prisma } from "@/lib/db";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

export type YoutubeChannelCandidate = {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  customUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
};

function getApiKey(): string {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEYが設定されていません。.env.localおよびVercelの環境変数に設定してください。");
  }
  return apiKey;
}

async function searchChannelsLive(keyword: string): Promise<YoutubeChannelCandidate[]> {
  const apiKey = getApiKey();

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "channel");
  searchUrl.searchParams.set("q", keyword);
  searchUrl.searchParams.set("regionCode", "JP");
  searchUrl.searchParams.set("relevanceLanguage", "ja");
  searchUrl.searchParams.set("maxResults", "25");
  searchUrl.searchParams.set("key", apiKey);

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    const body = await searchRes.text();
    throw new Error(`YouTube検索APIエラー(${searchRes.status}): ${body.slice(0, 300)}`);
  }
  const searchJson = await searchRes.json();
  const channelIds: string[] = (searchJson.items ?? [])
    .map((item: { snippet?: { channelId?: string }; id?: { channelId?: string } }) => item.id?.channelId)
    .filter((id: string | undefined): id is string => Boolean(id));

  if (channelIds.length === 0) return [];

  const statsUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  statsUrl.searchParams.set("part", "snippet,statistics");
  statsUrl.searchParams.set("id", channelIds.join(","));
  statsUrl.searchParams.set("key", apiKey);

  const statsRes = await fetch(statsUrl.toString());
  if (!statsRes.ok) {
    const body = await statsRes.text();
    throw new Error(`YouTubeチャンネルAPIエラー(${statsRes.status}): ${body.slice(0, 300)}`);
  }
  const statsJson = await statsRes.json();

  return (statsJson.items ?? []).map(
    (item: {
      id: string;
      snippet?: { title?: string; description?: string; thumbnails?: { default?: { url?: string } }; customUrl?: string };
      statistics?: { subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
    }) => ({
      channelId: item.id,
      title: item.snippet?.title ?? "(no title)",
      description: item.snippet?.description ?? "",
      thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? null,
      customUrl: item.snippet?.customUrl ?? null,
      subscriberCount:
        item.statistics?.hiddenSubscriberCount || !item.statistics?.subscriberCount
          ? null
          : Number(item.statistics.subscriberCount),
      videoCount: item.statistics?.videoCount ? Number(item.statistics.videoCount) : null,
    })
  );
}

// 同一キーワードは24時間キャッシュして再利用する(YouTube Data API v3のクォータ節約のため必須)
export async function searchChannelsCached(keyword: string): Promise<{ results: YoutubeChannelCandidate[]; fromCache: boolean }> {
  const cached = await prisma.youtubeSearchCache.findUnique({ where: { keyword } });
  if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_MS) {
    return { results: JSON.parse(cached.results) as YoutubeChannelCandidate[], fromCache: true };
  }

  const results = await searchChannelsLive(keyword);

  await prisma.youtubeSearchCache.upsert({
    where: { keyword },
    create: { keyword, results: JSON.stringify(results) },
    update: { results: JSON.stringify(results), createdAt: new Date() },
  });

  return { results, fromCache: false };
}
