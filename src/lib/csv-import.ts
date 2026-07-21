export type ParsedInfluencerRow = {
  username: string;
  url: string;
  displayName: string | null;
  followers: number | null;
  engagementRate: number | null;
  genreTags: string | null;
  totalLikes: number | null;
  postsCount: number | null;
  avgView: number | null;
  avgLike: number | null;
  avgEngagement: number | null;
  avgComment: number | null;
  videoAvgScore: number | null;
  postFreqWeek: number | null;
  lastPublishedAt: Date | null;
  contact: string | null;
  notes: string | null;
};

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

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function normalizeNfkc(text: string): string {
  return text.normalize("NFKC");
}

export function parseCsvLine(line: string): string[] {
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

// プラットフォームを問わず、簡易形式(username,url,displayName,followers,ER,ジャンル)と
// リッチ形式(Claude for Chrome等のリサーチCSV)の両方をパースする
export function parseInfluencerCsvRows(platform: string, raw: string): ParsedInfluencerRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => normalizeNfkc(l.trim()))
    .filter(Boolean);

  const firstCols = lines.length > 0 ? parseCsvLine(lines[0]).map((c) => c.toLowerCase()) : [];
  const isRichHeader = RICH_CSV_HEADERS.every((h) => firstCols.includes(h));
  const dataLines = isRichHeader || /^username\s*,/i.test(lines[0] ?? "") ? lines.slice(1) : lines;

  const rows: ParsedInfluencerRow[] = [];

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

    const avgLikeNum = avgLikeStr ? Number(avgLikeStr) : null;
    const avgViewNum = avgViewStr ? Number(avgViewStr) : null;
    const avgCommentNum = avgCommentStr ? Number(avgCommentStr) : null;
    const followersNum = followersStr ? Number(followersStr) : null;
    const computedEr =
      avgLikeNum != null && avgCommentNum != null && followersNum
        ? ((avgLikeNum + avgCommentNum) / followersNum) * 100
        : null;

    rows.push({
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
    });
  }

  return rows;
}
