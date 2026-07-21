"use client";

import { useTransition } from "react";
import { toggleUsedInAds } from "@/app/assets/actions";

export function UsedInAdsToggle({ postId, usedInAds }: { postId: number; usedInAds: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
      <input
        type="checkbox"
        defaultChecked={usedInAds}
        disabled={pending}
        onChange={(e) => startTransition(() => toggleUsedInAds(postId, e.target.checked))}
      />
      広告二次利用済み
    </label>
  );
}
