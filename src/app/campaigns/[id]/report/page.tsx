import { prisma } from "@/lib/db";
import { Card, PageTitle, LinkButton } from "@/components/ui";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CampaignReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaignId = Number(id);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      brand: { include: { client: true } },
      members: { include: { posts: true, influencer: true } },
    },
  });
  if (!campaign) notFound();

  const posts = campaign.members.flatMap((m) => m.posts);
  const totalReach = posts.reduce((s, p) => s + (p.reach ?? 0), 0);
  const totalImpressions = posts.reduce((s, p) => s + (p.impressions ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalClicks = posts.reduce((s, p) => s + (p.linkClicks ?? 0), 0);
  const secondaryUseCount = posts.filter((p) => p.secondaryUseOk).length;
  const ctaRate = posts.length > 0 ? (posts.filter((p) => p.hasCta).length / posts.length) * 100 : 0;

  return (
    <div>
      <PageTitle
        title={`${campaign.name} - レポート`}
        subtitle={`${campaign.brand.client.name} / ${campaign.brand.name}`}
        action={
          <Link
            href={`/campaigns/${campaignId}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-4" /> 施策詳細
          </Link>
        }
      />

      <p className="text-xs text-slate-500 mb-4">
        ※ 発送先住所・DM本文/返信などの個人情報はクライアント提出レポートの対象外です(CSVには含まれません)。
      </p>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card>
          <p className="text-xs text-slate-500">投稿数</p>
          <p className="text-2xl font-bold">{posts.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">総リーチ</p>
          <p className="text-2xl font-bold">{totalReach.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">総インプレッション</p>
          <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">CTA実装率</p>
          <p className="text-2xl font-bold">{ctaRate.toFixed(0)}%</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">二次利用可素材</p>
          <p className="text-2xl font-bold">{secondaryUseCount}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <p className="text-sm">
          総いいね数: <strong>{totalLikes.toLocaleString()}</strong> ・ 総リンククリック数:{" "}
          <strong>{totalClicks.toLocaleString()}</strong>
        </p>
      </Card>

      <LinkButton href={`/api/campaigns/${campaignId}/report`}>
        <span className="inline-flex items-center gap-1.5">
          <Download className="size-4" /> CSVをダウンロード
        </span>
      </LinkButton>
    </div>
  );
}
