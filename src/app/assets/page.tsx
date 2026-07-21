import { prisma } from "@/lib/db";
import { Card, PageTitle, EmptyState } from "@/components/ui";
import { UsedInAdsToggle } from "@/components/used-in-ads-toggle";
import Link from "next/link";

export default async function AssetsPage() {
  const posts = await prisma.post.findMany({
    where: { secondaryUseOk: true },
    orderBy: { postedAt: "desc" },
    include: {
      campaignInfluencer: {
        include: {
          influencer: true,
          campaign: { include: { brand: { include: { client: true } } } },
        },
      },
    },
  });

  return (
    <div>
      <PageTitle
        title="二次利用素材ライブラリ"
        subtitle="secondaryUseOk(二次利用許諾)が得られた投稿のみを一覧します。広告等での利用状況を記録できます"
      />

      {posts.length === 0 && <EmptyState>二次利用許諾済みの投稿はまだありません</EmptyState>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => {
          const { influencer, campaign } = post.campaignInfluencer;
          return (
            <Card key={post.id} className="flex flex-col gap-2">
              <div className="text-xs text-slate-500">
                {campaign.brand.client.name} / {campaign.brand.name} / {campaign.name}
              </div>
              <Link
                href={`/influencers/${influencer.id}`}
                className="font-medium text-slate-900 hover:text-indigo-600"
              >
                @{influencer.username}
              </Link>
              <div className="text-xs text-slate-500">
                {post.postedAt ? new Date(post.postedAt).toLocaleDateString("ja-JP") : "投稿日不明"} ・{" "}
                {post.postType ?? "種別不明"}
              </div>
              {post.assetUrl ? (
                <a
                  href={post.assetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-indigo-600 hover:underline break-all"
                >
                  素材を開く
                </a>
              ) : (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-indigo-600 hover:underline break-all"
                >
                  投稿を開く
                </a>
              )}
              <div className="text-xs text-slate-500">
                リーチ {post.reach?.toLocaleString() ?? "-"} ・ いいね {post.likes?.toLocaleString() ?? "-"}
              </div>
              <div className="pt-2 border-t border-slate-100">
                <UsedInAdsToggle postId={post.id} usedInAds={post.usedInAds} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
