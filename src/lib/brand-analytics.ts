// Amazon Brand Analytics の指名検索CSV(Search Query Performance等)を取り込むための緩いパーサー。
// エクスポート元によって列名の表記ゆれがあるため、代表的な別名にマッチさせる。
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

const DATE_HEADER_ALIASES = ["reporting date", "date", "week ending date", "week", "reporting range"];
const RANK_HEADER_ALIASES = ["search frequency rank", "weekly search volume", "volume", "rank"];
const TERM_HEADER_ALIASES = ["search term", "searched term", "query", "keyword"];

export interface ParsedSearchMetricRow {
  reportDate: Date;
  searchTerm: string | null;
  searchFrequencyRank: number | null;
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.includes(h.trim().toLowerCase().normalize("NFKC")));
}

export function parseBrandAnalyticsCsv(raw: string): ParsedSearchMetricRow[] {
  const text = stripBom(raw);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const dateIdx = findColumnIndex(headers, DATE_HEADER_ALIASES);
  const rankIdx = findColumnIndex(headers, RANK_HEADER_ALIASES);
  const termIdx = findColumnIndex(headers, TERM_HEADER_ALIASES);

  if (dateIdx === -1) {
    throw new Error(
      "日付列が見つかりません。'Reporting Date' または 'Date' などの列名を含むCSVを使用してください。"
    );
  }

  const rows: ParsedSearchMetricRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim());
    const dateRaw = cols[dateIdx];
    if (!dateRaw) continue;
    const reportDate = new Date(dateRaw);
    if (Number.isNaN(reportDate.getTime())) continue;

    const rankRaw = rankIdx !== -1 ? cols[rankIdx] : undefined;
    const searchFrequencyRank = rankRaw ? Number(rankRaw.replace(/[,%]/g, "")) : null;
    const searchTerm = termIdx !== -1 ? cols[termIdx]?.normalize("NFKC") || null : null;

    rows.push({
      reportDate,
      searchTerm,
      searchFrequencyRank: Number.isFinite(searchFrequencyRank) ? searchFrequencyRank : null,
    });
  }
  return rows;
}
