import { prisma } from "@/lib/db";
import { Card, PageTitle, Input, Select, StatusBadge, Badge, SectionTitle, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Sparkles, ArrowLeft, RefreshCw, FileText, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Influencer } from "@prisma/client";
import { updateCampaignStatus, updateCampaign } from "../actions";
import { addCandidate, updateFit, updateMemberStatus, recalcAllScores, suggestFit, removeCandidate } from "./actions";

const STATUS_OPTIONS = [
  "candidate",
  "shortlist",
  "dm_sent",
  "accepted",
  "shipped",
  "posted",
  "done",
  "rejected",
  "no_reply",
];

const GOAL_OPTIONS = [
  { value: "ugc_volume", label: "UGC量産" },
  { value: "asset_acquisition", label: "二次利用素材獲得" },
  { value: "branded_search", label: "指名検索創出" },
  { value: "launch", label: "ローンチ/認知拡大" },
];

const CAMPAIGN_STATUS_OPTIONS = ["planning", "running", "closed"];
const CAMPAIGN_STATUS_LABELS: Record<string, string> = { planning: "計画中", running: "実施中", closed: "終了" };

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      brand: { include: { client: true, scoringProfile: true, complianceProfile: true } },
      members: {
        include: { influencer: true, posts: true, outreaches: true },
      },
    },
  });
  if (!campaign) notFound();

  const members = [...campaign.members].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  let searchResults: Influencer[] = [];
  if (search) {
    const memberInfluencerIds = campaign.members.map((m) => m.influencerId);
    searchResults = await prisma.influencer.findMany({
      where: {
        id: { notIn: memberInfluencerIds },
        OR: [{ username: { contains: search } }, { displayName: { contains: search } }],
      },
      take: 20,
    });
  }

  const updateStatusWithId = updateCampaignStatus.bind(null, campaignId, campaign.brandId);
  const updateCampaignWithId = updateCampaign.bind(null, campaignId, campaign.brandId);
  const recalcWithId = recalcAllScores.bind(null, campaignId);

  const ctaMissing = campaign.members.flatMap((m) => m.posts).filter((p) => !p.hasCta).length;

  return (
    <div>
      <PageTitle
        title={campaign.name}
        subtitle={`${campaign.brand.client.name} / ${campaign.brand.name}`}
        action={
          <Link
            href={`/brands/${campaign.brandId}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-4" /> {campaign.brand.name}
          </Link>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        <form action={updateStatusWithId} className="flex items-center gap-2">
          <Select name="status" defaultValue={campaign.status} className="w-40">
            {CAMPAIGN_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {CAMPAIGN_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <SubmitButton variant="secondary">ステータス更新</SubmitButton>
        </form>
        <Link
          href={`/campaigns/${campaignId}/report`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 ml-auto"
        >
          <FileText className="size-4" /> レポート出力
        </Link>
      </div>

      {ctaMissing > 0 && (
        <div className="mb-6 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
          ⚠ CTA(Amazon誘導)未実装の投稿が {ctaMissing} 件あります
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 mb-6">
        <Card>
          <p className="text-xs text-slate-500">候補数</p>
          <p className="text-2xl font-bold text-slate-900">{members.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">目標人数</p>
          <p className="text-2xl font-bold text-slate-900">{campaign.targetCount ?? "-"}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">投稿済</p>
          <p className="text-2xl font-bold text-slate-900">
            {members.filter((m) => m.status === "posted" || m.status === "done").length}
          </p>
        </Card>
      </div>

      <SectionTitle
        action={
          <form action={recalcWithId}>
            <SubmitButton variant="secondary" pendingText="計算中...">
              <RefreshCw className="size-3.5" /> スコア再計算
            </SubmitButton>
          </form>
        }
      >
        候補者一覧(スコア順)
      </SectionTitle>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-8">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">username</th>
              <th className="text-right px-3 py-2">スコア</th>
              <th className="text-left px-3 py-2">層適合・ジャンル適合・除外理由</th>
              <th className="text-left px-3 py-2">ステータス</th>
              <th className="text-left px-3 py-2">詳細</th>
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const updateFitWithId = updateFit.bind(null, m.id, campaignId);
              const updateStatusForMember = updateMemberStatus.bind(null, m.id, campaignId);
              const suggestFitWithId = suggestFit.bind(null, m.id, campaignId);
              const removeCandidateWithId = removeCandidate.bind(null, m.id, campaignId);
              return (
                <tr key={m.id} className="border-t border-slate-100 align-top hover:bg-slate-50/50">
                  <td className="px-3 py-2">
                    <Link href={`/influencers/${m.influencerId}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      @{m.influencer.username}
                    </Link>
                    {m.influencer.isBlacklisted && (
                      <div>
                        <Badge color="red">BL</Badge>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">
                    {m.score != null ? m.score.toFixed(1) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <form action={updateFitWithId} className="flex items-center gap-2">
                      <input
                        type="number"
                        name="audienceFit"
                        min={1}
                        max={5}
                        defaultValue={m.audienceFit ?? ""}
                        placeholder="層1-5"
                        title="ターゲット層適合(1-5)"
                        className="w-14 border border-slate-300 rounded px-1 py-1 text-center"
                      />
                      <input
                        type="number"
                        name="genreFit"
                        min={1}
                        max={5}
                        defaultValue={m.genreFit ?? ""}
                        placeholder="ジャンル1-5"
                        title="ジャンル適合(1-5)"
                        className="w-14 border border-slate-300 rounded px-1 py-1 text-center"
                      />
                      <input
                        type="text"
                        name="excludeFlags"
                        defaultValue={m.excludeFlags ?? ""}
                        placeholder="除外理由"
                        className="w-28 border border-slate-300 rounded px-1 py-1 text-xs"
                      />
                      <SubmitButton variant="secondary" size="sm">
                        保存
                      </SubmitButton>
                    </form>
                    <form action={suggestFitWithId} className="mt-1">
                      <SubmitButton variant="ai" size="sm" pendingText="採点中...">
                        <Sparkles className="size-3" /> AI採点
                      </SubmitButton>
                    </form>
                  </td>
                  <td className="px-3 py-2">
                    <form action={updateStatusForMember} className="flex items-center gap-2">
                      <select name="status" defaultValue={m.status} className="border border-slate-300 rounded px-1 py-1 text-xs">
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <SubmitButton variant="secondary" size="sm">
                        更新
                      </SubmitButton>
                    </form>
                    <div className="mt-1">
                      <StatusBadge status={m.status} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/campaigns/${campaignId}/members/${m.id}`} className="text-slate-500 hover:text-indigo-600 hover:underline">
                      DM/投稿管理 →
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <form action={removeCandidateWithId}>
                      <button
                        type="submit"
                        title="候補から削除(記録がある場合は削除不可)"
                        className="text-slate-300 hover:text-red-500"
                      >
                        <X className="size-4" />
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  まだ候補者がいません。下の検索から追加してください
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Card className="mb-6">
        <h2 className="font-semibold mb-4 text-slate-800">候補者を追加(インフルエンサーマスタから検索)</h2>
        <form method="get" className="flex gap-2 mb-4">
          <Input name="search" defaultValue={search} placeholder="username / 表示名で検索" />
          <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">
            検索
          </button>
        </form>
        {search && searchResults.length === 0 && (
          <p className="text-sm text-slate-500">
            該当なし。まだマスタに存在しない場合は{" "}
            <Link href="/influencers/new" className="underline">
              こちらから新規登録
            </Link>
            してください。
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {searchResults.map((r) => {
            const addWithIds = addCandidate.bind(null, campaignId, r.id);
            return (
              <li key={r.id} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-900">@{r.username}</span>{" "}
                  <span className="text-slate-500 text-sm">{r.displayName}</span>
                </div>
                <form action={addWithIds}>
                  <SubmitButton variant="secondary" size="sm">
                    候補に追加
                  </SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold mb-4 text-slate-800">施策情報編集</h2>
        <form action={updateCampaignWithId} className="grid grid-cols-2 gap-4">
          <Field label="施策名 *">
            <Input name="name" required defaultValue={campaign.name} />
          </Field>
          <Field label="目的 *">
            <Select name="goal" required defaultValue={campaign.goal}>
              {GOAL_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="目標人数">
            <Input name="targetCount" type="number" defaultValue={campaign.targetCount ?? ""} />
          </Field>
          <Field label="予算(円)">
            <Input name="budgetYen" type="number" defaultValue={campaign.budgetYen ?? ""} />
          </Field>
          <Field label="開始日">
            <Input name="startsAt" type="date" defaultValue={campaign.startsAt ? campaign.startsAt.toISOString().slice(0, 10) : ""} />
          </Field>
          <Field label="終了日">
            <Input name="endsAt" type="date" defaultValue={campaign.endsAt ? campaign.endsAt.toISOString().slice(0, 10) : ""} />
          </Field>
          <div className="col-span-2">
            <SubmitButton>更新する</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
