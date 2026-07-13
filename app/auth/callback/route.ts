import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/map";
  let errorMsg = errorDescription || errorParam || "";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Guarantees a profile row exists before the user lands anywhere in
      // the app (covers accounts that predate the handle_new_user trigger).
      await ensureProfile(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Auth callback exchange error:", error);
    errorMsg = error.message;
  }

  const redirectUrl = new URL(`${origin}/login`);
  redirectUrl.searchParams.set("error", "auth_callback_error");
  if (errorMsg) {
    redirectUrl.searchParams.set("details", errorMsg);
  }
  return NextResponse.redirect(redirectUrl.toString());
}
