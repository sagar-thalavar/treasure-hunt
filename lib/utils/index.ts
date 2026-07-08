import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Difficulty, ExplorerLevel, RewardType } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Haversine distance in meters between two lat/lng points */
export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function getDifficultyColor(difficulty: Difficulty): string {
  return {
    easy: "text-emerald-400 bg-emerald-400/10",
    medium: "text-amber-400 bg-amber-400/10",
    hard: "text-orange-400 bg-orange-400/10",
    legendary: "text-purple-400 bg-purple-400/10",
  }[difficulty];
}

export function getDifficultyMarkerColor(difficulty: Difficulty): string {
  return {
    easy: "#10b981",
    medium: "#f59e0b",
    hard: "#f97316",
    legendary: "#a855f7",
  }[difficulty];
}

export function getRewardTypeLabel(type: RewardType): string {
  return {
    cash: "💰 Cash",
    coupon: "🎟 Coupon",
    collectible: "🏺 Collectible",
    digital: "💎 Digital Item",
    badge: "🏅 Badge",
    premium: "⭐ Premium Access",
    discount_code: "🏷 Discount Code",
    physical: "📦 Physical Reward",
    xp: "✨ XP Bonus",
  }[type];
}

export function getExplorerLevel(xp: number): ExplorerLevel {
  if (xp < 100) return "Beginner";
  if (xp < 300) return "Scout";
  if (xp < 700) return "Explorer";
  if (xp < 1500) return "Adventurer";
  if (xp < 3000) return "Master Explorer";
  if (xp < 6000) return "Legend";
  return "World Explorer";
}

export function getXpForNextLevel(xp: number): { current: number; next: number; label: ExplorerLevel } {
  const thresholds: [number, ExplorerLevel][] = [
    [100, "Scout"],
    [300, "Explorer"],
    [700, "Adventurer"],
    [1500, "Master Explorer"],
    [3000, "Legend"],
    [6000, "World Explorer"],
  ];
  for (const [threshold, label] of thresholds) {
    if (xp < threshold) return { current: xp, next: threshold, label };
  }
  return { current: xp, next: xp, label: "World Explorer" };
}

export function getXpReward(action: "claim" | "create" | "daily" | "invite"): number {
  return { claim: 50, create: 25, daily: 10, invite: 100 }[action];
}
