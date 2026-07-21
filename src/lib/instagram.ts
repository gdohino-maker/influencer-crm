// Instagram Graph API の Business Discovery を使ったenrichのみ。
// Hashtag Search API は投稿者usernameを返さないため、発見(探索)用途には使わない。
// 対象は公開ビジネス/クリエイターアカウントのみ。個人アカウントは手動入力にフォールバックする。

const GRAPH_API_VERSION = "v21.0";

export interface InstagramBusinessDiscoveryResult {
  followersCount: number | null;
  mediaCount: number | null;
  avgLike: number | null;
  avgComment: number | null;
  engagementRate: number | null;
}

interface BusinessDiscoveryMedia {
  like_count?: number;
  comments_count?: number;
}

interface BusinessDiscoveryResponse {
  business_discovery?: {
    followers_count?: number;
    media_count?: number;
    media?: { data?: BusinessDiscoveryMedia[] };
  };
  error?: { message: string };
}

export async function fetchInstagramBusinessDiscovery(
  username: string
): Promise<InstagramBusinessDiscoveryResult> {
  const accessToken = process.env.IG_ACCESS_TOKEN;
  const businessAccountId = process.env.IG_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !businessAccountId) {
    throw new Error(
      "IG_ACCESS_TOKEN / IG_BUSINESS_ACCOUNT_ID が未設定です。数値は手動入力してください。"
    );
  }

  const fields = `business_discovery.username(${username}){followers_count,media_count,media.limit(10){like_count,comments_count}}`;
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${businessAccountId}?fields=${encodeURIComponent(
    fields
  )}&access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url);
  const json = (await res.json()) as BusinessDiscoveryResponse;

  if (!res.ok || json.error) {
    throw new Error(
      json.error?.message ??
        "Instagram Business Discoveryの取得に失敗しました(非公開/個人アカウントの可能性があります)。手動入力してください。"
    );
  }

  const bd = json.business_discovery;
  const media = bd?.media?.data ?? [];
  const likeSum = media.reduce((sum, m) => sum + (m.like_count ?? 0), 0);
  const commentSum = media.reduce((sum, m) => sum + (m.comments_count ?? 0), 0);
  const avgLike = media.length ? Math.round(likeSum / media.length) : null;
  const avgComment = media.length ? Math.round(commentSum / media.length) : null;
  const followersCount = bd?.followers_count ?? null;
  const engagementRate =
    followersCount && avgLike !== null && avgComment !== null && followersCount > 0
      ? Number((((avgLike + avgComment) / followersCount) * 100).toFixed(2))
      : null;

  return {
    followersCount,
    mediaCount: bd?.media_count ?? null,
    avgLike,
    avgComment,
    engagementRate,
  };
}
