import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { ProfileView } from "@/components/profile/ProfileView";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const supabase = createClient();

  // All four fetches are independent — run them concurrently instead of
  // paying four sequential round trips. ensureProfile self-heals accounts
  // that have no profile row yet (created before the handle_new_user
  // trigger / backfill) instead of showing "Profile not found".
  const [profile, { data: claims }, { data: playerBadges }, { data: createdTreasures }] =
    await Promise.all([
      ensureProfile(supabase),
      supabase
        .from("claims")
        .select("*, treasure:treasures!claims_treasure_id_fkey(title)")
        .eq("player_id", user.id)
        .order("claimed_at", { ascending: false })
        .limit(20),
      supabase
        .from("player_badges")
        .select("*, badge:badges(*)")
        .eq("player_id", user.id),
      supabase
        .from("treasures")
        .select("id, title, status, rejection_reason, points_staked, claimed_by")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return (
    <ProfileView
      profile={profile}
      claims={claims ?? []}
      playerBadges={playerBadges ?? []}
      createdTreasures={createdTreasures ?? []}
      userId={user.id}
    />
  );
}
