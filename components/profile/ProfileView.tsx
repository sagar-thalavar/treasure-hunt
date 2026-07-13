"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Claim, PlayerBadge } from "@/lib/types";
import { getExplorerLevel } from "@/lib/utils";
import { LogOut, Map, Shield, Star, Coins, PencilLine, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Image from "next/image";

const LEVEL_THRESHOLDS = [0, 100, 300, 700, 1500, 3000, 6000];
const LEVEL_ICONS = ["🌱","🧭","🗺️","⚔️","🏴‍☠️","👑","🌍"];

interface CreatedTreasure {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  points_staked: number;
  claimed_by: string | null;
}

interface Props {
  profile: Profile | null; claims: Claim[]; playerBadges: PlayerBadge[];
  createdTreasures: CreatedTreasure[]; userId: string;
}

export function ProfileView({ profile, claims, playerBadges, createdTreasures, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"activity"|"badges"|"created">("activity");

  const xp = profile?.xp ?? 0;
  const levelIdx = LEVEL_THRESHOLDS.findLastIndex(t => xp >= t);
  const prevXp = LEVEL_THRESHOLDS[levelIdx] ?? 0;
  const nextXp = LEVEL_THRESHOLDS[levelIdx + 1] ?? prevXp;
  const pct = nextXp === prevXp ? 100 : Math.round(((xp - prevXp) / (nextXp - prevXp)) * 100);

  async function signOut() { await supabase.auth.signOut(); router.push("/login"); router.refresh(); }

  if (!profile) return (
    <div className="h-full flex items-center justify-center text-ink-200 text-sm">Profile not found.</div>
  );

  return (
    <div className="h-full overflow-y-auto bg-ink-50">
      {/* Header */}
      <div className="bg-white border-b border-ink-200 px-4 pt-6 pb-5">
        <div className="flex items-start justify-between mb-5 max-w-lg mx-auto">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-ink-50 border-2 border-ink-200 flex items-center justify-center overflow-hidden shadow-card">
              {profile.avatar_url
                ? <Image src={profile.avatar_url} alt={profile.username} width={64} height={64} className="w-full h-full object-cover" />
                : <span className="text-3xl">{LEVEL_ICONS[levelIdx]}</span>
              }
            </div>
            <div>
              <h1 className="text-xl font-black text-ink-700">{profile.username}</h1>
              <p className="text-ink-400 text-sm font-medium">{getExplorerLevel(xp)}</p>
              <p className="text-ink-200 text-xs">Level {levelIdx + 1}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {profile.role === "admin" && (
              <Link href="/admin" title="Admin panel"
                className="w-9 h-9 rounded-full bg-amber-400 text-ink-700 flex items-center justify-center shadow-card border border-amber-500/40 hover:scale-110 active:scale-95 transition-transform">
                <Shield size={16} strokeWidth={2.5} />
              </Link>
            )}
            <button onClick={signOut} className="p-2 rounded-xl hover:bg-ink-50 text-ink-200 hover:text-red-400 transition-colors border border-transparent hover:border-ink-200">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* XP bar */}
        <div className="mb-5 max-w-lg mx-auto">
          <div className="flex justify-between text-xs text-ink-400 mb-1.5 font-medium">
            <span>{xp.toLocaleString()} XP</span>
            <span>{nextXp > prevXp ? `${nextXp.toLocaleString()} to next level` : "Max level reached!"}</span>
          </div>
          <div className="w-full bg-ink-50 border border-ink-200 rounded-full h-2.5">
            <div className="h-2.5 rounded-full bg-ink-700 transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 max-w-lg mx-auto">
          {[
            { emoji: "🪙", label: "Points",  value: profile.points_balance },
            { emoji: "💎", label: "Claims",  value: claims.length },
            { emoji: "🏴‍☠️", label: "Created", value: createdTreasures.length },
            { emoji: "🏅", label: "Badges",  value: playerBadges.length },
          ].map(s => (
            <div key={s.label} className="bg-ink-50 border border-ink-200 rounded-xl p-3 text-center">
              <div className="text-xl mb-1">{s.emoji}</div>
              <div className="text-ink-700 font-bold text-sm">{s.value}</div>
              <div className="text-ink-200 text-[10px] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-ink-200 px-4 max-w-lg mx-auto">
        {([
          { id: "activity", label: "Activity", icon: Map },
          { id: "badges",   label: "Badges",   icon: Shield },
          { id: "created",  label: "Created",  icon: Star },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-all",
              tab === id ? "border-ink-700 text-ink-700" : "border-transparent text-ink-200 hover:text-ink-400"
            )}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-2.5 max-w-lg mx-auto">
        {tab === "activity" && (
          claims.length === 0 ? <Empty emoji="🗺️" title="No claims yet" sub="Go find your first treasure!" /> :
          claims.map(c => {
            const t = c.treasure as { title?: string } | undefined;
            return (
              <div key={c.id} className="card p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ink-50 border border-ink-200 flex items-center justify-center text-xl shrink-0">💎</div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink-700 text-sm font-semibold truncate">{t?.title ?? "Treasure"}</p>
                  <p className="text-ink-200 text-xs mt-0.5">{format(new Date(c.claimed_at), "MMM d, yyyy")}</p>
                </div>
                <StatusPill status={c.status} />
              </div>
            );
          })
        )}

        {tab === "badges" && (
          playerBadges.length === 0 ? <Empty emoji="🏅" title="No badges yet" sub="Keep exploring to earn badges!" /> :
          <div className="grid grid-cols-2 gap-3">
            {playerBadges.map(pb => {
              const b = pb.badge as { name?: string; description?: string } | undefined;
              return (
                <div key={pb.badge_id} className="card p-4 text-center">
                  <div className="text-3xl mb-2">🏅</div>
                  <p className="text-ink-700 text-sm font-bold">{b?.name}</p>
                  <p className="text-ink-200 text-xs mt-1">{b?.description}</p>
                </div>
              );
            })}
          </div>
        )}

        {tab === "created" && (
          createdTreasures.length === 0 ? <Empty emoji="🏴‍☠️" title="No treasures created" sub="Hide your first treasure for others!" /> :
          createdTreasures.map(t => (
            <div key={t.id} className="card p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ink-50 border border-ink-200 flex items-center justify-center text-xl shrink-0">🏴‍☠️</div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink-700 text-sm font-semibold truncate">{t.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-ink-200 text-xs flex items-center gap-1"><Coins size={11} /> {t.points_staked}</span>
                    {t.claimed_by && <span className="text-green-600 text-xs font-semibold">· Found</span>}
                  </div>
                </div>
                <StatusPill status={t.status} />
              </div>
              {t.status === "rejected" && (
                <Link href={`/treasure/${t.id}/edit`}
                  className="mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-ink-200 text-ink-700 hover:border-ink-400 transition-all">
                  <PencilLine size={13} /> Fix & Resubmit
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "approved") return (
    <span className="shrink-0 text-green-600 text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12} /> Approved</span>
  );
  if (status === "rejected") return (
    <span className="shrink-0 text-red-500 text-xs font-bold flex items-center gap-1"><XCircle size={12} /> Rejected</span>
  );
  return (
    <span className="shrink-0 text-amber-600 text-xs font-bold flex items-center gap-1"><Clock size={12} /> Pending</span>
  );
}

function Empty({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="text-center py-14">
      <div className="text-5xl mb-3">{emoji}</div>
      <p className="text-ink-700 font-semibold">{title}</p>
      <p className="text-ink-200 text-sm mt-1">{sub}</p>
    </div>
  );
}
