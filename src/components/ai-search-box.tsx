"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  tiktok: "TikTok",
};

interface SearchResult {
  id: number;
  platform: string;
  username: string;
  displayName: string | null;
  genreTags: string | null;
  followers: number | null;
  engagementRate: number | null;
}

export function AiSearchBox() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "検索に失敗しました");
      setResults(json.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "検索に失敗しました");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-indigo-900">
        <Sparkles className="size-4" /> AI自然言語検索
      </div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="例: 40代女性フォロワーで暮らし系、写真がきれいでPR慣れしていない人"
          className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={loading}
          className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? "検索中..." : "AI検索"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {results && (
        <div className="mt-3">
          <p className="text-xs text-slate-500 mb-2">{results.length}件ヒット</p>
          <ul className="space-y-1">
            {results.map((r) => (
              <li key={r.id} className="text-sm">
                <Link href={`/influencers/${r.id}`} className="text-indigo-700 hover:underline">
                  @{r.username}
                </Link>
                <span className="text-slate-500 ml-2">
                  {PLATFORM_LABELS[r.platform] ?? r.platform}
                  {r.displayName ? ` ・ ${r.displayName}` : ""}
                  {r.genreTags ? ` ・ ${r.genreTags}` : ""}
                  {r.followers ? ` ・ ${r.followers.toLocaleString()}フォロワー` : ""}
                </span>
              </li>
            ))}
            {results.length === 0 && <li className="text-sm text-slate-400">該当なし</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
