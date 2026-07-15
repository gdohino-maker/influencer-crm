export function normalize(text: string): string {
  return text.normalize("NFKC");
}

export function parseWordList(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

// captionに含まれるNGワードを検出する。ヒットしたワードをカンマ区切りで返す(なければnull)。
export function checkNgWords(caption: string | null | undefined, ngWordsCsv: string | null | undefined): string | null {
  if (!caption) return null;
  const words = parseWordList(ngWordsCsv);
  if (words.length === 0) return null;

  const normalizedCaption = normalize(caption);
  const hits = words.filter((w) => normalizedCaption.includes(normalize(w)));
  return hits.length > 0 ? hits.join(",") : null;
}
