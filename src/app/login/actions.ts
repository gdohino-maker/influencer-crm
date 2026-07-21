"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/session";
import { isRateLimited, recordFailedAttempt, clearAttempts } from "@/lib/rate-limit";

async function getClientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const clientKey = await getClientKey();

  if (isRateLimited(clientKey)) {
    redirect(`/login?error=ratelimit&next=${encodeURIComponent(next)}`);
  }

  if (password !== process.env.APP_PASSWORD) {
    recordFailedAttempt(clientKey);
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  clearAttempts(clientKey);

  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect(next.startsWith("/") ? next : "/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/login");
}
