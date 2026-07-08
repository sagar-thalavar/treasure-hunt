import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Never trust a client-supplied identity header — always strip it first.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-email");

  // Supabase may refresh the session cookie while validating the user.
  // Collect those here and re-apply them to whichever response we end up
  // returning (redirect or next), instead of rebuilding the response object
  // multiple times and risking dropped cookies.
  const cookiesToForward: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToForward.push(...cookiesToSet);
        },
      },
    }
  );

  // This is the ONE network round-trip to Supabase's Auth server per
  // request. The validated user is forwarded to Server Components via
  // request headers below, so layouts/pages don't each need to re-validate
  // the same JWT again with their own network call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected routes
  const protectedPaths = ["/feed", "/map", "/create", "/profile", "/leaderboard", "/treasure", "/claims", "/admin"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  let response: NextResponse;

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    response = NextResponse.redirect(url);
  } else if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    response = NextResponse.redirect(url);
  } else {
    if (user) {
      requestHeaders.set("x-user-id", user.id);
      if (user.email) requestHeaders.set("x-user-email", user.email);
    }
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  cookiesToForward.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
