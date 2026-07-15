import { prisma } from "@/lib/db";
import { Card, PageTitle, LinkButton, Input, Textarea, Field, Select, Badge, EmptyState, SectionTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Sparkles, ArrowLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateBrand, updateDiscoveryKeywords, generateDiscoveryKeywords } from "../actions";
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
      campaigns: { include: { members: true }, orderBy: { createdAt: "desc" } },
      complianceProfile: true,
      scoringProfile: true,
    },
  });
  if (!brand) notFound();

  const [scoringProfiles, complianceProfiles] = await Promise.all([
    prisma.scoringProfile.findMany(),
    prisma.complianceProfile.findMany(),
  ]);

  const updateBrandWithId = updateBrand.bind(null, brandId);
  const createCampaignWithId = createCampaign.bind(null, brandId);
  const updateKeywordsWithId = updateDiscoveryKeywords.bind(null, brandId);
  const generateKeywordsWithId = generateDiscoveryKeywords.bind(null, brandId);

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
            <LinkButton href={`/brands/${brandId}/discover`}>
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
