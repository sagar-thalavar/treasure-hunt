import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/auth-user";

export default async function Home() {
  const user = await getAuthUser();

  if (user) {
    redirect("/feed");
  } else {
    redirect("/login");
  }
}
