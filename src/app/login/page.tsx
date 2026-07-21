import { Card, Input, Field, Button } from "@/components/ui";
import { Sparkles } from "lucide-react";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const hasError = sp.error === "1";
  const isRateLimited = sp.error === "ratelimit";
  const next = sp.next ?? "/";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 -m-8">
      <Card className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <Sparkles className="size-5 text-indigo-600" />
          <span className="font-bold text-lg text-slate-900">Influencer CRM</span>
        </div>
        <form action={login} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="社内共通パスワード">
            <Input name="password" type="password" required autoFocus />
          </Field>
          {hasError && <p className="text-sm text-red-600">パスワードが違います</p>}
          {isRateLimited && (
            <p className="text-sm text-red-600">
              試行回数が多すぎます。しばらくしてから再度お試しください。
            </p>
          )}
          <Button type="submit" className="w-full">
            ログイン
          </Button>
        </form>
      </Card>
    </div>
  );
}
