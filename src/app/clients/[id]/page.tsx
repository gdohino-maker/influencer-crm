import { prisma } from "@/lib/db";
import { Card, PageTitle, Input, Textarea, Field, Select, EmptyState, SectionTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft, ChevronRight, Package } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateClient } from "../actions";
import { createBrand } from "../../brands/actions";

const CATEGORY_OPTIONS = [
  { value: "food", label: "食品" },
  { value: "cosmetics", label: "化粧品" },
  { value: "supplement", label: "サプリメント" },
  { value: "appliance", label: "家電" },
  { value: "apparel", label: "アパレル" },
  { value: "other", label: "その他" },
];

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { brands: { include: { campaigns: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!client) notFound();

  const [scoringProfiles, complianceProfiles] = await Promise.all([
    prisma.scoringProfile.findMany(),
    prisma.complianceProfile.findMany(),
  ]);

  const updateClientWithId = updateClient.bind(null, clientId);
  const createBrandWithId = createBrand.bind(null, clientId);

  return (
    <div>
      <PageTitle
        title={client.name}
        subtitle="クライアント詳細・ブランド管理"
        action={
          <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" /> クライアント一覧
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-3">
          <SectionTitle>ブランド一覧</SectionTitle>
          {client.brands.length === 0 && (
            <EmptyState>まだブランドがありません。右のフォームから追加してください。</EmptyState>
          )}
          <div className="space-y-3">
            {client.brands.map((b) => (
              <Card key={b.id} className="hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Package className="size-4.5" />
                    </div>
                    <div>
                      <Link href={`/brands/${b.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                        {b.name}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {CATEGORY_OPTIONS.find((c) => c.value === b.category)?.label ?? b.category} ・ 施策数:{" "}
                        {b.campaigns.length}
                      </p>
                    </div>
                  </div>
                  <Link href={`/brands/${b.id}`} className="inline-flex items-center text-sm text-slate-400 hover:text-indigo-600">
                    詳細 <ChevronRight className="size-4" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <h2 className="font-semibold mb-4 text-slate-800">クライアント情報編集</h2>
            <form action={updateClientWithId} className="space-y-4">
              <Field label="クライアント企業名 *">
                <Input name="name" required defaultValue={client.name} />
              </Field>
              <Field label="メモ">
                <Textarea name="notes" rows={3} defaultValue={client.notes ?? ""} />
              </Field>
              <SubmitButton>更新する</SubmitButton>
            </form>
          </Card>
        </div>

        <Card className="h-fit sticky top-8">
          <h2 className="font-semibold mb-4 text-slate-800">新規ブランド追加</h2>
          <form action={createBrandWithId} className="space-y-4">
            <Field label="ブランド/商品名 *">
              <Input name="name" required />
            </Field>
            <Field label="カテゴリ *">
              <Select name="category" required defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="商品説明">
              <Textarea name="description" rows={3} placeholder="商品の特徴・訴求ポイント" />
            </Field>
            <Field label="ASIN">
              <Input name="asin" />
            </Field>
            <Field label="商品URL">
              <Input name="productUrl" type="url" />
            </Field>
            <Field label="価格(円)">
              <Input name="priceYen" type="number" />
            </Field>
            <Field label="ターゲット年齢層 * (カンマ区切り例: 40s,50s,60s+)">
              <Input name="targetAgeBands" required placeholder="40s,50s,60s+" />
            </Field>
            <Field label="ターゲット性別 *">
              <Select name="targetGender" defaultValue="all">
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="all">全て</option>
              </Select>
            </Field>
            <Field label="ターゲットジャンル * (カンマ区切り)">
              <Input name="targetGenres" required placeholder="暮らし,健康,食,家" />
            </Field>
            <Field label="誘導キーワード * (Amazon検索用)">
              <Input name="searchKeyword" required placeholder="商品名など" />
            </Field>
            <Field label="コンプライアンスプロファイル *">
              <Select name="complianceProfileId" required defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
                {complianceProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="スコアリングプロファイル *">
              <Select name="scoringProfileId" required defaultValue="">
                <option value="" disabled>
                  選択してください
                </option>
                {scoringProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton className="w-full">ブランドを追加</SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
