import type { Brand } from "@prisma/client";

// ブランドのターゲット条件から、Claude for Chrome(ブラウザ操作エージェント)にTikTokを
// 巡回させてインフルエンサー候補を発掘させるためのプロンプトを生成する。
// スクレイピングではなく、一般ユーザーとしてブラウザ上のTikTokを閲覧させる想定。
export function buildTikTokResearchPrompt(brand: Pick<Brand, "name" | "category" | "description" | "targetAgeBands" | "targetGender" | "targetGenres" | "searchKeyword">): string {
  const genderLabel = brand.targetGender === "all" ? "指定なし" : brand.targetGender === "male" ? "男性" : "女性";

  return `あなたはTikTokをブラウザで閲覧できる一般ユーザーです。以下の商品に合いそうなインフルエンサー候補を、TikTok上を実際に巡回して探してください(スクレイピングや自動化ツールは使わず、人間が閲覧するのと同じ操作で構いません)。

【商品情報】
商品名: ${brand.name}
カテゴリ: ${brand.category}
商品説明: ${brand.description ?? "(なし)"}

【ターゲット条件】
年齢層: ${brand.targetAgeBands}
性別: ${genderLabel}
ジャンル: ${brand.targetGenres}

【探索手順】
1. TikTok内の検索やハッシュタグ、おすすめ欄から、上記ジャンル・年齢層に合いそうなアカウントを探す
2. 明らかに合わない(ジャンル不一致・フォロワーがbot臭い・炎上アカウント等)は除外する
3. 見つけた各アカウントのプロフィールと直近の投稿(15件程度)を開き、以下の数値を確認する
   - フォロワー数、総いいね数、投稿数
   - 直近投稿の平均再生回数・平均いいね数・平均コメント数
   - 動画の雰囲気/世界観を10点満点で自己評価(videoAvgScore)
   - 週あたりの投稿頻度(postFreqWeek)
   - 最終投稿日
   - プロフィール記載の問い合わせ先(メールやリンク、なければ空欄)
4. 見つけた理由(なぜこの人が合うと思ったか)を一言メモする
5. 15〜20名を目安に挙げる

【出力形式】※これ以外の説明文は不要。次のCSV(1行目のヘッダーを含む)を1つのコードブロックにまとめて出力してください。

username,url,displayName,followers,totalLikes,postsCount,avgView,avgLike,avgEngagement,avgComment,videoAvgScore,postFreqWeek,lastPublished,contact,notes
(例) kurashi_no_hibi,https://tiktok.com/@kurashi_no_hibi,みどりの暮らし,84000,1200000,320,120000,4100,4600,180,7.5,4,2026-07-10,mail@example.com,暮らし系で世界観が良い

・username は @ を除いたアカウント名、url は https://tiktok.com/@... の形
・数値の列(followers〜postFreqWeek)は数字のみ。不明は空欄でよい
・videoAvgScore は10点満点、postFreqWeek は1週間あたりの本数
・lastPublished は最新動画の公開日(YYYY-MM-DD など)
・contact はプロフィール記載のメールやお問い合わせURL(なければ空欄)
・notes は選んだ理由を短く。※カンマ「,」は使わず読点「、」で区切ること`;
}
