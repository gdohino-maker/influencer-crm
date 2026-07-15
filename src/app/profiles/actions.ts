"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createScoringProfile(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("プロファイル名は必須です");
  await prisma.scoringProfile.create({
    data: {
      name,
      wAudience: Number(formData.get("wAudience") ?? 0),
      wGenre: Number(formData.get("wGenre") ?? 0),
      wEr: Number(formData.get("wEr") ?? 0),
      wPhoto: Number(formData.get("wPhoto") ?? 0),
      wNotJaded: Number(formData.get("wNotJaded") ?? 0),
      wActivity: Number(formData.get("wActivity") ?? 0),
      wFollower: Number(formData.get("wFollower") ?? 0),
    },
  });
  revalidatePath("/profiles");
}

export async function updateScoringProfile(id: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  await prisma.scoringProfile.update({
    where: { id },
    data: {
      name,
      wAudience: Number(formData.get("wAudience") ?? 0),
      wGenre: Number(formData.get("wGenre") ?? 0),
      wEr: Number(formData.get("wEr") ?? 0),
      wPhoto: Number(formData.get("wPhoto") ?? 0),
      wNotJaded: Number(formData.get("wNotJaded") ?? 0),
      wActivity: Number(formData.get("wActivity") ?? 0),
      wFollower: Number(formData.get("wFollower") ?? 0),
    },
  });
  revalidatePath("/profiles");
}

export async function createComplianceProfile(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("プロファイル名は必須です");
  await prisma.complianceProfile.create({
    data: {
      name,
      requirePr: formData.get("requirePr") === "on",
      requireRelation: formData.get("requireRelation") === "on",
      requireCta: formData.get("requireCta") === "on",
      ngWords: String(formData.get("ngWords") ?? "").trim() || null,
      okWords: String(formData.get("okWords") ?? "").trim() || null,
      extraNotes: String(formData.get("extraNotes") ?? "").trim() || null,
    },
  });
  revalidatePath("/profiles");
}

export async function updateComplianceProfile(id: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  await prisma.complianceProfile.update({
    where: { id },
    data: {
      name,
      requirePr: formData.get("requirePr") === "on",
      requireRelation: formData.get("requireRelation") === "on",
      requireCta: formData.get("requireCta") === "on",
      ngWords: String(formData.get("ngWords") ?? "").trim() || null,
      okWords: String(formData.get("okWords") ?? "").trim() || null,
      extraNotes: String(formData.get("extraNotes") ?? "").trim() || null,
    },
  });
  revalidatePath("/profiles");
}
