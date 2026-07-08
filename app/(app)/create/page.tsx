import { CreateTreasureForm } from "@/components/treasure/CreateTreasureForm";
import { getAuthUser } from "@/lib/supabase/auth-user";

export default async function CreatePage() {
  const user = await getAuthUser();

  return (
    <div className="h-full overflow-y-auto">
      <CreateTreasureForm userId={user!.id} />
    </div>
  );
}
