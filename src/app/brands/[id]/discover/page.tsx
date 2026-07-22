import { prisma } from "@/lib/db";
import { Card, PageTitle, Badge, EmptyState, SectionTitle, Select, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CopyButton } from "@/components/copy-button";
import { CsvDropzone } from "@/components/csv-dropzone";
import { searchChannelsCached, type YoutubeChannelCandidate } from "@/lib/youtube";
import { recommendScore } from "@/lib/recommend";
import { generateUnifiedReasons, type ReasonCandidate } from "@/lib/recommend-reason";
import { buildSnsResearchPrompt, type ResearchPlatform } from "@/lib/tiktok-research-prompt";
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
import { addYoutubeCandidate, decideRecommended, addQuickInfluencer, importSnsResearch } from "./actions";
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

const MAX_UNIFIED_CANDIDATES = 20;
const MAX_REASONED = 12;

type UnifiedCandidate = {
  key: string;
  kind: "db" | "yt";
  username: string;
  displayName: string | null;
  platform: string;
  url: string;
  avatarUrl: string | null;
  followers: number | null;
  score: number;
  // db-only
  influencerId?: number;
  genreTags?: string | null;
  audienceAgeGuess?: string | null;
  audienceGenderGuess?: string | null;
  engagementRate?: number | null;
  bio?: string | null;
  notes?: string | null;
  // yt-only(未登録)
  channel?: YoutubeChannelCandidate;
};

