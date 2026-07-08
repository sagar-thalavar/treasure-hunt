import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles email confirmation, password-reset, and magic-link links using
// Supabase's token_hash + verifyOtp flow instead of the PKCE `code` flow.
//
// Why: the PKCE flow used by /auth/callback requires the confirmation link
// to be opened in the *same browser* that started signUp(), because the
// code_verifier it needs is stored in that browser only. On mobile this
// breaks constantly — tapping the email link from the Gmail/Outlook app
// opens an in-app browser with no access to that stored verifier, so the
// exchange fails silently. The token_hash flow has no such requirement: it
// works from any device/browser, which is what this route needs since most
// users will be confirming from their phone.
//
// Requires the Supabase Dashboard email templates (Confirm signup, Magic
// Link, Reset password) to link here with token_hash + type, e.g.:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/map
//
// NOTE: Supabase only lets you edit email template content once a custom
// SMTP provider is configured (Authentication → Emails → SMTP Settings).
// On the default/shared mailer, templates are locked to the built-in
// {{ .ConfirmationURL }} link, which uses the PKCE `code` flow instead —
// so right now signup emails are still handled by /auth/callback, and this
// route is dormant until custom SMTP is set up. Kept in place so it's a
// one-line email-template change away, with no code changes needed later.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/map";

  if (token_hash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const redirectTo = request.nextUrl.clone();
      redirectTo.pathname = next;
      redirectTo.search = "";
      return NextResponse.redirect(redirectTo);
    }
  }

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = "/login";
  redirectTo.search = "";
  redirectTo.searchParams.set("error", "confirmation_failed");
  return NextResponse.redirect(redirectTo);
}
