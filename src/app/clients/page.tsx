import { prisma } from "@/lib/db";
import { Card, PageTitle, Input, Textarea, Field, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "./actions";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    include: { brands: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageTitle title="クライアント" subtitle="クライアント企業とブランドを管理します" />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-3">
          {clients.length === 0 && (
            <EmptyState>まだクライアントが登録されていません。右のフォームから追加してください。</EmptyState>
          )}
          {clients.map((c) => (
            <Card key={c.id} className="hover:border-indigo-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Building2 className="size-4.5" />
                  </div>
                  <div>
                    <Link href={`/clients/${c.id}`} className="font-semibold text-lg text-slate-900 hover:text-indigo-600">
                      {c.name}
                    </Link>
                    <p className="text-sm text-slate-500 mt-0.5">ブランド数: {c.brands.length}</p>
                    {c.notes && <p className="text-sm text-slate-600 mt-1">{c.notes}</p>}
                  </div>
                </div>
                <Link
                  href={`/clients/${c.id}`}
                  className="inline-flex items-center text-sm text-slate-400 hover:text-indigo-600"
                >
                  詳細 <ChevronRight className="size-4" />
                </Link>
              </div>
            </Card>
          ))}
        </div>

        <Card className="h-fit sticky top-8">
          <h2 className="font-semibold mb-4 text-slate-800">新規クライアント追加</h2>
          <form action={createClient} className="space-y-4">
            <Field label="クライアント企業名 *">
              <Input name="name" required placeholder="例: 株式会社〇〇" />
            </Field>
            <Field label="メモ">
              <Textarea name="notes" rows={3} placeholder="任意メモ" />
            </Field>
            <SubmitButton className="w-full">追加する</SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
