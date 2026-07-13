import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

/**
 * Returns the current user's profile row, creating it if it doesn't exist.
 *
 * Normally `handle_new_user()` (see 001/005 migrations) creates the profile
 * the moment the auth user is inserted. But accounts created *before* that
 * trigger existed — or before a migration was applied to the live database —
 * have an auth.users row with no matching profile, and every page that
 * assumes a profile exists breaks ("Profile not found"). The 003 backfill
 * migration fixes this in bulk, but this helper makes the app self-heal per
 * user so a missed backfill can never lock someone out.
 *
 * Mirrors the trigger's username logic: display name → email prefix →
 * "explorer", de-duplicated with a suffix on collision (profiles.username
 * is UNIQUE). New rows get the 500-point starting balance from the column
 * default. RLS allows this insert ("Users can insert their own profile.").
 */
export async function ensureProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return existing as Profile;

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const base =
    meta.full_name?.trim() || user.email?.split("@")[0] || "explorer";

  for (let attempt = 0; attempt < 4; attempt++) {
    const username =
      attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: created, error } = await supabase
      .from("profiles")
      .insert({ id: user.id, username, avatar_url: meta.avatar_url ?? null })
      .select("*")
      .single();
    if (created) return created as Profile;

    // 23505 = unique_violation. If the username collided, retry with a
    // suffix; if the id collided a concurrent request already created the
    // profile — just return that row.
    if (error?.code === "23505") {
      const { data: raced } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (raced) return raced as Profile;
      continue;
    }
    break;
  }
  return null;
}
