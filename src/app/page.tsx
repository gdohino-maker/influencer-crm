import { prisma } from "@/lib/db";
import { Card, PageTitle, Badge, LinkButton, EmptyState, SectionTitle } from "@/components/ui";
import { AlertTriangle, Building2, Megaphone, Users, ImageIcon } from "lucide-react";
import Link from "next/link";

const CAMPAIGN_STATUS_LABELS: Record<string, string> = { planning: "計画中", running: "実施中", closed: "終了" };

export default async function DashboardPage() {
  const [clients, runningCampaigns, allPosts, blacklistedCount, influencerCount] = await Promise.all([
    prisma.client.count(),
    prisma.campaign.findMany({
      where: { status: "running" },
      include: {
        brand: { include: { client: true } },
        members: { include: { posts: true, influencer: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.post.findMany({
      include: {
        campaignInfluencer: {
          include: {
            influencer: true,
            campaign: { include: { brand: { include: { client: true } } } },
          },
        },
      },
      orderBy: { id: "desc" },
      take: 500,
    }),
    prisma.influencer.count({ where: { isBlacklisted: true } }),
    prisma.influencer.count(),
  ]);

  const ctaMissingPosts = allPosts.filter((p) => !p.hasCta);
  const ngWordPosts = allPosts.filter((p) => p.ngWordHit);
  const secondaryUseAssets = allPosts.filter((p) => p.secondaryUseOk).length;

  const campaignsByClient = new Map<string, typeof runningCampaigns>();
  for (const c of runningCampaigns) {
    const key = c.brand.client.name;
    if (!campaignsByClient.has(key)) campaignsByClient.set(key, []);
    campaignsByClient.get(key)!.push(c);
  }

  return (
    <div>
      <PageTitle
        title="ダッシュボード"
        subtitle="進行中キャンペーン(クライアント別)とコンプライアンス警告"
        action={<LinkButton href="/clients">クライアント一覧へ</LinkButton>}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">クライアント数</p>
            <Building2 className="size-4 text-slate-300" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{clients}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">実施中施策数</p>
            <Megaphone className="size-4 text-slate-300" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{runningCampaigns.length}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">インフルエンサーストック</p>
            <Users className="size-4 text-slate-300" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {influencerCount} <span className="text-xs text-red-500 font-normal">(BL: {blacklistedCount})</span>
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">二次利用可能素材数</p>
            <ImageIcon className="size-4 text-slate-300" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{secondaryUseAssets}</p>
        </Card>
      </div>

      {(ctaMissingPosts.length > 0 || ngWordPosts.length > 0) && (
        <Card className="mb-6 border-red-300 bg-red-50">
          <h2 className="font-semibold text-red-800 mb-3 flex items-center gap-1.5">
            <AlertTriangle className="size-4" /> コンプライアンス警告
          </h2>
          <div className="space-y-2 text-sm">
            {ctaMissingPosts.length > 0 && (
              <p className="text-red-800">
                CTA(Amazon誘導)未実装の投稿: <strong>{ctaMissingPosts.length}件</strong>
              </p>
            )}
            {ngWordPosts.length > 0 && (
              <p className="text-red-800">
                NGワード検出済の投稿: <strong>{ngWordPosts.length}件</strong>
              </p>
            )}
            <ul className="mt-2 space-y-1">
              {[...ctaMissingPosts, ...ngWordPosts].slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/campaigns/${p.campaignInfluencer.campaignId}/members/${p.campaignInfluencerId}`}
                    className="underline hover:no-underline"
                  >
                    @{p.campaignInfluencer.influencer.username} - {p.campaignInfluencer.campaign.brand.client.name}/
                    {p.campaignInfluencer.campaign.name}
                  </Link>{" "}
                  {!p.hasCta && <Badge color="red">CTA未実装</Badge>}
                  {p.ngWordHit && <Badge color="red">NG: {p.ngWordHit}</Badge>}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <SectionTitle>進行中キャンペーン(クライアント別)</SectionTitle>
      {campaignsByClient.size === 0 && (
        <EmptyState>実施中の施策はまだありません。クライアント/ブランドを登録してキャンペーンを開始してください。</EmptyState>
      )}
      <div className="space-y-6">
        {[...campaignsByClient.entries()].map(([clientName, campaigns]) => (
          <div key={clientName}>
            <h3 className="font-medium text-slate-700 mb-2">{clientName}</h3>
            <div className="grid grid-cols-3 gap-4">
              {campaigns.map((c) => {
                const posted = c.members.filter((m) => m.posts.length > 0).length;
                const secondaryUse = c.members.flatMap((m) => m.posts).filter((p) => p.secondaryUseOk).length;
                return (
                  <Card key={c.id}>
                    <div className="flex items-center justify-between mb-2">
                      <Link href={`/campaigns/${c.id}`} className="font-semibold hover:underline">
                        {c.name}
                      </Link>
                      <Badge color="blue">{CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">{c.brand.name}</p>
                    <p className="text-sm mt-2">
                      候補 {c.members.length} / 投稿済 {posted} / 二次利用可 {secondaryUse}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
