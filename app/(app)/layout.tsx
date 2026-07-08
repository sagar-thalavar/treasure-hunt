import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { NavBar } from "@/components/nav/NavBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return (
    <div className="h-app-screen flex flex-col bg-ink-50 max-w-2xl mx-auto">
      <main className="flex-1 overflow-hidden relative">{children}</main>
      <NavBar userId={user.id} />
    </div>
  );
}
