import type { Brand, Influencer } from "@prisma/client";

function parseCsv(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function overlapRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const hits = a.filter((x) => setB.has(x)).length;
  return hits / Math.min(a.length, b.length);
}

// フォロワー数を対数スケールで0-1に正規化する(1,000人=0.33、10万人=0.67、100万人=1.0が目安)
function followerReachScore(followers: number | null | undefined): number {
  if (!followers || followers <= 0) return 0;
  return Math.min(Math.log10(followers + 1) / 6, 1);
}

// 投稿数を活動量の目安として0-1に正規化する
function postActivityScore(postsCount: number | null | undefined): number {
  if (!postsCount) return 0;
  return Math.min(postsCount / 50, 1);
}

export type RecommendScoreInput = Pick<
  Influencer,
  | "isBlacklisted"
  | "genreTags"
  | "audienceAgeGuess"
  | "audienceGenderGuess"
  | "photoQuality"
  | "prFrequency"
  | "followers"
  | "postsCount"
>;

// 既存マスタのInfluencerをブランドのターゲット条件と突き合わせて、ブランド非依存の一致度を算出する。
// キャンペーンに紐づくaudienceFit/genreFitとは別軸で、「まず候補として拾う価値があるか」の目安。
// genreConfidenceOverride: ジャンルタグが無いがキーワード検索経由で来た等、genreScoreの代わりに使う確度(0-1)。
export function recommendScore(inf: RecommendScoreInput, brand: Brand, genreConfidenceOverride?: number): number {
  if (inf.isBlacklisted) return 0;

  const brandGenres = parseCsv(brand.targetGenres);
  const infGenres = parseCsv(inf.genreTags);
  const genreScore = infGenres.length > 0 ? overlapRatio(infGenres, brandGenres) : (genreConfidenceOverride ?? 0); // 0-1

  const brandAges = parseCsv(brand.targetAgeBands);
  const infAges = parseCsv(inf.audienceAgeGuess);
  const ageScore = overlapRatio(infAges, brandAges); // 0-1(不明なら0)

  const genderScore =
    brand.targetGender === "all" || !inf.audienceGenderGuess
      ? 0.5
      : inf.audienceGenderGuess === brand.targetGender || inf.audienceGenderGuess === "mixed"
        ? 1
        : 0;

  const photoScore = inf.photoQuality != null ? inf.photoQuality / 5 : 0; // 0-1(不明なら0)
  const notJadedScore = inf.prFrequency != null ? 1 - Math.min(inf.prFrequency, 1) : 0.5; // 0-1(不明なら中立0.5)
  const reachScore = followerReachScore(inf.followers);
  const activityScore = postActivityScore(inf.postsCount);

  return (
    genreScore * 30 +
    ageScore * 10 +
    genderScore * 5 +
    photoScore * 10 +
    notJadedScore * 5 +
    reachScore * 25 +
    activityScore * 15
  );
}

export function hasAnySignal(inf: Influencer): boolean {
  return Boolean(inf.genreTags || inf.audienceAgeGuess || inf.audienceGenderGuess);
}
