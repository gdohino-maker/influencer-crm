export type DmComplianceInput = {
  requirePr: boolean;
  requireRelation: boolean;
  requireCta: boolean;
  ngWords: string | null;
  okWords: string | null;
  extraNotes: string | null;
};

export type DmContext = {
  influencerDisplayName: string;
  clientName: string;
  brandName: string;
  searchKeyword: string;
};

// Phase 1: ブロックAはAI生成なし。汎用文面を初期値として提供し、ユーザーが自由編集する。
export function defaultBlockA(ctx: DmContext): string {
  return `${ctx.influencerDisplayName} 様

はじめまして。${ctx.clientName} の△△と申します。
いつも素敵な投稿を拝見しております。

この度 ${ctx.brandName} を無償でお試しいただき、ご感想を投稿という形で
ご紹介いただけないかご連絡いたしました。`;
}

// ブロックB・Cはコンプライアンス設定に従い自動生成。編集不可・削除不可。
export function buildBlockB(c: DmComplianceInput, ctx: DmContext): string {
  const lines: string[] = [];
  if (c.requirePr) lines.push("・投稿に「#PR」を明記してください");
  if (c.requireRelation)
    lines.push(
      `・「${ctx.clientName}様よりご提供いただきました」等、関係性が分かる一文を記載してください(ステマ規制/表示法に基づくお願い)`
    );
  if (c.requireCta) lines.push(`・「Amazonで「${ctx.searchKeyword}」と検索🔍」の一文を入れてください`);
  return lines.join("\n");
}

export function buildBlockC(c: DmComplianceInput): string {
  const lines: string[] = [];
  const hasNg = c.ngWords && c.ngWords.trim().length > 0;
  if (hasNg) {
    lines.push("本商品カテゴリでは以下の表現は使用できません。");
    lines.push(`・使用できない表現: ${c.ngWords}`);
    if (c.okWords && c.okWords.trim().length > 0) {
      lines.push(`・使っていただきたい表現の例: ${c.okWords}`);
    }
  }
  if (c.extraNotes && c.extraNotes.trim().length > 0) lines.push(c.extraNotes);
  return lines.join("\n");
}

export function composeDm(blockA: string, c: DmComplianceInput, ctx: DmContext): string {
  const blockB = buildBlockB(c, ctx);
  const blockC = buildBlockC(c);

  const parts = [blockA.trim()];
  if (blockB.trim().length > 0) {
    parts.push("---- 投稿時の必須事項 ----\n" + blockB);
  }
  if (blockC.trim().length > 0) {
    parts.push("---- 表現に関するお願い ----\n" + blockC);
  }
  return parts.join("\n\n");
}
