"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCampaign(brandId: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();
  const targetCountRaw = String(formData.get("targetCount") ?? "").trim();
  const budgetYenRaw = String(formData.get("budgetYen") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();

  if (!name || !goal) throw new Error("施策名と目的は必須です");

  const campaign = await prisma.campaign.create({
    data: {
      brandId,
      name,
      goal,
      targetCount: targetCountRaw ? Number(targetCountRaw) : null,
      budgetYen: budgetYenRaw ? Number(budgetYenRaw) : null,
      startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
      endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
    },
  });
  revalidatePath(`/brands/${brandId}`);
  redirect(`/campaigns/${campaign.id}`);
}

export async function updateCampaignStatus(campaignId: number, brandId: number, formData: FormData) {
  const status = String(formData.get("status") ?? "").trim();
  await prisma.campaign.update({ where: { id: campaignId }, data: { status } });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/brands/${brandId}`);
}

export async function updateCampaign(campaignId: number, brandId: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();
  const targetCountRaw = String(formData.get("targetCount") ?? "").trim();
  const budgetYenRaw = String(formData.get("budgetYen") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();

  if (!name || !goal) throw new Error("施策名と目的は必須です");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      name,
      goal,
      targetCount: targetCountRaw ? Number(targetCountRaw) : null,
      budgetYen: budgetYenRaw ? Number(budgetYenRaw) : null,
      startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
      endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
    },
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/brands/${brandId}`);
}
