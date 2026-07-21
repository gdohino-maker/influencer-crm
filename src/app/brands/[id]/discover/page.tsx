import { prisma } from "@/lib/db";
import { Card, PageTitle, Badge, EmptyState, SectionTitle, Select, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CopyButton } from "@/components/copy-button";
import { searchChannelsCached, type YoutubeChannelCandidate } from "@/lib/youtube";
import { recommendScore } from "@/lib/recommend";
import { generateRecommendReasons } from "@/lib/recommend-reason";
import { buildTikTokResearchPrompt } from "@/lib/tiktok-research-prompt";
import {
  ArrowLeft,
  Sparkles,
  SquarePlay,
  Users2,
  Clock,
  UserPlus,
  CheckCircle2,
  PartyPopper,
  ExternalLink,
  Check,
  Bot,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addYoutubeCandidate, decideRecommended, addQuickInfluencer, importTikTokResearch } from "./actions";
import { generateDiscoveryKeywords } from "../../actions";

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-gradient-to-br from-fuchsia-500 to-amber-400",
  youtube: "bg-red-600",
  x: "bg-slate-900",
  tiktok: "bg-slate-900",
};

const PLATFORM_VIEW_LABELS: Record<string, string> = {
  instagram: "Instagramで見る",
  youtube: "YouTubeで見る",
  x: "Xで見る",
  tiktok: "TikTokで見る",
};

