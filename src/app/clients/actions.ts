"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createClient(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!name) throw new Error("クライアント名は必須です");

  const client = await prisma.client.create({
    data: { name, notes: notes || null },
  });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(id: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!name) throw new Error("クライアント名は必須です");

  await prisma.client.update({
    where: { id },
    data: { name, notes: notes || null },
  });
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}
