import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { AdminQueue } from "@/components/admin/AdminQueue";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const user = await getAuthUser();
  const supabase = createClient();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (profile?.role !== "admin") redirect("/feed");

  // Admin is one of the only contexts allowed to see the real location —
  // needed to judge whether a submission is genuine, safe, and appropriate.
  const { data: treasures } = await supabase
    .from("treasures")
    .select(
      "id, title, hint, image_url, points_staked, radius_meters, latitude, longitude, created_at, creator:profiles!treasures_creator_id_fkey(username, avatar_url)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return <AdminQueue treasures={(treasures ?? []) as never} />;
}