export default async function DiscoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    campaignId?: string;
    yt?: string | string[];
    quickAdded?: string;
    quickError?: string;
    new?: string;
    snsImported?: string;
    snsSkipped?: string;
    snsAddedToCampaign?: string;
    researchPlatform?: string;
  }>;
}) {
  const { id } = await params;
  const brandId = Number(id);
  const sp = await searchParams;
  const selectedCampaignId = sp.campaignId ? Number(sp.campaignId) : undefined;
  const selectedYtKeywords = (Array.isArray(sp.yt) ? sp.yt : sp.yt ? [sp.yt] : []).map((k) => k.trim()).filter(Boolean);
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

  const knownYoutubeUsernames = new Set(
    allInfluencers.filter((i) => i.platform === "youtube").map((i) => i.username)
  );

  const dbCandidates: UnifiedCandidate[] = allInfluencers
    .map((inf) => ({ inf, score: recommendScore(inf, brand) }))
    .filter((r) => r.score > 0)
    .map(({ inf, score }) => ({
      key: `db:${inf.id}`,
      kind: "db" as const,
      username: inf.username,
      displayName: inf.displayName,
      platform: inf.platform,
      url: inf.url,
      avatarUrl: inf.avatarUrl,
      followers: inf.followers,
      score,
      influencerId: inf.id,
      genreTags: inf.genreTags,
      audienceAgeGuess: inf.audienceAgeGuess,
      audienceGenderGuess: inf.audienceGenderGuess,
      engagementRate: inf.engagementRate,
      bio: inf.bio,
      notes: inf.notes,
    }));

  // --- YouTube自動検索(要APIキー・複数キーワード選択可)。マスタ未登録の新規候補として合流させる ---
  let ytError: string | null = null;
  let ytFromCache = false;
  const ytCandidates: UnifiedCandidate[] = [];
  if (selectedYtKeywords.length > 0) {
    try {
      const seenChannelIds = new Set<string>();
      for (const kw of selectedYtKeywords) {
        const r = await searchChannelsCached(kw);
        if (r.fromCache) ytFromCache = true;
        for (const ch of r.results) {
          if (seenChannelIds.has(ch.channelId)) continue;
          seenChannelIds.add(ch.channelId);
          const username = ch.customUrl ? ch.customUrl.replace(/^@/, "") : ch.channelId;
          if (knownYoutubeUsernames.has(username)) continue; // 既にマスタにいる人はdb側の候補として既出

          const score = recommendScore(
            {
              isBlacklisted: false,
              genreTags: null,
              audienceAgeGuess: null,
              audienceGenderGuess: null,
              photoQuality: null,
              prFrequency: null,
              followers: ch.subscriberCount,
              postsCount: ch.videoCount,
            },
            brand,
            0.6 // キーワード自体がブランド条件から生成されているため、ジャンル一致に一定の確度を仮定する
          );

          ytCandidates.push({
            key: `yt:${ch.channelId}`,
            kind: "yt",
            username,
            displayName: ch.title,
            platform: "youtube",
            url: `https://www.youtube.com/channel/${ch.channelId}`,
            avatarUrl: ch.thumbnailUrl,
            followers: ch.subscriberCount,
            score,
            bio: ch.description ? ch.description.slice(0, 300) : null,
            channel: ch,
          });
        }
      }
    } catch (e) {
      ytError = (e as Error).message;
    }
  }

  const unified = [...dbCandidates, ...ytCandidates].sort((a, b) => b.score - a.score).slice(0, MAX_UNIFIED_CANDIDATES);

  let reasons = new Map<string, string>();
  if (unified.length > 0) {
    try {
      const reasonCandidates: ReasonCandidate[] = unified.slice(0, MAX_REASONED).map((c) => ({
        key: c.key,
        username: c.username,
        platform: c.platform,
        genreTags: c.genreTags,
        audienceAgeGuess: c.audienceAgeGuess,
        audienceGenderGuess: c.audienceGenderGuess,
        followers: c.followers,
        engagementRate: c.engagementRate,
        bio: c.bio,
        notes: c.notes,
      }));
      reasons = await generateUnifiedReasons(reasonCandidates, brand);
    } catch {
      // AI理由生成に失敗しても候補一覧の表示は継続する
    }
  }

  const generateKeywordsWithId = generateDiscoveryKeywords.bind(null, brandId);
  const addQuickWithBrandId = addQuickInfluencer.bind(null, brandId);
  const importSnsWithBrandId = importSnsResearch.bind(null, brandId);
  const researchPlatform: ResearchPlatform = sp.researchPlatform === "instagram" ? "instagram" : "tiktok";
  const researchPrompt = buildSnsResearchPrompt(brand, researchPlatform);
  const researchQsBase = `${selectedCampaignId ? `campaignId=${selectedCampaignId}&` : ""}`;

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
      {sp.snsImported != null && (
        <div className="mb-6 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          リサーチ結果を取り込みました: 新規登録 {sp.snsImported}件 / 既存スキップ {sp.snsSkipped}件
          {selectedCampaignId ? ` / 候補に追加 ${sp.snsAddedToCampaign}件` : ""}。取り込んだ人も下の「おすすめの候補」にすぐ反映されます。
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

      {/* YouTube検索キーワード(任意・複数選択可) */}
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <SquarePlay className="size-4 text-slate-400" /> YouTubeキーワードを追加で検索(要APIキー・任意)
        </span>
      </SectionTitle>
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-500">
            探索キーワード(ブランド情報からGeminiが自動生成)。複数選択して検索すると、下の「おすすめの候補」に新規発見分として合流します。
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
          <form method="get" className="space-y-3">
            {selectedCampaignId && <input type="hidden" name="campaignId" value={selectedCampaignId} />}
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <label key={kw} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="yt"
                    value={kw}
                    defaultChecked={selectedYtKeywords.includes(kw)}
                    className="peer hidden"
                  />
                  <span className="inline-block px-3 py-1.5 rounded-full text-xs font-medium border transition-colors bg-white border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 peer-checked:text-white">
                    {kw}
                  </span>
                </label>
              ))}
            </div>
            <button className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500">
              選択したキーワードで検索する(複数選択可)
            </button>
          </form>
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

      {/* おすすめの候補(マスタ推薦+YouTube新規発見を統合・スコア順) */}
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <Users2 className="size-4 text-slate-400" /> おすすめの候補(上位{Math.min(MAX_UNIFIED_CANDIDATES, unified.length)}件)
        </span>
      </SectionTitle>
      <p className="text-xs text-slate-500 mb-3">
        全社のインフルエンサーマスタからの推薦{selectedYtKeywords.length > 0 ? "と、上のYouTube検索で新たに見つかった人" : ""}
        を、一致度スコア順に1つのリストにまとめています。上位{Math.min(MAX_REASONED, unified.length)}件はAIが選定理由も生成しています。
        {ytFromCache && (
          <Badge color="yellow">
            <span className="inline-flex items-center gap-1 ml-1">
              <Clock className="size-3" /> 一部24hキャッシュ
            </span>
          </Badge>
        )}
      </p>
      {unified.length === 0 && (
        <EmptyState>
          一致する候補がまだありません。マスタにジャンルタグ等の属性が入っている人が少ないか、条件に合う人がいません。
          <br />
          <Link href="/influencers" className="underline">
            インフルエンサーマスタ
          </Link>
          で属性を登録するか、上のYouTubeキーワード検索で新規発掘してください。
        </EmptyState>
      )}
      <div className="grid grid-cols-2 gap-3 mb-10">
        {unified.map((c) => {
          const alreadyAdded = c.kind === "db" && selectedCampaignId ? existingMemberIds.has(c.influencerId!) : false;
          const decideWithBrandId = decideRecommended.bind(null, brandId);
          const addYtWithBrandId = addYoutubeCandidate.bind(null, brandId);
          const reason = reasons.get(c.key);
          const initial = (c.displayName ?? c.username).slice(0, 1).toUpperCase();

          return (
            <Card key={c.key} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt="" className="size-11 rounded-full shrink-0 object-cover" />
                ) : (
                  <div
                    className={`size-11 rounded-full shrink-0 flex items-center justify-center text-white font-semibold ${
                      PLATFORM_COLORS[c.platform] ?? "bg-slate-400"
                    }`}
                  >
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate">@{c.username}</span>
                    <Badge color="neutral">{c.platform}</Badge>
                    {c.kind === "yt" && <Badge color="blue">新規発見</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {c.followers ? `フォロワー ${c.followers.toLocaleString()}` : "フォロワー数不明"} ・ 一致度 {c.score.toFixed(0)}
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
                  {c.genreTags ?? "ジャンル未設定"} ・ フォロワー推定層: {c.audienceAgeGuess ?? "-"} / {c.audienceGenderGuess ?? "-"}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600"
                >
                  <ExternalLink className="size-3.5" />
                  {PLATFORM_VIEW_LABELS[c.platform] ?? "プロフィールを見る"}
                </a>

                {c.kind === "db" ? (
                  alreadyAdded ? (
                    <Link
                      href={`/campaigns/${selectedCampaignId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md"
                    >
                      <Check className="size-3.5" /> 決定済み
                    </Link>
                  ) : selectedCampaignId ? (
                    <form action={decideWithBrandId}>
                      <input type="hidden" name="influencerId" value={c.influencerId} />
                      <input type="hidden" name="campaignId" value={selectedCampaignId} />
                      <SubmitButton size="sm" pendingText="処理中...">
                        決定する
                      </SubmitButton>
                    </form>
                  ) : (
                    <span className="text-xs text-slate-400">キャンペーン未選択</span>
                  )
                ) : (
                  <form action={addYtWithBrandId}>
                    <input type="hidden" name="channelId" value={c.channel!.channelId} />
                    <input type="hidden" name="title" value={c.channel!.title} />
                    <input type="hidden" name="customUrl" value={c.channel!.customUrl ?? ""} />
                    <input type="hidden" name="subscriberCount" value={c.channel!.subscriberCount ?? ""} />
                    <input type="hidden" name="videoCount" value={c.channel!.videoCount ?? ""} />
                    <input type="hidden" name="description" value={c.channel!.description.slice(0, 500)} />
                    <input type="hidden" name="thumbnailUrl" value={c.channel!.thumbnailUrl ?? ""} />
                    {selectedCampaignId && <input type="hidden" name="campaignId" value={selectedCampaignId} />}
                    <SubmitButton size="sm" pendingText="処理中...">
                      {selectedCampaignId ? "決定する" : "マスタに登録"}
                    </SubmitButton>
                  </form>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* SNS探索(Claude for Chrome等でリサーチ) */}
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <Bot className="size-4 text-slate-400" /> TikTok/Instagram探索(Claude for Chromeでリサーチ)
        </span>
      </SectionTitle>
      <p className="text-xs text-slate-500 mb-3">
        TikTok/Instagramには自動検索APIが無いため、ブラウザ操作エージェント(Claude for Chrome等)にブラウザ上を巡回してもらい、候補をCSVで受け取ります(スクレイピングではなく、人間と同じ操作でブラウジングする想定です)。下のプロンプトをコピーして対象SNSを開いたブラウザのClaudeに実行させ、出てきたCSVを下の欄に貼り戻してください。取り込んだ人は上の「おすすめの候補」に次の表示から反映されます。
      </p>
      <div className="flex gap-2 mb-3">
        {(["tiktok", "instagram"] as ResearchPlatform[]).map((p) => (
          <Link
            key={p}
            href={`/brands/${brandId}/discover?${researchQsBase}researchPlatform=${p}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              p === researchPlatform
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            {p === "tiktok" ? "TikTok" : "Instagram"}
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-10">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500">Claude for Chrome用プロンプト(ブランド条件から自動生成)</p>
            <CopyButton text={researchPrompt} label="プロンプトをコピー" />
          </div>
          <Textarea readOnly rows={16} defaultValue={researchPrompt} className="bg-slate-50 text-xs font-mono" />
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500 mb-2">結果CSVを貼り戻す({researchPlatform === "tiktok" ? "TikTok" : "Instagram"})</p>
          <form action={importSnsWithBrandId} className="flex flex-col gap-3 h-full">
            <input type="hidden" name="platform" value={researchPlatform} />
            <CsvDropzone
              fileInputName="csvFile"
              textareaName="csv"
              rows={12}
              placeholder={
                "username,url,displayName,followers,totalLikes,postsCount,avgView,avgLike,avgEngagement,avgComment,videoAvgScore,postFreqWeek,lastPublished,contact,notes\nkurashi_no_hibi,https://example.com/@kurashi_no_hibi,みどりの暮らし,84000,1200000,320,120000,4100,4600,180,7.5,4,2026-07-10,mail@example.com,暮らし系で世界観が良い"
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
