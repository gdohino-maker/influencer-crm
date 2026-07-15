import type { CampaignInfluencer, Influencer, ScoringProfile } from "@prisma/client";

// ER正規化(規模補正): 1万=3.0%で満点 / 1万〜10万=1.5% / 10万〜=1.0%
export function normalizeER(engagementRate: number | null, followers: number | null): number {
  if (!engagementRate) return 0;
  const f = followers ?? 0;
  const benchmark = f <= 10_000 ? 3.0 : f <= 100_000 ? 1.5 : 1.0;
  return Math.min(engagementRate / benchmark, 1);
}

export function activityScore(postsCount: number | null): number {
  if (!postsCount) return 0;
  return Math.min(postsCount / 50, 1);
}

export function normalizeFollower(followers: number | null): number {
  if (!followers) return 0;
  if (followers >= 100_000) return 1;
  if (followers >= 10_000) return 0.6;
  if (followers >= 1_000) return 0.3;
  return 0.1;
}

export function hasExcludeFlag(ci: Pick<CampaignInfluencer, "excludeFlags" | "audienceFit">): boolean {
  if (ci.excludeFlags && ci.excludeFlags.trim().length > 0) return true;
  if (ci.audienceFit != null && ci.audienceFit <= 1) return true;
  return false;
}

export function calcScore(
  inf: Pick<
    Influencer,
    "isBlacklisted" | "engagementRate" | "followers" | "photoQuality" | "prFrequency" | "postsCount"
  >,
  ci: Pick<CampaignInfluencer, "audienceFit" | "genreFit" | "excludeFlags">,
  sp: Pick<ScoringProfile, "wAudience" | "wGenre" | "wEr" | "wPhoto" | "wNotJaded" | "wActivity" | "wFollower">
): number {
  if (inf.isBlacklisted) return 0;
  if (hasExcludeFlag(ci as CampaignInfluencer)) return 0;

  const audience = (ci.audienceFit ?? 0) / 5;
  const genre = (ci.genreFit ?? 0) / 5;
  const er = normalizeER(inf.engagementRate, inf.followers);
  const photo = (inf.photoQuality ?? 0) / 5;
  const notJaded = 1 - Math.min(inf.prFrequency ?? 0, 1);
  const activity = activityScore(inf.postsCount);
  const follower = normalizeFollower(inf.followers);

  return (
    audience * sp.wAudience +
    genre * sp.wGenre +
    er * sp.wEr +
    photo * sp.wPhoto +
    notJaded * sp.wNotJaded +
    activity * sp.wActivity +
    follower * sp.wFollower
  );
}
