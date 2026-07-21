import { prisma } from "@/lib/db";
import { Card, PageTitle, LinkButton, Input, Textarea, Field, Select, Badge, EmptyState, SectionTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Sparkles, ArrowLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateBrand, updateDiscoveryKeywords, generateDiscoveryKeywords, importBrandSearchMetrics } from "../actions";
import { createCampaign } from "../../campaigns/actions";

const CATEGORY_OPTIONS = [
  { value: "food", label: "食品" },
  { value: "cosmetics", label: "化粧品" },
  { value: "supplement", label: "サプリメント" },
  { value: "appliance", label: "家電" },
  { value: "apparel", label: "アパレル" },
  { value: "other", label: "その他" },
];

const GOAL_OPTIONS = [
  { value: "ugc_volume", label: "UGC量産" },
  { value: "asset_acquisition", label: "二次利用素材獲得" },
  { value: "branded_search", label: "指名検索創出" },
  { value: "launch", label: "ローンチ/認知拡大" },
];

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  planning: "計画中",
  running: "実施中",
  closed: "終了",
};

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brandId = Number(id);
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      client: true,
      campaigns: {
        include: { members: { include: { posts: true, influencer: true } } },
        orderBy: { createdAt: "desc" },
      },
      complianceProfile: true,
      scoringProfile: true,
      searchMetrics: { orderBy: { reportDate: "asc" } },
    },
  });
  if (!brand) notFound();

  const importMetricsWithId = importBrandSearchMetrics.bind(null, brandId);

  const postEvents = brand.campaigns
    .flatMap((c) => c.members)
    .flatMap((m) => m.posts.map((p) => ({ date: p.postedAt, label: `@${m.influencer.username} 投稿`, type: "post" as const })))
    .filter((e): e is { date: Date; label: string; type: "post" } => e.date != null);

  const metricEvents = brand.searchMetrics.map((m) => ({
    date: m.reportDate,
    label: `指名検索${m.searchTerm ? `(${m.searchTerm})` : ""}: 順位/検索量 ${m.searchFrequencyRank ?? "-"}`,
    type: "metric" as const,
  }));

  const timeline = [...postEvents, ...metricEvents].sort((a, b) => a.date.getTime() - b.date.getTime());

  const [scoringProfiles, complianceProfiles] = await Promise.all([
    prisma.scoringProfile.findMany(),
    prisma.complianceProfile.findMany(),
  ]);

  const updateBrandWithId = updateBrand.bind(null, brandId);
  const createCampaignWithId = createCampaign.bind(null, brandId);
  const updateKeywordsWithId = updateDiscoveryKeywords.bind(null, brandId);
  const generateKeywordsWithId = generateDiscoveryKeywords.bind(null, brandId);
  const latestCampaignId = brand.campaigns[0]?.id;
  const discoverHref = latestCampaignId
    ? `/brands/${brandId}/discover?campaignId=${latestCampaignId}`
    : `/brands/${brandId}/discover`;

  return (
    <div>
      <PageTitle
        title={brand.name}
        subtitle={`${brand.client.name} のブランド`}
        action={
          <div className="flex items-center gap-4">
            <Link
              href={`/clients/${brand.clientId}`}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="size-4" /> {brand.client.name}
            </Link>
            <LinkButton href={discoverHref}>
              <span className="inline-flex items-center gap-1.5">
                <Search className="size-4" /> 候補を探す
              </span>
            </LinkButton>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <SectionTitle>施策(キャンペーン)一覧</SectionTitle>
          {brand.campaigns.length === 0 && (
            <EmptyState>まだ施策がありません。右のフォームから追加してください。</EmptyState>
          )}
          <div className="space-y-3">
            {brand.campaigns.map((c) => (
              <Card key={c.id} className="hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <Link href={`/campaigns/${c.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                      {c.name}
                    </Link>
                    <p className="text-xs text-slate-500 mt-1">
                      {GOAL_OPTIONS.find((g) => g.value === c.goal)?.label ?? c.goal} ・ 候補数: {c.members.length}
                      {c.targetCount ? ` / 目標 ${c.targetCount}名` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={c.status === "running" ? "blue" : c.status === "closed" ? "green" : "neutral"}>
                      {CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="inline-flex items-center text-sm text-slate-400 hover:text-indigo-600"
                    >
                      詳細 <ChevronRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-800">探索キーワード(YouTube検索用・Gemini自動生成)</h2>
              <form action={generateKeywordsWithId}>
                <SubmitButton variant="ai" pendingText="生成中...">
                  <Sparkles className="size-3.5" /> AIでキーワード生成
                </SubmitButton>
              </form>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              商品情報からGeminiが検索キーワード群を生成します。生成後は自由に編集・追加できます(カンマ区切り)。
            </p>
            <form action={updateKeywordsWithId} className="space-y-3">
              <Textarea name="discoveryKeywords" rows={3} defaultValue={brand.discoveryKeywords ?? ""} />
              <SubmitButton variant="secondary">保存</SubmitButton>
            </form>
          </Card>

          <Card className="mt-6">
            <h2 className="font-semibold mb-2 text-slate-800">指名検索×投稿タイムライン(Amazon Brand Analytics)</h2>
            <p className="text-xs text-slate-500 mb-3">
              Amazon Brand Analyticsの指名検索CSV(Search Query Performance等)をアップロードすると、投稿タイムラインと重畳して表示します。
            </p>
            <form action={importMetricsWithId} className="flex items-end gap-3 mb-4">
              <div className="flex-1">
                <Field label="CSVファイル">
                  <input
                    type="file"
                    name="csvFile"
                    accept=".csv,text/csv"
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
                  />
                </Field>
              </div>
              <SubmitButton variant="secondary">取り込む</SubmitButton>
            </form>
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400">まだデータがありません</p>
            ) : (
              <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                {timeline.map((e, i) => (
                  <li key={i} className="text-xs flex items-center gap-2">
                    <span className="text-slate-400 w-24 shrink-0">
                      {e.date.toLocaleDateString("ja-JP")}
                    </span>
                    <Badge color={e.type === "post" ? "blue" : "violet"}>{e.type === "post" ? "投稿" : "指名検索"}</Badge>
                    <span className="text-slate-600">{e.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mt-6">
            <h2 className="font-semibold mb-4 text-slate-800">ブランド情報編集</h2>
            <p className="text-xs text-slate-500 mb-4">
              現在の設定: {brand.complianceProfile.name} / {brand.scoringProfile.name}
            </p>
            <form action={updateBrandWithId} className="space-y-4">
              <Field label="ブランド/商品名 *">
                <Input name="name" required defaultValue={brand.name} />
              </Field>
              <Field label="カテゴリ *">
                <Select name="category" required defaultValue={brand.category}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="商品説明">
                <Textarea name="description" rows={3} defaultValue={brand.description ?? ""} />
              </Field>
              <Field label="ASIN">
                <Input name="asin" defaultValue={brand.asin ?? ""} />
              </Field>
              <Field label="商品URL">
                <Input name="productUrl" type="url" defaultValue={brand.productUrl ?? ""} />
              </Field>
              <Field label="価格(円)">
                <Input name="priceYen" type="number" defaultValue={brand.priceYen ?? ""} />
              </Field>
              <Field label="ターゲット年齢層 * (カンマ区切り)">
                <Input name="targetAgeBands" required defaultValue={brand.targetAgeBands} />
              </Field>
              <Field label="ターゲット性別 *">
                <Select name="targetGender" defaultValue={brand.targetGender}>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="all">全て</option>
                </Select>
              </Field>
              <Field label="ターゲットジャンル * (カンマ区切り)">
                <Input name="targetGenres" required defaultValue={brand.targetGenres} />
              </Field>
              <Field label="誘導キーワード *">
                <Input name="searchKeyword" required defaultValue={brand.searchKeyword} />
              </Field>
              <Field label="コンプライアンスプロファイル *">
                <Select name="complianceProfileId" required defaultValue={brand.complianceProfileId}>
                  {complianceProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="スコアリングプロファイル *">
                <Select name="scoringProfileId" required defaultValue={brand.scoringProfileId}>
                  {scoringProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <SubmitButton>更新する</SubmitButton>
            </form>
          </Card>
        </div>

        <Card className="h-fit sticky top-8">
          <h2 className="font-semibold mb-4 text-slate-800">新規施策追加</h2>
          <form action={createCampaignWithId} className="space-y-4">
            <Field label="施策名 *">
              <Input name="name" required />
            </Field>
            <Field label="目的 *">
              <Select name="goal" required defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
                {GOAL_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="目標人数">
              <Input name="targetCount" type="number" />
            </Field>
            <Field label="予算(円)">
              <Input name="budgetYen" type="number" />
            </Field>
            <Field label="開始日">
              <Input name="startsAt" type="date" />
            </Field>
            <Field label="終了日">
              <Input name="endsAt" type="date" />
            </Field>
            <SubmitButton className="w-full">施策を作成</SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
