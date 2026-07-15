"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Treasure } from "@/lib/types";
import { Coins, CheckCircle2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

type SortOrder = "newest" | "points_high" | "points_low";

const sortOptions: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "points_high", label: "Points: High to Low" },
  { value: "points_low", label: "Points: Low to High" },
];

export function FeedView() {
  const searchParams = useSearchParams();
  const justSubmitted = searchParams.get("submitted") === "1";

  const [sort, setSort] = useState<SortOrder>("newest");
  const [showSort, setShowSort] = useState(false);

  const supabase = createClient();

  const { data: treasures = [], isLoading } = useQuery({
    queryKey: ["feed-treasures"],
    queryFn: async () => {
      // Note: the "approved treasures viewable by authenticated users" RLS
      // policy already excludes anything still pending/rejected, and never
      // returns latitude/longitude usage in the UI below — the location
      // travels with the row but is intentionally never rendered here.
      const { data, error } = await supabase
        .from("treasures")
        .select("id, title, hint, points_staked, image_url, claimed_by, claimed_at, created_at, creator:profiles!treasures_creator_id_fkey(username, avatar_url)")
        .eq("status", "approved")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Treasure[];
    },
  });

  const sorted = [...treasures].sort((a, b) => {
    if (sort === "points_high") return b.points_staked - a.points_staked;
    if (sort === "points_low") return a.points_staked - b.points_staked;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="h-full overflow-y-auto bg-ink-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-ink-200 px-4 py-3.5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-ink-700">Discover</h1>
          <p className="text-xs text-ink-200">{sorted.length} treasures to find</p>
        </div>
        <button
          onClick={() => setShowSort(!showSort)}
          className={cn(
            "w-9 h-9 rounded-xl border flex items-center justify-center transition-all",
            showSort ? "bg-ink-700 border-ink-700 text-white" : "bg-white border-ink-200 text-ink-400 hover:border-ink-400"
          )}
        >
          <SlidersHorizontal size={15} />
        </button>
      </div>

      {showSort && (
        <div className="flex gap-2 flex-wrap px-4 py-3 bg-white border-b border-ink-200">
          {sortOptions.map(opt => (
            <button key={opt.value}
              onClick={() => { setSort(opt.value); setShowSort(false); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                sort === opt.value
                  ? "bg-ink-700 text-ink-50 border-ink-700"
                  : "bg-white text-ink-400 border-ink-200 hover:border-ink-400"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {justSubmitted && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-xl">
          Submitted! It'll show up here once an admin approves it.
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {isLoading ? (
          <p className="text-ink-200 text-sm text-center py-10">Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🗺️</div>
            <p className="text-ink-700 font-semibold">No treasures yet</p>
            <p className="text-ink-200 text-sm mt-1">Be the first to hide one!</p>
          </div>
        ) : (
          sorted.map((t) => {
            const found = !!t.claimed_by;
            return (
              <Link key={t.id} href={`/treasure/${t.id}`}
                className="block card overflow-hidden hover:border-ink-400 transition-all duration-150">
                <div className="relative aspect-square bg-ink-50">
                  {t.image_url ? (
                    <Image src={t.image_url} alt={t.title} fill sizes="(max-width: 512px) 100vw, 512px"
                      className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">💎</div>
                  )}
                  {found && (
                    <div className="absolute top-3 right-3 bg-white/95 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-card">
                      <CheckCircle2 size={12} /> Found
                    </div>
                  )}
                </div>
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink-700 font-bold text-sm truncate">{t.title}</p>
                    {t.creator && (
                      <p className="text-ink-200 text-xs mt-0.5">by {(t.creator as { username: string }).username}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-ink-700 font-bold text-sm bg-ink-50 border border-ink-200 rounded-full px-2.5 py-1">
                    <Coins size={13} /> {t.points_staked}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