export default async function DiscoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    campaignId?: string;
    yt?: string;
    quickAdded?: string;
    quickError?: string;
    new?: string;
    tiktokImported?: string;
    tiktokSkipped?: string;
    tiktokAddedToCampaign?: string;
  }>;
}) {
  const { id } = await params;
  const brandId = Number(id);
  const sp = await searchParams;
  const selectedCampaignId = sp.campaignId ? Number(sp.campaignId) : undefined;
  const ytKeyword = sp.yt?.trim();
  const isNew = sp.new === "1";

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { client: true, campaigns: { orderBy: { createdAt: "desc" } } },
  });
  if (!brand) notFound();

  const keywords = (brand.discoveryKeywords ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  // --- マスタ推薦(APIキー不要・即動作) ---
  const allInfluencers = await prisma.influencer.findMany({ where: { isBlacklisted: false } });
  const existingMemberIds = selectedCampaignId
    ? new Set(
        (
          await prisma.campaignInfluencer.findMany({
            where: { campaignId: selectedCampaignId },
            select: { influencerId: true },
          })
        ).map((m) => m.influencerId)
      )
    : new Set<number>();

  const recommended = allInfluencers
    .map((inf) => ({ inf, score: recommendScore(inf, brand) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  let reasons = new Map<number, string>();
  if (recommended.length > 0) {
    try {
      reasons = await generateRecommendReasons(
        recommended.slice(0, 8).map((r) => r.inf),
        brand
      );
    } catch {
      // AI理由生成に失敗しても候補一覧の表示は継続する
    }
  }

  // --- YouTube自動検索(要APIキー) ---
  let ytResults: YoutubeChannelCandidate[] = [];
  let ytFromCache = false;
  let ytError: string | null = null;
  if (ytKeyword) {
    try {
      const r = await searchChannelsCached(ytKeyword);
      ytResults = r.results;
      ytFromCache = r.fromCache;
    } catch (e) {
      ytError = (e as Error).message;
    }
  }

  const generateKeywordsWithId = generateDiscoveryKeywords.bind(null, brandId);
  const addQuickWithBrandId = addQuickInfluencer.bind(null, brandId);
  const importTikTokWithBrandId = importTikTokResearch.bind(null, brandId);
  const tiktokPrompt = buildTikTokResearchPrompt(brand);

  return (
    <div>
      <PageTitle
        title="候補を探す"
        subtitle={`${brand.client.name} / ${brand.name}`}
        action={
          <Link
            href={`/brands/${brandId}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-4" /> {brand.name}
          </Link>
        }
      />

      {isNew && (
        <div className="mb-6 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 text-indigo-900 text-sm px-4 py-3 flex items-center gap-2">
          <PartyPopper className="size-4 shrink-0 text-indigo-500" />
          「{brand.name}」を登録しました。AIが整理した条件(
          {brand.targetAgeBands} / {brand.targetGender === "all" ? "全性別" : brand.targetGender} /{" "}
          {brand.targetGenres})をもとに、下に候補を並べています。
        </div>
      )}

      {sp.quickAdded && (
        <div className="mb-6 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          @{sp.quickAdded} をマスタに登録しました{selectedCampaignId ? "(候補にも追加しました)" : ""}。ジャンルや年齢層はまだ空なので、
          <Link href="/influencers" className="underline">
            マスタ一覧
          </Link>
          から開いて「AIでジャンル/属性を推定」しておくとマスタ推薦の精度が上がります。
        </div>
      )}
      {sp.quickError && (
        <div className="mb-6 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
          URLを認識できませんでした。Instagram/X(Twitter)/TikTokのプロフィールURL(例: https://www.instagram.com/username)を貼り付けてください。
        </div>
      )}
      {sp.tiktokImported != null && (
        <div className="mb-6 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          TikTokリサーチ結果を取り込みました: 新規登録 {sp.tiktokImported}件 / 既存スキップ {sp.tiktokSkipped}件
          {selectedCampaignId ? ` / 候補に追加 ${sp.tiktokAddedToCampaign}件` : ""}
        </div>
      )}

      <Card className="mb-6">
        <form method="get" className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              追加先キャンペーン(選択すると一覧から一発で候補追加できます)
            </label>
            <Select name="campaignId" defaultValue={selectedCampaignId ?? ""}>
              <option value="">選択しない(マスタ登録のみ)</option>
              {brand.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <button className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">
            切り替え
          </button>
        </form>
        {brand.campaigns.length === 0 && (
          <p className="text-xs text-amber-600 mt-2">
            まだ施策がありません。<Link href={`/brands/${brandId}`} className="underline">ブランド詳細</Link>
            から施策を作成すると、ここから直接候補を追加できます。
          </p>
        )}
      </Card>

      {/* マスタ推薦(メイン結果) */}
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <Users2 className="size-4 text-slate-400" /> おすすめの候補
        </span>
      </SectionTitle>
      <p className="text-xs text-slate-500 mb-3">
        全社のインフルエンサーマスタから、このブランドのターゲット年齢層・性別・ジャンルに近い人を自動で並べています。上位{Math.min(
          8,
          recommended.length
        )}
        件はAIが選定理由も生成しています。
      </p>
      {recommended.length === 0 && (
        <EmptyState>
          一致する候補がまだありません。マスタにジャンルタグ等の属性が入っている人が少ないか、条件に合う人がいません。
          <br />
          <Link href="/influencers" className="underline">
            インフルエンサーマスタ
          </Link>
          で属性を登録するか、下のYouTube自動検索で新規発掘してください。
        </EmptyState>
      )}
      <div className="grid grid-cols-2 gap-3 mb-10">
        {recommended.map(({ inf, score }) => {
          const alreadyAdded = selectedCampaignId ? existingMemberIds.has(inf.id) : false;
          const decideWithBrandId = decideRecommended.bind(null, brandId);
          const reason = reasons.get(inf.id);
          const initial = (inf.displayName ?? inf.username).slice(0, 1).toUpperCase();
          return (
            <Card key={inf.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`size-11 rounded-full shrink-0 flex items-center justify-center text-white font-semibold ${
                    PLATFORM_COLORS[inf.platform] ?? "bg-slate-400"
                  }`}
                >
                  {initial}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate">@{inf.username}</span>
                    <Badge color="neutral">{inf.platform}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {inf.followers ? `フォロワー ${inf.followers.toLocaleString()}` : "フォロワー数不明"} ・ 一致度 {score.toFixed(0)}
                  </p>
                </div>
              </div>

              {reason ? (
                <p className="text-sm text-indigo-900 bg-indigo-50 rounded-lg px-3 py-2 flex items-start gap-1.5">
                  <Sparkles className="size-3.5 shrink-0 mt-0.5 text-indigo-500" />
                  {reason}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  {inf.genreTags ?? "ジャンル未設定"} ・ フォロワー推定層: {inf.audienceAgeGuess ?? "-"} / {inf.audienceGenderGuess ?? "-"}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                <a
                  href={inf.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600"
                >
                  <ExternalLink className="size-3.5" />
                  {PLATFORM_VIEW_LABELS[inf.platform] ?? "プロフィールを見る"}
                </a>

                {alreadyAdded ? (
                  <Link
                    href={`/campaigns/${selectedCampaignId}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md"
                  >
                    <Check className="size-3.5" /> 決定済み
                  </Link>
                ) : selectedCampaignId ? (
                  <form action={decideWithBrandId}>
                    <input type="hidden" name="influencerId" value={inf.id} />
                    <input type="hidden" name="campaignId" value={selectedCampaignId} />
                    <SubmitButton size="sm" pendingText="処理中...">
                      決定する
                    </SubmitButton>
                  </form>
                ) : (
                  <span className="text-xs text-slate-400">キャンペーン未選択</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* YouTube自動検索 */}
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <SquarePlay className="size-4 text-slate-400" /> YouTube自動検索(要APIキー)
        </span>
      </SectionTitle>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-500">
            探索キーワード(ブランド情報からGeminiが自動生成)。キーワードをクリックするとYouTubeチャンネルを検索します。
          </p>
          <form action={generateKeywordsWithId}>
            <SubmitButton variant="ai" size="sm" pendingText="生成中...">
              <Sparkles className="size-3" /> キーワード再生成
            </SubmitButton>
          </form>
        </div>
        {keywords.length === 0 ? (
          <p className="text-sm text-slate-400">まだ探索キーワードがありません。上のボタンで生成してください。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <Link
                key={kw}
                href={`/brands/${brandId}/discover?${selectedCampaignId ? `campaignId=${selectedCampaignId}&` : ""}yt=${encodeURIComponent(kw)}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  kw === ytKeyword
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
                }`}
              >
                {kw}
              </Link>
            ))}
          </div>
        )}
      </Card>

      {ytError && (
        <div className="mb-6 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
          {ytError}
          {ytError.includes("YOUTUBE_API_KEY") && (
            <p className="mt-2 text-xs">
              取得方法: Google Cloud Console でプロジェクトを作成 →「YouTube Data API v3」を有効化 → 認証情報でAPIキーを発行 →{" "}
              <code className="bg-amber-100 px-1">.env.local</code> の <code className="bg-amber-100 px-1">YOUTUBE_API_KEY</code>{" "}
              に設定(Vercelの場合は環境変数にも追加)してください。無料枠は1日1万ユニットです。
            </p>
          )}
        </div>
      )}

      {ytKeyword && !ytError && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-medium text-slate-700">「{ytKeyword}」の検索結果 ({ytResults.length}件)</h3>
            {ytFromCache && (
              <Badge color="yellow">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" /> 24hキャッシュ
                </span>
              </Badge>
            )}
          </div>
          {ytResults.length === 0 && <EmptyState>該当するチャンネルが見つかりませんでした。</EmptyState>}
          <div className="space-y-2 mb-6">
            {ytResults.map((ch) => {
              const addWithBrandId = addYoutubeCandidate.bind(null, brandId);
              return (
                <Card key={ch.channelId} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {ch.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ch.thumbnailUrl} alt="" className="size-10 rounded-full" />
                    )}
                    <div>
                      <a
                        href={`https://www.youtube.com/channel/${ch.channelId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {ch.title}
                      </a>
                      <p className="text-xs text-slate-500 mt-0.5">
                        登録者数 {ch.subscriberCount?.toLocaleString() ?? "非公開"} ・ 動画数 {ch.videoCount ?? "-"}
                      </p>
                    </div>
                  </div>
                  <form action={addWithBrandId}>
                    <input type="hidden" name="channelId" value={ch.channelId} />
                    <input type="hidden" name="title" value={ch.title} />
                    <input type="hidden" name="customUrl" value={ch.customUrl ?? ""} />
                    <input type="hidden" name="subscriberCount" value={ch.subscriberCount ?? ""} />
                    <input type="hidden" name="videoCount" value={ch.videoCount ?? ""} />
                    <input type="hidden" name="description" value={ch.description.slice(0, 500)} />
                    {selectedCampaignId && <input type="hidden" name="campaignId" value={selectedCampaignId} />}
                    <SubmitButton variant="secondary" size="sm">
                      {selectedCampaignId ? "マスタ登録+候補追加" : "マスタに登録"}
                    </SubmitButton>
                  </form>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* TikTok探索(Claude for Chrome等でリサーチ) */}
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <Bot className="size-4 text-slate-400" /> TikTok探索(Claude for Chromeでリサーチ)
        </span>
      </SectionTitle>
      <p className="text-xs text-slate-500 mb-3">
        TikTokには自動検索APIが無いため、ブラウザ操作エージェント(Claude for Chrome等)にブラウザ上のTikTokを巡回してもらい、候補をCSVで受け取ります。下のプロンプトをコピーしてTikTokを開いたブラウザのClaudeに実行させ、出てきたCSVを下の欄に貼り戻してください。
      </p>
      <div className="grid grid-cols-2 gap-4 mb-10">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500">Claude for Chrome用プロンプト(ブランド条件から自動生成)</p>
            <CopyButton text={tiktokPrompt} label="プロンプトをコピー" />
          </div>
          <Textarea readOnly rows={16} defaultValue={tiktokPrompt} className="bg-slate-50 text-xs font-mono" />
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500 mb-2">結果CSVを貼り戻す</p>
          <form action={importTikTokWithBrandId} className="flex flex-col gap-3 h-full">
            <Textarea
              name="csv"
              required
              rows={16}
              className="text-xs font-mono flex-1"
              placeholder={
                "username,url,displayName,followers,totalLikes,postsCount,avgView,avgLike,avgEngagement,avgComment,videoAvgScore,postFreqWeek,lastPublished,contact,notes\nkurashi_no_hibi,https://tiktok.com/@kurashi_no_hibi,みどりの暮らし,84000,1200000,320,120000,4100,4600,180,7.5,4,2026-07-10,mail@example.com,暮らし系で世界観が良い"
              }
            />
            {selectedCampaignId && <input type="hidden" name="campaignId" value={selectedCampaignId} />}
            <SubmitButton pendingText="取り込み中...">
              {selectedCampaignId ? "マスタ登録+候補に追加" : "マスタに一括登録"}
            </SubmitButton>
          </form>
        </Card>
      </div>

      {/* 手動発掘クイック追加 */}
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <UserPlus className="size-4 text-slate-400" /> 手動で追加(Instagram/X/TikTok)
        </span>
      </SectionTitle>
      <p className="text-xs text-slate-500 mb-3">
        Instagram/X/TikTokは公式の検索APIが無いため自動発掘できません。ブラウザで見つけた気になる人のプロフィールURLをここに貼るだけで、すぐマスタに登録できます。
      </p>
      <Card>
        <form action={addQuickWithBrandId} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              プロフィールURL(Instagram / X / TikTok)
            </label>
            <Input name="url" required placeholder="https://www.instagram.com/username" />
          </div>
          {selectedCampaignId && <input type="hidden" name="campaignId" value={selectedCampaignId} />}
          <SubmitButton pendingText="登録中...">
            {selectedCampaignId ? "マスタ登録+候補追加" : "マスタに登録"}
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
