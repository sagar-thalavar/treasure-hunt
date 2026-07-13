import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { TreasureDetail } from "@/components/treasure/TreasureDetail";
import { notFound } from "next/navigation";

export default async function TreasurePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getAuthUser();
  const supabase = createClient();

  // Deliberately does NOT select latitude/longitude — those never need to
  // reach the browser. Proximity is checked via the check_treasure_proximity
  // RPC instead (see 007_hidden_proximity_check.sql).
  //
  // All three queries only depend on params/user, so they run concurrently
  // instead of paying three sequential round trips.
  const [{ data: treasure }, { data: existingClaim }, { count: claimAttempts }] =
    await Promise.all([
      supabase
        .from("treasures")
        .select(
          "id, creator_id, title, hint, points_staked, radius_meters, image_url, status, is_active, claimed_by, claimed_at, created_at, creator:profiles!treasures_creator_id_fkey(username, avatar_url)"
        )
        .eq("id", params.id)
        .single(),
      // The finder's own claim on this treasure, whatever state it's in.
      supabase
        .from("claims")
        .select("id, status, rejection_reason, claimed_at")
        .eq("treasure_id", params.id)
        .eq("player_id", user!.id)
        .maybeSingle(),
      supabase
        .from("claims")
        .select("id", { count: "exact", head: true })
        .eq("treasure_id", params.id),
    ]);

  if (!treasure) notFound();

  return (
    <TreasureDetail
      treasure={{ ...treasure, claim_count: claimAttempts ?? 0 } as never}
      userId={user!.id}
      isCreator={treasure.creator_id === user!.id}
      existingClaim={existingClaim ?? null}
    />
  );
}
