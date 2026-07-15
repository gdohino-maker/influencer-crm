import { prisma } from "@/lib/db";
import { Card, PageTitle, Badge, EmptyState, SectionTitle, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { searchChannelsCached, type YoutubeChannelCandidate } from "@/lib/youtube";
import { recommendScore } from "@/lib/recommend";
import { ArrowLeft, Sparkles, SquarePlay, Users2, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addYoutubeCandidate, addRecommendedToCampaign } from "./actions";
import { generateDiscoveryKeywords } from "../../actions";

export default async function DiscoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ campaignId?: string; yt?: string }>;
}) {
  const { id } = await params;
  const brandId = Number(id);
  const sp = await searchParams;
  const selectedCampaignId = sp.campaignId ? Number(sp.campaignId) : undefined;
  const ytKeyword = sp.yt?.trim();

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

      {/* マスタ推薦 */}
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <Users2 className="size-4 text-slate-400" /> マスタから推薦(既存ストック・即時)
        </span>
      </SectionTitle>
      <p className="text-xs text-slate-500 mb-3">
        全社のインフルエンサーマスタから、このブランドのターゲット年齢層・性別・ジャンルに近い人を自動で並べています。APIキー不要です。
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
      <div className="space-y-2 mb-10">
        {recommended.map(({ inf, score }) => {
          const alreadyAdded = selectedCampaignId ? existingMemberIds.has(inf.id) : false;
          const addWithBrandId = addRecommendedToCampaign.bind(null, brandId);
          return (
            <Card key={inf.id} className="flex items-center justify-between py-3">
              <div>
                <Link href={`/influencers/${inf.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                  @{inf.username}
                </Link>
                <span className="text-xs text-slate-400 ml-2">{inf.platform}</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {inf.genreTags ?? "ジャンル未設定"} ・ フォロワー推定層: {inf.audienceAgeGuess ?? "-"} /{" "}
                  {inf.audienceGenderGuess ?? "-"} ・ 一致度スコア {score.toFixed(0)}
                </p>
              </div>
              {selectedCampaignId ? (
                alreadyAdded ? (
                  <Badge color="green">追加済み</Badge>
                ) : (
                  <form action={addWithBrandId}>
                    <input type="hidden" name="influencerId" value={inf.id} />
                    <input type="hidden" name="campaignId" value={selectedCampaignId} />
                    <SubmitButton variant="secondary" size="sm">
                      候補に追加
                    </SubmitButton>
                  </form>
                )
              ) : (
                <span className="text-xs text-slate-400">キャンペーン未選択</span>
              )}
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
    </div>
  );
}
