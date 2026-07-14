import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { ClaimsInbox } from "@/components/claims/ClaimsInbox";

export default async function ClaimsPage() {
  const user = await getAuthUser();
  const supabase = createClient();

  // Safety-net for the 48h auto-approve timeout — see
  // 006_v2_hidden_location_redesign.sql. Opportunistic, not a real cron
  // job, which is fine for a small pilot group. Runs concurrently with the
  // treasures lookup (it only mutates claims, which are fetched after both
  // finish, so its effects are still visible below).
  //
  // Two-step fetch (rather than filtering through a joined table) to keep
  // this on well-trodden query syntax: first find this creator's
  // treasures, then find pending claims against just those.
  const [, { data: myTreasures }] = await Promise.all([
    supabase.rpc("auto_approve_stale_claims"),
    supabase.from("treasures").select("id").eq("creator_id", user!.id),
  ]);
  const treasureIds = (myTreasures ?? []).map((t) => t.id);

  const claims = treasureIds.length === 0 ? [] : (
    await supabase
      .from("claims")
      .select(
        "id, treasure_id, player_id, photo_url, status, rejection_reason, claimed_at, treasure:treasures!claims_treasure_id_fkey(id, title, image_url, points_staked), player:profiles!claims_player_id_fkey(username, avatar_url)"
      )
      .in("treasure_id", treasureIds)
      .eq("status", "pending")
      .order("claimed_at", { ascending: true })
  ).data ?? [];

  // Claim photos live in a private bucket — generate short-lived signed
  // URLs server-side rather than ever exposing a public link to them.
  const withSignedUrls = await Promise.all(
    claims.map(async (c) => {
      let signedUrl: string | null = null;
      if (c.photo_url) {
        const { data, error } = await supabase.storage.from("claim-photos").createSignedUrl(c.photo_url, 60);
        if (error) {
          console.error(`Failed to generate signed URL for path "${c.photo_url}":`, error);
        }
        signedUrl = data?.signedUrl ?? null;
      }
      return { ...c, signedPhotoUrl: signedUrl };
    })
  );

  return <ClaimsInbox claims={withSignedUrls as never} />;
}
