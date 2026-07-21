import { prisma } from "@/lib/db";
import { Card, PageTitle, Input, Textarea, Field, Select, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateInfluencer, estimateAttributes, enrichFromInstagram } from "../actions";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  tiktok: "TikTok",
};

export default async function InfluencerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const influencerId = Number(id);
  const influencer = await prisma.influencer.findUnique({
    where: { id: influencerId },
    include: {
      campaigns: {
        include: { campaign: { include: { brand: { include: { client: true } } } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!influencer) notFound();

  const updateWithId = updateInfluencer.bind(null, influencerId);
  const estimateWithId = estimateAttributes.bind(null, influencerId);
  const enrichIgWithId = enrichFromInstagram.bind(null, influencerId);

  return (
    <div>
      <PageTitle
        title={`@${influencer.username}`}
        subtitle={`${PLATFORM_LABELS[influencer.platform] ?? influencer.platform} ・ ${influencer.displayName ?? ""}`}
        action={
          <Link href="/influencers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" /> 一覧に戻る
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">プロフィール編集</h2>
            <div className="flex items-center gap-2">
              {influencer.platform === "instagram" && (
                <form action={enrichIgWithId}>
                  <SubmitButton variant="secondary" pendingText="取得中...">
                    Instagramから数値取得
                  </SubmitButton>
                </form>
              )}
              <form action={estimateWithId}>
                <SubmitButton variant="ai" pendingText="推定中...">
                  <Sparkles className="size-3.5" /> AIでジャンル/属性を推定
                </SubmitButton>
              </form>
            </div>
          </div>
          {influencer.platform === "instagram" && (
            <p className="text-xs text-slate-500 -mt-2 mb-2">
              公開ビジネス/クリエイターアカウントのみ数値取得可能です(個人アカウントや取得失敗時は手動入力してください)。
            </p>
          )}
          <p className="text-xs text-slate-500 -mt-2 mb-4">
            bio・既存タグをもとにGeminiがジャンルタグ・年代・フォロワー推定層を提案し、フォームに反映します(推定なので必ず確認してください)。
          </p>
          <form action={updateWithId} className="space-y-4">
            <Field label="URL">
              <Input name="url" type="url" defaultValue={influencer.url} />
            </Field>
            <Field label="表示名">
              <Input name="displayName" defaultValue={influencer.displayName ?? ""} />
            </Field>
            <Field label="bio">
              <Textarea name="bio" rows={2} defaultValue={influencer.bio ?? ""} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="フォロワー数">
                <Input name="followers" type="number" defaultValue={influencer.followers ?? ""} />
              </Field>
              <Field label="投稿数">
                <Input name="postsCount" type="number" defaultValue={influencer.postsCount ?? ""} />
              </Field>
              <Field label="平均いいね数">
                <Input name="avgLike" type="number" defaultValue={influencer.avgLike ?? ""} />
              </Field>
              <Field label="平均コメント数">
                <Input name="avgComment" type="number" defaultValue={influencer.avgComment ?? ""} />
              </Field>
              <Field label="エンゲージメント率(%)">
                <Input name="engagementRate" type="number" step="0.01" defaultValue={influencer.engagementRate ?? ""} />
              </Field>
              <Field label="発信者本人の年代">
                <Input name="ageBand" defaultValue={influencer.ageBand ?? ""} />
              </Field>
              <Field label="フォロワー推定年齢帯">
                <Input name="audienceAgeGuess" defaultValue={influencer.audienceAgeGuess ?? ""} />
              </Field>
              <Field label="フォロワー推定性別">
                <Select name="audienceGenderGuess" defaultValue={influencer.audienceGenderGuess ?? ""}>
                  <option value="">未設定</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="mixed">混合</option>
                </Select>
              </Field>
              <Field label="写真/世界観の質(1-5)">
                <Input name="photoQuality" type="number" min={1} max={5} defaultValue={influencer.photoQuality ?? ""} />
              </Field>
              <Field label="直近PR比率(0-1)">
                <Input name="prFrequency" type="number" step="0.01" min={0} max={1} defaultValue={influencer.prFrequency ?? ""} />
              </Field>
            </div>
            <Field label="ジャンルタグ(カンマ区切り)">
              <Input name="genreTags" defaultValue={influencer.genreTags ?? ""} />
            </Field>

            <div className="border-t pt-4 mt-2">
              <p className="text-xs font-medium text-slate-500 mb-3">TikTok等・外部リサーチの詳細実績</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="総いいね数">
                  <Input name="totalLikes" type="number" defaultValue={influencer.totalLikes ?? ""} />
                </Field>
                <Field label="平均再生回数">
                  <Input name="avgView" type="number" defaultValue={influencer.avgView ?? ""} />
                </Field>
                <Field label="平均エンゲージメント数">
                  <Input name="avgEngagement" type="number" defaultValue={influencer.avgEngagement ?? ""} />
                </Field>
                <Field label="動画平均スコア(10点満点)">
                  <Input name="videoAvgScore" type="number" step="0.1" defaultValue={influencer.videoAvgScore ?? ""} />
                </Field>
                <Field label="投稿頻度(件/週)">
                  <Input name="postFreqWeek" type="number" step="0.1" defaultValue={influencer.postFreqWeek ?? ""} />
                </Field>
                <Field label="最終投稿日">
                  <Input
                    name="lastPublishedAt"
                    type="date"
                    defaultValue={influencer.lastPublishedAt ? influencer.lastPublishedAt.toISOString().slice(0, 10) : ""}
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="問い合わせ先(メール or URL)">
                  <Input name="contact" defaultValue={influencer.contact ?? ""} placeholder="example@mail.com または https://..." />
                </Field>
              </div>
            </div>

            <div className="border-t pt-4 mt-2">
              <label className="flex items-center gap-2 text-sm font-medium text-red-700">
                <input type="checkbox" name="isBlacklisted" defaultChecked={influencer.isBlacklisted} />
                全ブランド共通ブラックリストに登録する
              </label>
              <Field label="ブラックリスト理由">
                <Textarea name="blacklistReason" rows={2} defaultValue={influencer.blacklistReason ?? ""} />
              </Field>
            </div>

            <Field label="メモ">
              <Textarea name="notes" rows={2} defaultValue={influencer.notes ?? ""} />
            </Field>

            <SubmitButton>更新する</SubmitButton>
          </form>
        </Card>

        <Card>
          <h2 className="font-semibold mb-4 text-slate-800">参加施策履歴</h2>
          {influencer.campaigns.length === 0 && <p className="text-sm text-slate-500">まだ施策への参加がありません</p>}
          <ul className="space-y-3">
            {influencer.campaigns.map((ci) => (
              <li key={ci.id} className="text-sm border-b pb-2">
                <Link href={`/campaigns/${ci.campaignId}`} className="font-medium hover:underline">
                  {ci.campaign.brand.client.name} / {ci.campaign.brand.name} / {ci.campaign.name}
                </Link>
                <div className="mt-1">
                  <StatusBadge status={ci.status} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
