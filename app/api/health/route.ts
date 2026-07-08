import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, { ok: boolean; detail: string }> = {};

  // 1. Check env vars
  results.env = {
    ok: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    detail: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`
      : "MISSING — check .env.local",
  };

  // 2. Check Supabase connection
  try {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (error) {
      results.database = {
        ok: false,
        detail: error.message.includes("relation")
          ? "SQL schema not run yet — go to Supabase SQL Editor and run 001_initial_schema.sql"
          : error.message,
      };
    } else {
      results.database = { ok: true, detail: "Connected and schema exists" };
    }
  } catch (e) {
    results.database = {
      ok: false,
      detail: e instanceof Error ? e.message : "Unknown connection error",
    };
  }

  // 3. Check auth is reachable
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    results.auth = {
      ok: !error,
      detail: error ? error.message : "Auth service reachable",
    };
  } catch (e) {
    results.auth = {
      ok: false,
      detail: e instanceof Error ? e.message : "Auth unreachable",
    };
  }

  // 4. Check storage bucket (list files — works with anon key)
  try {
    const supabase = createClient();
    const { error } = await supabase.storage.from("treasure-images").list("", { limit: 1 });
    results.storage = {
      ok: !error,
      detail: error
        ? `Bucket issue: ${error.message}`
        : "Bucket 'treasure-images' exists and accessible",
    };
  } catch (e) {
    results.storage = {
      ok: false,
      detail: e instanceof Error ? e.message : "Storage check failed",
    };
  }

  const allOk = Object.values(results).every((r) => r.ok);

  return NextResponse.json(
    { status: allOk ? "healthy" : "issues_found", checks: results },
    { status: allOk ? 200 : 207 }
  );
}
