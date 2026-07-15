import { prisma } from "@/lib/db";
import { Card, PageTitle, LinkButton, Badge } from "@/components/ui";
import { UserPlus, Search } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  tiktok: "TikTok",
};

export default async function InfluencersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; platform?: string; bl?: string; bulkCreated?: string; bulkSkipped?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const platform = sp.platform ?? "";
  const blOnly = sp.bl === "1";

  const where: Prisma.InfluencerWhereInput = {};
  if (platform) where.platform = platform;
  if (blOnly) where.isBlacklisted = true;
  if (q) {
    where.OR = [
      { username: { contains: q } },
      { displayName: { contains: q } },
      { genreTags: { contains: q } },
    ];
  }

  const influencers = await prisma.influencer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageTitle
        title="インフルエンサーマスタ"
        subtitle="全社横断ストック。ブランドに依存しない共有資産です"
        action={
          <LinkButton href="/influencers/new">
            <span className="inline-flex items-center gap-1.5">
              <UserPlus className="size-4" /> 追加する
            </span>
          </LinkButton>
        }
      />

      {(sp.bulkCreated || sp.bulkSkipped) && (
        <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-2">
          一括登録完了: {sp.bulkCreated ?? 0}件追加 / {sp.bulkSkipped ?? 0}件は既存のためスキップ
        </div>
      )}

      <Card className="mb-4">
        <form className="flex gap-3 items-end flex-wrap" method="get">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-slate-500 mb-1">検索(username/表示名/ジャンル)</label>
            <input
              name="q"
              defaultValue={q}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="キーワード"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">プラットフォーム</label>
            <select
              name="platform"
              defaultValue={platform}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">すべて</option>
              {Object.entries(PLATFORM_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 pb-2">
            <input type="checkbox" name="bl" value="1" defaultChecked={blOnly} />
            ブラックリストのみ
          </label>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500">
            <Search className="size-4" /> 絞り込み
          </button>
        </form>
      </Card>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">プラットフォーム</th>
              <th className="text-left px-4 py-2">username</th>
              <th className="text-left px-4 py-2">表示名</th>
              <th className="text-right px-4 py-2">フォロワー</th>
              <th className="text-right px-4 py-2">ER</th>
              <th className="text-left px-4 py-2">ジャンル</th>
              <th className="text-left px-4 py-2">状態</th>
            </tr>
          </thead>
          <tbody>
            {influencers.map((inf) => (
              <tr key={inf.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-600">{PLATFORM_LABELS[inf.platform] ?? inf.platform}</td>
                <td className="px-4 py-2">
                  <Link href={`/influencers/${inf.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                    @{inf.username}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{inf.displayName ?? "-"}</td>
                <td className="px-4 py-2 text-right text-slate-700">{inf.followers?.toLocaleString() ?? "-"}</td>
                <td className="px-4 py-2 text-right text-slate-700">{inf.engagementRate ? `${inf.engagementRate}%` : "-"}</td>
                <td className="px-4 py-2 text-slate-600">{inf.genreTags ?? "-"}</td>
                <td className="px-4 py-2">
                  {inf.isBlacklisted ? <Badge color="red">ブラックリスト</Badge> : <Badge color="green">通常</Badge>}
                </td>
              </tr>
            ))}
            {influencers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  該当するインフルエンサーがいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
