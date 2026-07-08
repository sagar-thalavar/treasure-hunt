import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * Returns the current authenticated user's id/email for Server Components,
 * without making a redundant network round-trip to Supabase's Auth server.
 *
 * `middleware.ts` already calls `supabase.auth.getUser()` once per request
 * (to enforce route protection) and forwards the validated identity via the
 * `x-user-id` / `x-user-email` request headers. Server Components under
 * routes covered by the middleware matcher can just read those headers.
 *
 * Falls back to a real `getUser()` call if the headers are missing (e.g. a
 * route not covered by the matcher, or local tooling that bypasses
 * middleware), so this is always safe to call.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const headerList = headers();
  const id = headerList.get("x-user-id");
  if (id) {
    return { id, email: headerList.get("x-user-email") };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { id: user.id, email: user.email ?? null } : null;
}
