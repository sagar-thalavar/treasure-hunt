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
  const { data: treasure } = await supabase
    .from("treasures")
    .select(
      "id, creator_id, title, hint, points_staked, radius_meters, image_url, status, is_active, claimed_by, claimed_at, created_at, creator:profiles!treasures_creator_id_fkey(username, avatar_url)"
    )
    .eq("id", params.id)
    .single();

  if (!treasure) notFound();

  // The finder's own claim on this treasure, whatever state it's in.
  const { data: existingClaim } = await supabase
    .from("claims")
    .select("id, status, rejection_reason, claimed_at")
    .eq("treasure_id", params.id)
    .eq("player_id", user!.id)
    .maybeSingle();

  const { count: claimAttempts } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("treasure_id", params.id);

  return (
    <TreasureDetail
      treasure={{ ...treasure, claim_count: claimAttempts ?? 0 } as never}
      userId={user!.id}
      isCreator={treasure.creator_id === user!.id}
      existingClaim={existingClaim ?? null}
    />
  );
}
