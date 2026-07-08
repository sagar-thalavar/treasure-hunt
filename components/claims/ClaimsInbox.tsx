"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, XCircle, Coins, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ClaimRow {
  id: string;
  treasure_id: string;
  player_id: string;
  photo_url: string | null;
  signedPhotoUrl: string | null;
  status: string;
  claimed_at: string;
  treasure: { id: string; title: string; image_url: string | null; points_staked: number };
  player: { username: string; avatar_url: string | null };
}

export function ClaimsInbox({ claims }: { claims: ClaimRow[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function approve(claimId: string) {
    setBusyId(claimId);
    setError(null);
    const { error } = await supabase.from("claims").update({ status: "approved" }).eq("id", claimId);
    if (error) setError(error.message);
    else router.refresh();
    setBusyId(null);
  }

  async function reject(claimId: string) {
    if (!reason.trim()) {
      setError("Add a short reason before rejecting.");
      return;
    }
    setBusyId(claimId);
    setError(null);
    const { error } = await supabase
      .from("claims")
      .update({ status: "rejected", rejection_reason: reason.trim() })
      .eq("id", claimId);
    if (error) setError(error.message);
    else {
      setRejectingId(null);
      setReason("");
      router.refresh();
    }
    setBusyId(null);
  }

  return (
    <div className="h-full overflow-y-auto bg-ink-50">
      <div className="sticky top-0 z-10 bg-white border-b border-ink-200 px-4 py-3.5">
        <h1 className="text-base font-bold text-ink-700">Claims</h1>
        <p className="text-xs text-ink-200">{claims.length} waiting on your review</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>
        )}

        {claims.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-ink-700 font-semibold">Nothing to review</p>
            <p className="text-ink-200 text-sm mt-1">Claims on your treasures will show up here.</p>
          </div>
        ) : (
          claims.map((c) => (
            <div key={c.id} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-ink-700 font-bold text-sm truncate">{c.treasure.title}</p>
                  <p className="text-ink-200 text-xs mt-0.5">
                    {c.player.username} · {format(new Date(c.claimed_at), "MMM d, h:mm a")}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-1 text-ink-700 font-bold text-xs bg-ink-50 border border-ink-200 rounded-full px-2.5 py-1">
                  <Coins size={12} /> {c.treasure.points_staked}
                </div>
              </div>

              {c.signedPhotoUrl && (
                <img src={c.signedPhotoUrl} alt="Claim proof" className="w-full h-56 object-cover rounded-xl" />
              )}

              {rejectingId === c.id ? (
                <div className="space-y-2">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input resize-none"
                    rows={2}
                    placeholder="Why isn't this a match? (shown to the finder)"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setRejectingId(null); setReason(""); setError(null); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-ink-200 text-ink-400 hover:border-ink-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => reject(c.id)}
                      disabled={busyId === c.id}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      {busyId === c.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Confirm Reject"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setRejectingId(c.id); setError(null); }}
                    disabled={busyId === c.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle size={15} /> Reject
                  </button>
                  <button
                    onClick={() => approve(c.id)}
                    disabled={busyId === c.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-ink-700 text-ink-50 hover:bg-ink-900 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={15} /> Approve</>}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
