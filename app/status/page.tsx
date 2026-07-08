"use client";

import { useEffect, useState } from "react";

interface Check {
  ok: boolean;
  detail: string;
}

interface HealthResult {
  status: string;
  checks: {
    env?: Check;
    database?: Check;
    auth?: Check;
    storage?: Check;
  };
}

const labels: Record<string, string> = {
  env: "Environment Variables",
  database: "Database (Supabase)",
  auth: "Authentication",
  storage: "Storage Bucket",
};

export default function StatusPage() {
  const [data, setData] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchHealth() {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchHealth(); }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "#0a0f1e" }}
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🩺</div>
          <h1 className="text-2xl font-black text-white">System Health Check</h1>
          <p className="text-slate-400 text-sm mt-1">Verifying all connections</p>
        </div>

        {loading ? (
          <div className="text-center text-slate-400">Running checks…</div>
        ) : !data ? (
          <div className="text-center text-red-400">Could not reach server. Is the app running?</div>
        ) : (
          <>
            {/* Overall status */}
            <div
              className="rounded-xl p-4 mb-6 text-center font-bold text-lg"
              style={{
                background: data.status === "healthy" ? "#10b98122" : "#f59e0b22",
                border: `1px solid ${data.status === "healthy" ? "#10b981" : "#f59e0b"}`,
                color: data.status === "healthy" ? "#10b981" : "#f59e0b",
              }}
            >
              {data.status === "healthy" ? "✅ Everything is working!" : "⚠️ Action needed — see below"}
            </div>

            {/* Individual checks */}
            <div className="space-y-3">
              {Object.entries(data.checks).map(([key, check]) => (
                <div
                  key={key}
                  className="rounded-xl p-4 border"
                  style={{
                    background: check.ok ? "#10b98111" : "#ef444422",
                    border: `1px solid ${check.ok ? "#10b98133" : "#ef444455"}`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xl">{check.ok ? "✅" : "❌"}</span>
                    <span className="text-white font-semibold">{labels[key] ?? key}</span>
                  </div>
                  <p
                    className="text-sm ml-8"
                    style={{ color: check.ok ? "#6ee7b7" : "#fca5a5" }}
                  >
                    {check.detail}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={fetchHealth}
              className="mt-6 w-full py-3 rounded-xl font-bold text-black"
              style={{ background: "#f59e0b" }}
            >
              Re-run Checks
            </button>

            <p className="text-center text-slate-500 text-xs mt-4">
              This page is only for setup — it won&apos;t appear in production.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
