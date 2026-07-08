import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export default async function LeaderboardPage() {
  const user = await getAuthUser();
  const supabase = createClient();

  // Get leaderboard (top 50)
  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("*")
    .limit(50);

  // Get current user's rank
  const userEntry = leaderboard?.find((e) => e.player_id === user?.id) ?? null;

  return (
    <LeaderboardView
      leaderboard={leaderboard ?? []}
      currentUserId={user?.id ?? ""}
      userEntry={userEntry}
    />
  );
}
