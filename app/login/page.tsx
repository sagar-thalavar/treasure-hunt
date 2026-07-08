"use client";

import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  confirmation_failed:
    "That sign-in link is invalid or has expired. Enter your email below and request a new one.",
  auth_callback_error:
    "That sign-in link didn't work — this usually happens when it's opened in a different browser/app than the one you requested it from (e.g. tapping it inside the Gmail app). Try opening the email's link in your regular browser instead, or request a new one below.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    const callbackError = searchParams.get("error");
    if (callbackError) {
      setError(CALLBACK_ERROR_MESSAGES[callbackError] ?? "Something went wrong. Please try again.");
    }
  }, [searchParams]);

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    // signInWithOtp handles both new and returning users — there's no
    // separate "sign up" step. First-time emails get an account created
    // automatically (via the handle_new_user trigger) the moment they
    // click the link.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/map` },
    });
    if (error) {
      setError(error.message);
    } else {
      setLinkSent(true);
      setMessage("Check your email for a sign-in link! Open it in this same browser for it to work.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-[100dvh] bg-ink-50 flex flex-col items-center justify-center px-4 py-8">
      {/* Hero */}
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white border border-ink-200 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 shadow-card">
            🗺️
          </div>
          <h1 className="text-3xl font-black text-ink-700 tracking-tight">Treasure Hunt</h1>
          <p className="text-ink-400 mt-2 text-sm">Explore the world. Find treasure. Earn rewards.</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-4">
          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-ink-200 text-ink-700 font-semibold py-3 px-4 rounded-xl hover:border-ink-400 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 shadow-card text-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-ink-200" />
            <span className="text-xs text-ink-200 font-medium">or</span>
            <div className="flex-1 h-px bg-ink-200" />
          </div>

          {/* Magic link email form — no password, no separate signup step */}
          <form onSubmit={handleMagicLink} className="space-y-3">
            <div>
              <label className="label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="you@example.com" required disabled={linkSent} />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-xl">
                {message}
              </div>
            )}

            {linkSent ? (
              <button
                type="button"
                onClick={() => { setLinkSent(false); setMessage(null); }}
                className="btn-secondary w-full"
              >
                Use a different email
              </button>
            ) : (
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Sending…" : "Send sign-in link"}
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-ink-200 text-xs mt-8">
          Every street is an island. Every city is an adventure.
        </p>
      </div>
    </div>
  );
}
