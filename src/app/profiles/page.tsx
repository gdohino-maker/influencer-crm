import { prisma } from "@/lib/db";
import { Card, PageTitle, Input, Textarea, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  createComplianceProfile,
  createScoringProfile,
  updateComplianceProfile,
  updateScoringProfile,
} from "./actions";

const WEIGHT_FIELDS: { key: string; label: string }[] = [
  { key: "wAudience", label: "ターゲット層への専門適合" },
  { key: "wGenre", label: "ジャンル適合" },
  { key: "wEr", label: "エンゲージメント率" },
  { key: "wPhoto", label: "写真/世界観の質(二次利用価値)" },
  { key: "wNotJaded", label: "案件慣れしていない度" },
  { key: "wActivity", label: "発信頻度" },
  { key: "wFollower", label: "フォロワー数(reach)" },
];

export default async function ProfilesPage() {
  const [scoringProfiles, complianceProfiles] = await Promise.all([
    prisma.scoringProfile.findMany({ orderBy: { id: "asc" } }),
    prisma.complianceProfile.findMany({ orderBy: { id: "asc" } }),
  ]);

  return (
    <div>
      <PageTitle
        title="プロファイル設定"
        subtitle="スコアリングとコンプライアンスのルールはブランドごとに使い分けます"
      />

      <section className="mb-10">
        <h2 className="font-semibold text-lg mb-3 text-slate-800">スコアリングプロファイル</h2>
        <p className="text-sm text-slate-500 mb-4">
          重みの合計は100を目安にしてください(厳密な制約はありません)。フォロワー数の重みはデフォルト0=リーチは主要条件にしない方針です。
        </p>
        <div className="grid grid-cols-2 gap-4">
          {scoringProfiles.map((sp) => {
            const updateWithId = updateScoringProfile.bind(null, sp.id);
            const total = WEIGHT_FIELDS.reduce((sum, f) => sum + (sp as unknown as Record<string, number>)[f.key], 0);
            return (
              <Card key={sp.id}>
                <form action={updateWithId} className="space-y-3">
                  <Field label="プロファイル名">
                    <Input name="name" defaultValue={sp.name} />
                  </Field>
                  {WEIGHT_FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center gap-3">
                      <label className="text-xs text-slate-600 w-56 shrink-0">{f.label}</label>
                      <Input
                        name={f.key}
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={(sp as unknown as Record<string, number>)[f.key]}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-slate-400">現在の合計: {total}</p>
                  <SubmitButton variant="secondary" className="w-full">
                    保存
                  </SubmitButton>
                </form>
              </Card>
            );
          })}

          <Card className="border-dashed">
            <h3 className="font-medium mb-3 text-sm">新規スコアリングプロファイル</h3>
            <form action={createScoringProfile} className="space-y-3">
              <Field label="プロファイル名 *">
                <Input name="name" required />
              </Field>
              {WEIGHT_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <label className="text-xs text-slate-600 w-56 shrink-0">{f.label}</label>
                  <Input name={f.key} type="number" min={0} max={100} defaultValue={0} />
                </div>
              ))}
              <SubmitButton className="w-full">
                作成
              </SubmitButton>
            </form>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-3 text-slate-800">コンプライアンスプロファイル</h2>
        <p className="text-sm text-slate-500 mb-4">
          #PR表記・関係性明示・CTA誘導の必須設定と、カテゴリごとのNGワード/OKワード例を管理します。
        </p>
        <div className="grid grid-cols-2 gap-4">
          {complianceProfiles.map((cp) => {
            const updateWithId = updateComplianceProfile.bind(null, cp.id);
            return (
              <Card key={cp.id}>
                <form action={updateWithId} className="space-y-3">
                  <Field label="プロファイル名">
                    <Input name="name" defaultValue={cp.name} />
                  </Field>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="requirePr" defaultChecked={cp.requirePr} /> #PR必須
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="requireRelation" defaultChecked={cp.requireRelation} /> 関係性明示必須
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="requireCta" defaultChecked={cp.requireCta} /> CTA誘導必須
                    </label>
                  </div>
                  <Field label="NGワード(カンマ区切り)">
                    <Textarea name="ngWords" rows={2} defaultValue={cp.ngWords ?? ""} />
                  </Field>
                  <Field label="OKワード例(カンマ区切り)">
                    <Textarea name="okWords" rows={2} defaultValue={cp.okWords ?? ""} />
                  </Field>
                  <Field label="追加注意事項">
                    <Textarea name="extraNotes" rows={2} defaultValue={cp.extraNotes ?? ""} />
                  </Field>
                  <SubmitButton variant="secondary" className="w-full">
                    保存
                  </SubmitButton>
                </form>
              </Card>
            );
          })}

          <Card className="border-dashed">
            <h3 className="font-medium mb-3 text-sm">新規コンプライアンスプロファイル</h3>
            <form action={createComplianceProfile} className="space-y-3">
              <Field label="プロファイル名 *">
                <Input name="name" required />
              </Field>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="requirePr" defaultChecked /> #PR必須
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="requireRelation" defaultChecked /> 関係性明示必須
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="requireCta" defaultChecked /> CTA誘導必須
                </label>
              </div>
              <Field label="NGワード(カンマ区切り)">
                <Textarea name="ngWords" rows={2} />
              </Field>
              <Field label="OKワード例(カンマ区切り)">
                <Textarea name="okWords" rows={2} />
              </Field>
              <Field label="追加注意事項">
                <Textarea name="extraNotes" rows={2} />
              </Field>
              <SubmitButton className="w-full">
                作成
              </SubmitButton>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}
