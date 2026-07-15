import { Input, Textarea, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createFromPrompt } from "./actions";

export default function StartPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft className="size-4" /> ダッシュボードに戻る
      </Link>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white mb-4 shadow-lg shadow-indigo-200">
          <Sparkles className="size-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">新しく探す</h1>
        <p className="text-slate-500 mt-2 text-sm">
          企業名・ブランド名と、どんな人に届けたいかを入力するだけ。AIが条件を整理して、合いそうなインフルエンサーをすぐに提案します。
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
        <form action={createFromPrompt} className="space-y-5">
          <Field label="企業名 *">
            <Input name="clientName" required placeholder="例: 株式会社〇〇" />
          </Field>
          <Field label="ブランド/商品名 *">
            <Input name="brandName" required placeholder="例: △△健康茶" />
          </Field>
          <Field label="どんな商品で、どんな人に届けたいですか？ *">
            <Textarea
              name="prompt"
              required
              rows={6}
              placeholder={
                "例: 40代〜50代の女性向けの健康茶です。丁寧な暮らしや家族との食卓を大事にしている人に紹介してほしいです。派手さより信頼感を大事にしたいです。"
              }
            />
          </Field>
          <p className="text-xs text-slate-400">
            年代・性別・雰囲気・こだわりなど、思いついたことを自由に書いてください。カテゴリやターゲット条件はAIが自動で整理します。
          </p>
          <SubmitButton className="w-full" pendingText="AIが解析中...">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-4" /> AIで候補を探す
            </span>
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
