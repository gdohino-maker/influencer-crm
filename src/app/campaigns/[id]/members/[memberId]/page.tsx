import { prisma } from "@/lib/db";
import { Card, PageTitle, Input, Textarea, Field, Select, StatusBadge, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CopyButton } from "@/components/copy-button";
import { Sparkles, ArrowLeft, Truck, Send, MessageSquareText, Mail } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultBlockA, composeDm } from "@/lib/dm-template";
import { logOutreach, logReply, logShipment, logPost, generateBlockA, updateBlockA } from "./actions";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId: memberIdStr } = await params;
  const campaignId = Number(id);
  const memberId = Number(memberIdStr);

  const member = await prisma.campaignInfluencer.findUnique({
    where: { id: memberId },
    include: {
      influencer: true,
      campaign: { include: { brand: { include: { client: true, complianceProfile: true } } } },
      outreaches: { orderBy: { id: "desc" } },
      shipments: { orderBy: { id: "desc" } },
      posts: { orderBy: { id: "desc" } },
    },
  });
  if (!member || member.campaignId !== campaignId) notFound();

  const { brand } = member.campaign;
  const dmCtx = {
    influencerDisplayName: member.influencer.displayName ?? member.influencer.username,
    clientName: brand.client.name,
    brandName: brand.name,
    searchKeyword: brand.searchKeyword,
  };
  const blockA = member.draftBlockA ?? defaultBlockA(dmCtx);
  const previewDm = composeDm(blockA, brand.complianceProfile, dmCtx);

  const logOutreachWithId = logOutreach.bind(null, memberId, campaignId);
  const logShipmentWithId = logShipment.bind(null, memberId, campaignId);
  const logPostWithId = logPost.bind(null, memberId, campaignId);
  const generateBlockAWithId = generateBlockA.bind(null, memberId, campaignId);
  const updateBlockAWithId = updateBlockA.bind(null, memberId, campaignId);

  return (
    <div>
      <PageTitle
        title={`@${member.influencer.username}`}
        subtitle={`${member.campaign.name} の候補者 - DM/発送/投稿管理`}
        action={
          <Link
            href={`/campaigns/${campaignId}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-4" /> 施策詳細
          </Link>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <StatusBadge status={member.status} />
        <span className="text-sm text-slate-500">スコア: {member.score != null ? member.score.toFixed(1) : "-"}</span>
      </div>

      {/* コピーして送るだけ */}
      <Card className="mb-6 border-indigo-200 bg-indigo-50/40">
        <h2 className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
          <Mail className="size-4 text-indigo-500" /> メール文をコピーして送る
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          この文面をそのままDM/メールにコピー&ペーストして送信してください。文面を調整したい場合は下の「DM/メッセージ生成」で編集できます。
        </p>
        <Textarea readOnly rows={10} defaultValue={previewDm} className="bg-white mb-3" />
        <CopyButton text={previewDm} label="この文面をコピーする" />
      </Card>

      {/* DM生成 */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-slate-800 flex items-center gap-1.5">
            <MessageSquareText className="size-4 text-slate-400" /> DM/メッセージ生成
          </h2>
          <form action={generateBlockAWithId}>
            <SubmitButton variant="ai" pendingText="生成中...">
              <Sparkles className="size-3.5" /> AIでブロックAを生成
            </SubmitButton>
          </form>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          ブロックA(依頼本文)はGeminiで生成・自由編集できます。ブロックB(必須事項)・C(表現ルール)はコンプライアンスプロファイル「
          {brand.complianceProfile.name}」に基づき自動生成され、編集・削除できません。
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">ブロックA(編集可)</p>
            <form action={updateBlockAWithId} className="space-y-2">
              <Textarea name="blockA" rows={8} defaultValue={blockA} />
              <SubmitButton variant="secondary">ブロックAを保存</SubmitButton>
            </form>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">送付文面プレビュー(全ブロック結合)</p>
            <Textarea readOnly rows={8} defaultValue={previewDm} className="bg-slate-50" />
          </div>
        </div>
      </Card>

      {/* Outreach */}
      <Card className="mb-6">
        <h2 className="font-semibold mb-4 text-slate-800 flex items-center gap-1.5">
          <Send className="size-4 text-slate-400" /> 送付ログ・返信管理
        </h2>
        <form action={logOutreachWithId} className="space-y-3 mb-6">
          <Field label="送付チャネル">
            <Select name="channel" defaultValue="dm">
              <option value="dm">DM</option>
              <option value="email">メール</option>
            </Select>
          </Field>
          <Field label="送付本文 *">
            <Textarea name="body" rows={6} required defaultValue={previewDm} />
          </Field>
          <Field label="送付日時">
            <Input name="sentAt" type="datetime-local" />
          </Field>
          <SubmitButton pendingText="記録中...">送付を記録する(ステータスをDM送付済に)</SubmitButton>
        </form>

        <ul className="space-y-4">
          {member.outreaches.map((o) => {
            const logReplyWithId = logReply.bind(null, o.id, campaignId, memberId);
            return (
              <li key={o.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>
                    {o.channel} ・ {o.sentAt ? new Date(o.sentAt).toLocaleString("ja-JP") : "-"}
                  </span>
                  {o.repliedAt ? <Badge color="green">返信あり</Badge> : <Badge color="yellow">未返信</Badge>}
                </div>
                <p className="text-sm whitespace-pre-wrap mb-3">{o.body}</p>
                {o.reply ? (
                  <div className="bg-slate-50 rounded p-2 text-sm">
                    <p className="text-xs text-slate-500 mb-1">返信内容</p>
                    <p className="whitespace-pre-wrap">{o.reply}</p>
                    {o.agreedTerms && <p className="text-xs text-slate-500 mt-1">合意条件: {o.agreedTerms}</p>}
                  </div>
                ) : (
                  <form action={logReplyWithId} className="space-y-2">
                    <Textarea name="reply" rows={2} placeholder="返信内容を記録" />
                    <Input name="agreedTerms" placeholder="合意条件(任意)" />
                    <SubmitButton variant="secondary" size="sm">
                      返信を記録
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Shipment */}
      <Card className="mb-6">
        <h2 className="font-semibold mb-4 text-slate-800 flex items-center gap-1.5">
          <Truck className="size-4 text-slate-400" /> 発送管理
        </h2>
        <form action={logShipmentWithId} className="grid grid-cols-2 gap-4 mb-6">
          <Field label="発送日">
            <Input name="shippedAt" type="date" />
          </Field>
          <Field label="追跡番号">
            <Input name="trackingNo" />
          </Field>
          <Field label="住所(社外秘・レポート除外対象)">
            <Input name="address" />
          </Field>
          <Field label="商品原価(円)">
            <Input name="itemCost" type="number" />
          </Field>
          <Field label="送料(円)">
            <Input name="shippingFee" type="number" />
          </Field>
          <Field label="謝礼(円)">
            <Input name="rewardYen" type="number" defaultValue={0} />
          </Field>
          <div className="col-span-2">
            <SubmitButton pendingText="記録中...">発送を記録する</SubmitButton>
          </div>
        </form>
        <ul className="space-y-2 text-sm">
          {member.shipments.map((s) => (
            <li key={s.id} className="border-t pt-2">
              {s.shippedAt ? new Date(s.shippedAt).toLocaleDateString("ja-JP") : "-"} ・ 追跡: {s.trackingNo ?? "-"} ・
              原価: {s.itemCost ?? "-"}円 ・ 送料: {s.shippingFee ?? "-"}円 ・ 謝礼: {s.rewardYen ?? 0}円
            </li>
          ))}
        </ul>
      </Card>

      {/* Post */}
      <Card>
        <h2 className="font-semibold mb-4">投稿記録</h2>
        <form action={logPostWithId} className="grid grid-cols-2 gap-4 mb-6">
          <Field label="投稿URL *">
            <Input name="url" required type="url" />
          </Field>
          <Field label="投稿日">
            <Input name="postedAt" type="date" />
          </Field>
          <Field label="投稿タイプ">
            <Select name="postType" defaultValue="">
              <option value="">未設定</option>
              <option value="feed">feed</option>
              <option value="reel">reel</option>
              <option value="story">story</option>
              <option value="short">short</option>
              <option value="tweet">tweet</option>
              <option value="tiktok">tiktok</option>
            </Select>
          </Field>
          <Field label="キャプション(NGワード自動チェック対象)">
            <Textarea name="caption" rows={2} />
          </Field>
          <Field label="リーチ">
            <Input name="reach" type="number" />
          </Field>
          <Field label="インプレッション">
            <Input name="impressions" type="number" />
          </Field>
          <Field label="いいね数">
            <Input name="likes" type="number" />
          </Field>
          <Field label="保存数">
            <Input name="saves" type="number" />
          </Field>
          <Field label="コメント数">
            <Input name="comments" type="number" />
          </Field>
          <Field label="リンククリック数">
            <Input name="linkClicks" type="number" />
          </Field>
          <div className="col-span-2 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="hasPr" /> #PR記載あり
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="hasRelation" /> 関係性明示あり
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="hasCta" /> Amazon検索誘導あり
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="secondaryUseOk" /> 二次利用OK
            </label>
          </div>
          <Field label="二次利用素材URL">
            <Input name="assetUrl" type="url" />
          </Field>
          <div className="col-span-2">
            <SubmitButton pendingText="記録中...">投稿を記録する</SubmitButton>
          </div>
        </form>

        <ul className="space-y-3">
          {member.posts.map((p) => (
            <li key={p.id} className="border-t pt-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <a href={p.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {p.postType ?? "投稿"} を見る
                </a>
                {!p.hasCta && <Badge color="red">CTA未実装</Badge>}
                {!p.hasPr && <Badge color="red">#PR未記載</Badge>}
                {!p.hasRelation && <Badge color="yellow">関係性明示なし</Badge>}
                {p.ngWordHit && <Badge color="red">NGワード検出: {p.ngWordHit}</Badge>}
                {p.secondaryUseOk && <Badge color="blue">二次利用OK</Badge>}
              </div>
              <p className="text-slate-500 text-xs">
                リーチ {p.reach ?? "-"} ・ いいね {p.likes ?? "-"} ・ 保存 {p.saves ?? "-"} ・ コメント {p.comments ?? "-"} ・
                クリック {p.linkClicks ?? "-"}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
