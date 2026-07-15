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

// 既存マスタのInfluencerをブランドのターゲット条件と突き合わせて、ブランド非依存の一致度を算出する。
// キャンペーンに紐づくaudienceFit/genreFitとは別軸で、「まず候補として拾う価値があるか」の目安。
export function recommendScore(inf: Influencer, brand: Brand): number {
  if (inf.isBlacklisted) return 0;

  const brandGenres = parseCsv(brand.targetGenres);
  const infGenres = parseCsv(inf.genreTags);
  const genreScore = overlapRatio(infGenres, brandGenres); // 0-1

  const brandAges = parseCsv(brand.targetAgeBands);
  const infAges = parseCsv(inf.audienceAgeGuess);
  const ageScore = overlapRatio(infAges, brandAges); // 0-1

  const genderScore =
    brand.targetGender === "all" || !inf.audienceGenderGuess
      ? 0.5
      : inf.audienceGenderGuess === brand.targetGender || inf.audienceGenderGuess === "mixed"
        ? 1
        : 0;

  const photoScore = (inf.photoQuality ?? 0) / 5; // 0-1
  const notJadedScore = 1 - Math.min(inf.prFrequency ?? 0, 1); // 0-1

  return genreScore * 40 + ageScore * 25 + genderScore * 15 + photoScore * 12 + notJadedScore * 8;
}

export function hasAnySignal(inf: Influencer): boolean {
  return Boolean(inf.genreTags || inf.audienceAgeGuess || inf.audienceGenderGuess);
}
