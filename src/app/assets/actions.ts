"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function toggleUsedInAds(postId: number, usedInAds: boolean) {
  await prisma.post.update({ where: { id: postId }, data: { usedInAds } });
  revalidatePath("/assets");
}
