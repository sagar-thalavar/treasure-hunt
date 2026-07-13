import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { AdminQueue } from "@/components/admin/AdminQueue";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const user = await getAuthUser();
  const supabase = createClient();

  // Role check and queue fetch run concurrently; RLS already hides other
  // creators' pending treasures from non-admins, so nothing leaks if the
  // redirect fires — the wasted query is just discarded.
  //
  // Admin is one of the only contexts allowed to see the real location —
  // needed to judge whether a submission is genuine, safe, and appropriate.
  const [{ data: profile }, { data: treasures }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase
      .from("treasures")
      .select(
        "id, title, hint, image_url, points_staked, radius_meters, latitude, longitude, created_at, creator:profiles!treasures_creator_id_fkey(username, avatar_url)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);
  if (profile?.role !== "admin") redirect("/feed");

  return <AdminQueue treasures={(treasures ?? []) as never} />;
}
