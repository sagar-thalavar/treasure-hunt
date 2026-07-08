"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, XCircle, Coins, MapPin, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface PendingTreasure {
  id: string;
  title: string;
  hint: string | null;
  image_url: string | null;
  points_staked: number;
  radius_meters: number;
  latitude: number;
  longitude: number;
  created_at: string;
  creator: { username: string; avatar_url: string | null };
}

export function AdminQueue({ treasures }: { treasures: PendingTreasure[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    const { error } = await supabase.from("treasures").update({ status: "approved" }).eq("id", id);
    if (error) setError(error.message);
    else router.refresh();
    setBusyId(null);
  }

  async function reject(id: string) {
    if (!reason.trim()) {
      setError("Add a short reason before rejecting.");
      return;
    }
    setBusyId(id);
    setError(null);
    const { error } = await supabase
      .from("treasures")
      .update({ status: "rejected", rejection_reason: reason.trim() })
      .eq("id", id);
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
        <h1 className="text-base font-bold text-ink-700">Admin Review</h1>
        <p className="text-xs text-ink-200">{treasures.length} treasures waiting on you</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>
        )}

        {treasures.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-ink-700 font-semibold">Queue is empty</p>
            <p className="text-ink-200 text-sm mt-1">New submissions will show up here.</p>
          </div>
        ) : (
          treasures.map((t) => (
            <div key={t.id} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-ink-700 font-bold text-sm truncate">{t.title}</p>
                  <p className="text-ink-200 text-xs mt-0.5">
                    by {t.creator.username} · {format(new Date(t.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-1 text-ink-700 font-bold text-xs bg-ink-50 border border-ink-200 rounded-full px-2.5 py-1">
                  <Coins size={12} /> {t.points_staked}
                </div>
              </div>

              {t.image_url && (
                <img src={t.image_url} alt={t.title} className="w-full h-48 object-cover rounded-xl" />
              )}

              {t.hint && (
                <p className="text-ink-700 text-sm bg-ink-50 border border-ink-200 rounded-xl p-3">{t.hint}</p>
              )}

              {/* Real location — only visible here, to judge legitimacy/safety */}
              <a
                href={`https://www.google.com/maps?q=${t.latitude},${t.longitude}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-ink-400 hover:text-ink-700 border border-ink-200 rounded-xl px-3 py-2"
              >
                <MapPin size={13} />
                {t.latitude.toFixed(5)}, {t.longitude.toFixed(5)} · {t.radius_meters}m radius
                <ExternalLink size={11} className="ml-auto" />
              </a>

              {rejectingId === t.id ? (
                <div className="space-y-2">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input resize-none"
                    rows={2}
                    placeholder="Why isn't this approved? (shown to the creator, who can edit and resubmit)"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setRejectingId(null); setReason(""); setError(null); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-ink-200 text-ink-400 hover:border-ink-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => reject(t.id)}
                      disabled={busyId === t.id}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      {busyId === t.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Confirm Reject"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setRejectingId(t.id); setError(null); }}
                    disabled={busyId === t.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle size={15} /> Reject
                  </button>
                  <button
                    onClick={() => approve(t.id)}
                    disabled={busyId === t.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-ink-700 text-ink-50 hover:bg-ink-900 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {busyId === t.id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={15} /> Approve</>}
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
