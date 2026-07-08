import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { EditTreasureForm } from "@/components/treasure/EditTreasureForm";
import { notFound, redirect } from "next/navigation";

export default async function EditTreasurePage({ params }: { params: { id: string } }) {
  const user = await getAuthUser();
  const supabase = createClient();

  const { data: treasure } = await supabase
    .from("treasures")
    .select("id, creator_id, title, hint, image_url, radius_meters, points_staked, status, rejection_reason")
    .eq("id", params.id)
    .single();

  if (!treasure) notFound();
  if (treasure.creator_id !== user!.id) redirect("/feed");
  if (treasure.status !== "rejected") redirect(`/treasure/${treasure.id}`);

  const { data: profile } = await supabase.from("profiles").select("points_balance").eq("id", user!.id).single();

  return <EditTreasureForm treasure={treasure} currentBalance={profile?.points_balance ?? 0} />;
}
