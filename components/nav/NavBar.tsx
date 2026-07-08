"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Compass, Plus, Bell, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/feed",        icon: Compass, label: "Feed" },
  { href: "/claims",      icon: Bell,    label: "Claims" },
  { href: "/create",      icon: Plus,    label: "Create" },
  { href: "/leaderboard", icon: Trophy,  label: "Ranks" },
  { href: "/profile",     icon: User,    label: "Profile" },
];

export function NavBar({ userId }: { userId: string }) {
  const pathname = usePathname();
  const supabase = createClient();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-claims-count", userId],
    queryFn: async () => {
      const { data: myTreasures } = await supabase.from("treasures").select("id").eq("creator_id", userId);
      const ids = (myTreasures ?? []).map((t) => t.id);
      if (ids.length === 0) return 0;
      const { count } = await supabase
        .from("claims")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .in("treasure_id", ids);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  return (
    <nav className="bg-white border-t border-ink-200 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="relative flex flex-col items-center gap-1 px-3 py-2 min-w-[56px]">
              {href === "/create" ? (
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-150 shadow-btn",
                  active ? "bg-ink-700 text-ink-50" : "bg-ink-700 text-ink-50 hover:bg-ink-900"
                )}>
                  <Icon size={22} />
                </div>
              ) : (
                <div className="relative">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150",
                    active ? "bg-ink-50 text-ink-700" : "text-ink-200 hover:text-ink-400"
                  )}>
                    <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                  </div>
                  {href === "/claims" && pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  )}
                </div>
              )}
              <span className={cn(
                "text-[10px] font-semibold tracking-wide",
                active ? "text-ink-700" : "text-ink-200"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
