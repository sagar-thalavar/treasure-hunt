"use client";

import { cn } from "@/lib/utils";
import { getExplorerLevel } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/types";
import Image from "next/image";

interface Props { leaderboard: LeaderboardEntry[]; currentUserId: string; userEntry: LeaderboardEntry | null; }

const podiumConfig = [
  { bg: "bg-amber-50",  border: "border-amber-300", text: "text-amber-700",  emoji: "🥇", size: "w-16 h-16", scale: "" },
  { bg: "bg-ink-50",    border: "border-ink-200",   text: "text-ink-400",    emoji: "🥈", size: "w-14 h-14", scale: "mb-4" },
  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-600", emoji: "🥉", size: "w-12 h-12", scale: "mb-6" },
];
const podiumOrder = [1, 0, 2]; // display order: 2nd, 1st, 3rd

export function LeaderboardView({ leaderboard, currentUserId, userEntry }: Props) {
  const top3 = leaderboard.slice(0, 3);
  const rest  = leaderboard.slice(3);

  return (
    <div className="h-full overflow-y-auto bg-ink-50">
      {/* Header */}
      <div className="bg-white border-b border-ink-200 px-4 pt-6 pb-5 text-center">
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-2xl font-black text-ink-700">Leaderboard</h1>
        <p className="text-ink-400 text-sm mt-0.5">World's greatest explorers</p>
      </div>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="bg-white border-b border-ink-200 px-4 py-8">
          <div className="flex items-end justify-center gap-4">
            {podiumOrder.map(idx => {
              const entry = top3[idx];
              if (!entry) return <div key={idx} className="w-20" />;
              const cfg = podiumConfig[idx];
              const isMe = entry.player_id === currentUserId;
              return (
                <div key={entry.player_id} className={cn("flex flex-col items-center", cfg.scale)}>
                  <span className="text-2xl mb-2">{cfg.emoji}</span>
                  <div className={cn(
                    "rounded-full border-2 flex items-center justify-center overflow-hidden mb-2",
                    cfg.size, cfg.bg, cfg.border,
                    isMe && "ring-2 ring-ink-700 ring-offset-2"
                  )}>
                    {entry.avatar_url
                      ? <Image src={entry.avatar_url} alt={entry.username} width={64} height={64} className="w-full h-full object-cover" />
                      : <span className="text-2xl">🧭</span>
                    }
                  </div>
                  <p className={cn("text-xs font-bold text-center truncate max-w-[72px]", isMe ? "text-ink-700" : cfg.text)}>{entry.username}</p>
                  <p className="text-ink-200 text-xs">{entry.xp.toLocaleString()} XP</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-2.5 max-w-lg mx-auto">
        {/* Your rank (if outside top 3) */}
        {userEntry && Number(userEntry.rank) > 3 && (
          <div className="card p-3.5 border-ink-700 bg-ink-700 text-white flex items-center gap-3 mb-4">
            <span className="font-black text-xl w-8 text-center text-ink-50">#{userEntry.rank}</span>
            <div className="flex-1">
              <p className="font-bold text-sm text-ink-50">{userEntry.username} <span className="opacity-60 font-normal">(You)</span></p>
              <p className="text-xs opacity-60">{getExplorerLevel(userEntry.xp)}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm text-ink-50">{userEntry.xp.toLocaleString()} XP</p>
              <p className="text-xs opacity-60">{userEntry.claim_count} 💎</p>
            </div>
          </div>
        )}

        {leaderboard.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🏴‍☠️</div>
            <p className="text-ink-700 font-bold">No explorers yet</p>
            <p className="text-ink-400 text-sm mt-1">Claim a treasure to get on the board!</p>
          </div>
        ) : (
          rest.map(entry => {
            const isMe = entry.player_id === currentUserId;
            return (
              <div key={entry.player_id} className={cn(
                "card p-3.5 flex items-center gap-3 transition-all",
                isMe && "border-ink-700 bg-ink-50"
              )}>
                <span className="text-ink-200 font-bold text-sm w-6 text-center">{entry.rank}</span>
                <div className="w-9 h-9 rounded-full bg-ink-50 border border-ink-200 flex items-center justify-center overflow-hidden shrink-0">
                  {entry.avatar_url
                    ? <Image src={entry.avatar_url} alt={entry.username} width={36} height={36} className="w-full h-full object-cover" />
                    : <span className="text-base">🧭</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold truncate", isMe ? "text-ink-700" : "text-ink-700")}>
                    {entry.username}{isMe && <span className="text-ink-400 font-normal"> (You)</span>}
                  </p>
                  <p className="text-ink-200 text-xs">{getExplorerLevel(entry.xp)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("font-bold text-sm", isMe ? "text-ink-700" : "text-ink-400")}>{entry.xp.toLocaleString()} XP</p>
                  <p className="text-ink-200 text-xs">{entry.claim_count} 💎</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
