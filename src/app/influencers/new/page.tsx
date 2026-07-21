import { Card, PageTitle, Input, Textarea, Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createInfluencer, createInfluencersBulk } from "../actions";

export default function NewInfluencerPage() {
  return (
    <div>
      <PageTitle
        title="インフルエンサー追加"
        subtitle="IG/X/TikTokは自動検索不可のため手動登録します。YouTubeも単体登録可能です"
        action={
          <Link href="/influencers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" /> 一覧に戻る
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold mb-4 text-slate-800">単体登録</h2>
          <form action={createInfluencer} className="space-y-4">
            <Field label="プラットフォーム *">
              <Select name="platform" required defaultValue="instagram">
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="x">X</option>
                <option value="tiktok">TikTok</option>
              </Select>
            </Field>
            <Field label="username *">
              <Input name="username" required placeholder="例: sample_user" />
            </Field>
            <Field label="URL *">
              <Input name="url" required type="url" placeholder="https://..." />
            </Field>
            <Field label="表示名">
              <Input name="displayName" />
            </Field>
            <Field label="bio">
              <Textarea name="bio" rows={2} />
            </Field>
            <Field label="フォロワー数">
              <Input name="followers" type="number" />
            </Field>
            <Field label="エンゲージメント率(%)">
              <Input name="engagementRate" type="number" step="0.01" />
            </Field>
            <Field label="ジャンルタグ(カンマ区切り)">
              <Input name="genreTags" placeholder="暮らし,料理,美容" />
            </Field>
            <Field label="フォロワー推定年齢帯">
              <Input name="audienceAgeGuess" placeholder="40s,50s" />
            </Field>
            <Field label="フォロワー推定性別">
              <Select name="audienceGenderGuess" defaultValue="">
                <option value="">未設定</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="mixed">混合</option>
              </Select>
            </Field>
            <Field label="メモ">
              <Textarea name="notes" rows={2} />
            </Field>
            <SubmitButton className="w-full">登録する</SubmitButton>
          </form>
        </Card>

        <Card>
          <h2 className="font-semibold mb-4 text-slate-800">一括登録</h2>
          <p className="text-xs text-slate-500 mb-4">
            1行1件、カンマ区切りで貼り付けるか、CSVファイル(utf-8-sig対応)をアップロードしてください。
            <br />
            簡易形式: <code className="bg-slate-100 px-1">username,url,表示名,フォロワー数,ER,ジャンルタグ</code>
            <br />
            リサーチ形式(Claude for Chrome等で調査したCSVをそのまま貼り付け可能):
            <br />
            <code className="bg-slate-100 px-1 text-[11px]">
              username,url,displayName,followers,totalLikes,postsCount,avgView,avgLike,avgEngagement,avgComment,videoAvgScore,postFreqWeek,lastPublished,contact,notes
            </code>
            <br />
            (usernameのみ必須。既に登録済のusernameはスキップされます。ファイルを選択した場合は貼り付け内容より優先されます)
          </p>
          <form action={createInfluencersBulk} className="space-y-4">
            <Field label="プラットフォーム *">
              <Select name="platform" required defaultValue="tiktok">
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="x">X</option>
              </Select>
            </Field>
            <Field label="CSVファイル">
              <input
                type="file"
                name="csvFile"
                accept=".csv,text/csv"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
              />
            </Field>
            <Field label="または一覧データを貼り付け">
              <Textarea
                name="bulk"
                rows={10}
                placeholder={"sample_user1,https://instagram.com/sample_user1,サンプル1,12000,2.1,暮らし\nsample_user2,https://instagram.com/sample_user2,サンプル2,8500,3.4,料理"}
              />
            </Field>
            <SubmitButton className="w-full">一括登録する</SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
