"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, SlidersHorizontal, Users, Sparkles, LogOut, Plus, Images } from "lucide-react";

const NAV = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/clients", label: "クライアント/ブランド", icon: Building2 },
  { href: "/profiles", label: "プロファイル設定", icon: SlidersHorizontal },
  { href: "/influencers", label: "インフルエンサー", icon: Users },
  { href: "/assets", label: "二次利用素材", icon: Images },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
        <Sparkles className="size-5 text-indigo-600" />
        <span className="font-bold text-slate-900 tracking-tight">Influencer CRM</span>
      </div>
      <div className="px-3 pt-4">
        <Link
          href="/start"
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-sm shadow-indigo-200 transition-colors"
        >
          <Plus className="size-4" /> 新しく探す
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-slate-200">
        <a
          href="/api/logout"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        >
          <LogOut className="size-4" /> ログアウト
        </a>
        <p className="px-3 mt-2 text-xs text-slate-400">PureFlat 社内利用ツール</p>
      </div>
    </aside>
  );
}
