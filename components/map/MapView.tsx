"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Treasure } from "@/lib/types";
import { getDifficultyColor, getDistanceMeters, formatDistance } from "@/lib/utils";
import { Navigation2, SlidersHorizontal, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-ink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">🗺️</div>
        <p className="text-ink-400 text-sm font-medium">Loading map…</p>
      </div>
    </div>
  ),
});

type DifficultyFilter = "all" | "easy" | "medium" | "hard" | "legendary";

export function MapView({ userId }: { userId: string }) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    );
  }, []);

  const { data: treasures = [], isLoading } = useQuery({
    queryKey: ["treasures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasures")
        .select("id, title, description, reward_type, reward_description, reward_value, latitude, longitude, difficulty, radius_meters, expiry_date, image_url, visibility, is_active, created_at, creator_id")
        .eq("is_active", true)
        .eq("visibility", "public");
      if (error) throw error;
      return data as Treasure[];
    },
  });

  const filtered = treasures.filter((t) => {
    const matchDiff = difficultyFilter === "all" || t.difficulty === difficultyFilter;
    const matchSearch = !searchQuery ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchDiff && matchSearch;
  });

  const sorted = userLocation
    ? [...filtered].sort((a, b) =>
        getDistanceMeters(userLocation.lat, userLocation.lng, a.latitude, a.longitude) -
        getDistanceMeters(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
      )
    : filtered;

  const chips: DifficultyFilter[] = ["all", "easy", "medium", "hard", "legendary"];

  return (
    <div className="relative h-full w-full">
      {/* Search bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-2">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-200 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search treasures…"
            className="w-full bg-white border border-ink-200 text-ink-700 placeholder-ink-200 rounded-xl pl-10 pr-9 py-2.5 text-sm shadow-card focus:outline-none focus:ring-2 focus:ring-ink-400 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-200 hover:text-ink-400">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "w-10 h-10 rounded-xl border flex items-center justify-center shadow-card transition-all",
            showFilters ? "bg-ink-700 border-ink-700 text-white" : "bg-white border-ink-200 text-ink-400 hover:border-ink-400"
          )}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Difficulty filter chips */}
      {showFilters && (
        <div className="absolute top-[68px] left-4 right-4 z-[1000] flex gap-2 flex-wrap">
          {chips.map((d) => (
            <button key={d}
              onClick={() => setDifficultyFilter(d)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold capitalize border transition-all shadow-sm",
                difficultyFilter === d
                  ? "bg-ink-700 text-ink-50 border-ink-700"
                  : "bg-white text-ink-400 border-ink-200 hover:border-ink-400"
              )}
            >
              {d === "all" ? "All difficulties" : d}
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div className="absolute inset-0">
        <LeafletMap treasures={sorted} userLocation={userLocation} />
      </div>

      {/* Nearby list */}
      <div className="absolute bottom-4 left-4 right-4 z-[1000]">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-ink-700 uppercase tracking-widest">
              Nearby · {sorted.length}
            </span>
            {userLocation && (
              <span className="text-xs text-ink-400 flex items-center gap-1 font-medium">
                <Navigation2 size={11} /> Live
              </span>
            )}
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mb-1 scrollbar-none">
            {isLoading ? (
              <p className="text-ink-200 text-sm py-1">Loading…</p>
            ) : sorted.length === 0 ? (
              <p className="text-ink-200 text-sm py-1">No treasures here yet. Be the first!</p>
            ) : (
              sorted.slice(0, 8).map((t) => {
                const dist = userLocation
                  ? getDistanceMeters(userLocation.lat, userLocation.lng, t.latitude, t.longitude)
                  : null;
                return (
                  <Link key={t.id} href={`/treasure/${t.id}`}
                    className="flex-shrink-0 w-36 bg-ink-50 hover:bg-white rounded-xl p-3 border border-ink-200 hover:border-ink-400 transition-all duration-150 group">
                    <div className="text-xl mb-2">💎</div>
                    <div className="text-ink-700 text-xs font-bold truncate leading-tight mb-1">{t.title}</div>
                    <div className={cn("chip text-[10px] capitalize mb-1.5",
                      t.difficulty === "easy" && "chip-easy",
                      t.difficulty === "medium" && "chip-medium",
                      t.difficulty === "hard" && "chip-hard",
                      t.difficulty === "legendary" && "chip-legendary",
                    )}>
                      {t.difficulty}
                    </div>
                    {dist !== null && (
                      <div className="text-ink-200 text-[10px] flex items-center gap-1 font-medium">
                        <Navigation2 size={9} /> {formatDistance(dist)}
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
