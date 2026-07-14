"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDistance, cn } from "@/lib/utils";
import { ChevronLeft, CheckCircle2, Lock, Coins, Clock, Users, AlertCircle, Loader2, Camera } from "lucide-react";
import { ClaimCamera } from "./ClaimCamera";

interface TreasureLite {
  id: string;
  creator_id: string;
  title: string;
  hint: string | null;
  points_staked: number;
  radius_meters: number;
  image_url: string | null;
  is_active: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  claim_count?: number;
  creator?: { username: string; avatar_url: string | null };
}

interface ExistingClaim {
  id: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  claimed_at: string;
}

interface Props {
  treasure: TreasureLite;
  userId: string;
  isCreator: boolean;
  existingClaim: ExistingClaim | null;
}

export function TreasureDetail({ treasure, userId, isCreator, existingClaim }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [distance, setDistance] = useState<number | null>(null);
  const [withinRadius, setWithinRadius] = useState(false);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimState, setClaimState] = useState<ExistingClaim | null>(existingClaim);
  const [withdrawing, setWithdrawing] = useState(false);
  const [isActive, setIsActive] = useState(treasure.is_active);

  const lastPosition = useRef<{ lat: number; lng: number } | null>(null);
  const foundByOther = !!treasure.claimed_by && treasure.claimed_by !== userId;
  const canAttemptClaim = !isCreator && !claimState && !treasure.claimed_by && isActive;

  async function withdraw() {
    if (!confirm("Withdraw this treasure? Any points still staked (not yet claimed) will be refunded to you.")) return;
    setWithdrawing(true);
    const { error } = await supabase.from("treasures").update({ is_active: false }).eq("id", treasure.id);
    if (!error) setIsActive(false);
    setWithdrawing(false);
  }

  const checkProximity = useCallback(async (lat: number, lng: number) => {
    lastPosition.current = { lat, lng };
    const { data, error } = await supabase.rpc("check_treasure_proximity", {
      p_treasure_id: treasure.id,
      p_lat: lat,
      p_lng: lng,
    });
    if (!error && data && data[0]) {
      setDistance(data[0].distance_meters);
      setWithinRadius(data[0].within_radius);
    }
    setLocating(false);
  }, [supabase, treasure.id]);

  useEffect(() => {
    if (!canAttemptClaim) {
      setLocating(false);
      return;
    }
    const watcher = navigator.geolocation?.watchPosition(
      (p) => checkProximity(p.coords.latitude, p.coords.longitude),
      () => { setLocating(false); setLocationError(true); },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => {
      if (watcher !== undefined) navigator.geolocation?.clearWatch(watcher);
    };
  }, [canAttemptClaim, checkProximity]);

  async function handlePhotoReady(blob: Blob, _previewUrl: string) {
    setShowCamera(false);
    if (!lastPosition.current) {
      setClaimError("Lost your location — try again.");
      return;
    }
    setSubmitting(true);
    setClaimError(null);
    try {
      // 1. Create the claim row first (photo_url null) so the upload can
      // reference a real claim id in its storage path.
      const { data: claimRow, error: insertErr } = await supabase
        .from("claims")
        .insert({
          treasure_id: treasure.id,
          player_id: userId,
          verification_method: "gps",
          verified_latitude: lastPosition.current.lat,
          verified_longitude: lastPosition.current.lng,
        })
        .select("id, status, rejection_reason, claimed_at")
        .single();
      if (insertErr) throw insertErr;

      // 2. Upload to the private claim-photos bucket.
      const path = `${treasure.id}/${claimRow.id}/photo.jpg`;
      const { error: upErr } = await supabase.storage.from("claim-photos").upload(path, blob, {
        contentType: "image/jpeg",
      });
      if (upErr) throw upErr;

      // 3. Attach the photo path to the claim.
      const { error: updateErr } = await supabase.from("claims").update({ photo_url: path }).eq("id", claimRow.id);
      if (updateErr) throw updateErr;

      setClaimState(claimRow as ExistingClaim);
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : "Failed to submit your claim");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-ink-50">
      <button onClick={() => router.back()}
        className="absolute top-4 left-4 z-10 bg-white border border-ink-200 rounded-xl p-2 shadow-card hover:border-ink-400 transition-all">
        <ChevronLeft size={20} className="text-ink-700" />
      </button>

      {/* Clue photo — this is the only visual clue, no map, no coordinates */}
      <div className="h-64 relative bg-ink-200">
        {treasure.image_url ? (
          <img src={treasure.image_url} alt={treasure.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">💎</div>
        )}
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-black text-ink-700 leading-tight">{treasure.title}</h1>
            {treasure.creator && (
              <p className="text-ink-400 text-sm mt-0.5">hidden by {treasure.creator.username}</p>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-1 text-ink-700 font-bold text-sm bg-white border border-ink-200 rounded-full px-3 py-1.5 shadow-card">
            <Coins size={14} /> {treasure.points_staked}
          </div>
        </div>

        {/* Hint */}
        {treasure.hint && (
          <div className="card p-4">
            <p className="text-xs font-bold text-ink-200 uppercase tracking-widest mb-2">Hint</p>
            <p className="text-ink-700 text-sm leading-relaxed">{treasure.hint}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <div className="card p-3 text-center">
            <Users size={15} className="mx-auto text-ink-400 mb-1.5" />
            <div className="text-ink-700 font-bold text-sm">{treasure.claim_count ?? 0}</div>
            <div className="text-ink-200 text-xs mt-0.5">Attempts</div>
          </div>
          <div className="card p-3 text-center">
            <Clock size={15} className="mx-auto text-ink-400 mb-1.5" />
            <div className="text-ink-700 font-bold text-sm">{treasure.radius_meters}m</div>
            <div className="text-ink-200 text-xs mt-0.5">Claim Range</div>
          </div>
        </div>

        {/* Already found by someone else */}
        {foundByOther && (
          <div className="card p-5 text-center border-ink-200 bg-white">
            <CheckCircle2 size={28} className="mx-auto text-ink-400 mb-2" />
            <p className="text-ink-700 font-bold">Already Found</p>
            <p className="text-ink-200 text-sm mt-1">Someone else got there first — keep exploring for more.</p>
          </div>
        )}

        {/* Creator viewing their own treasure */}
        {isCreator && !treasure.claimed_by && (
          <div className="card p-4 bg-white border-ink-200 space-y-3">
            <p className="text-ink-400 text-sm">This is your own treasure — you can't claim it yourself. Check the Claims tab for submissions from other explorers.</p>
            {isActive ? (
              <button onClick={withdraw} disabled={withdrawing}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50">
                {withdrawing ? "Withdrawing…" : "Withdraw Treasure"}
              </button>
            ) : (
              <p className="text-ink-200 text-xs">Withdrawn — no longer visible in the feed. Any unclaimed stake was refunded.</p>
            )}
          </div>
        )}

        {/* Finder's own claim state */}
        {claimState && (
          claimState.status === "approved" ? (
            <div className="card p-5 text-center border-green-200 bg-green-50">
              <CheckCircle2 size={32} className="mx-auto text-green-600 mb-2" />
              <p className="text-green-700 font-bold text-lg">Treasure Claimed!</p>
              <p className="text-ink-400 text-xs mt-1">+{treasure.points_staked} points added to your balance</p>
            </div>
          ) : claimState.status === "pending" ? (
            <div className="card p-4 flex items-center gap-2.5 bg-amber-50 border-amber-200">
              <Loader2 size={16} className="text-amber-600 animate-spin shrink-0" />
              <p className="text-amber-700 text-sm">Waiting on {treasure.creator?.username ?? "the creator"} to review your photo.</p>
            </div>
          ) : (
            <div className="card p-4 bg-red-50 border-red-200">
              <div className="flex items-center gap-2.5 mb-1">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-red-600 font-semibold text-sm">Claim not accepted</p>
              </div>
              {claimState.rejection_reason && (
                <p className="text-red-500 text-xs ml-6">{claimState.rejection_reason}</p>
              )}
            </div>
          )
        )}

        {/* Live distance + claim button — only for someone who can still attempt it */}
        {canAttemptClaim && (
          <>
            <div className={cn("card p-4 transition-all", withinRadius && "border-green-300 bg-green-50")}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-ink-700">Your Distance</span>
                {locating && <span className="text-xs text-ink-200 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Locating…</span>}
              </div>
              {distance !== null ? (
                <>
                  <div className={cn("text-4xl font-black mb-2", withinRadius ? "text-green-600" : "text-ink-700")}>
                    {formatDistance(distance)}
                  </div>
                  <p className={cn("text-xs font-medium", withinRadius ? "text-green-600" : "text-ink-400")}>
                    {withinRadius ? "✓ You're within range — claim it!" : "Keep exploring — you're not close enough yet"}
                  </p>
                </>
              ) : locationError ? (
                <p className="text-ink-200 text-sm">Enable location access to track your distance.</p>
              ) : (
                <p className="text-ink-200 text-sm">Finding your location…</p>
              )}
            </div>

            {claimError && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-red-600 text-sm">
                <AlertCircle size={16} className="shrink-0" /> {claimError}
              </div>
            )}

            <button
              onClick={() => setShowCamera(true)}
              disabled={!withinRadius || submitting || locating}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                withinRadius
                  ? "bg-ink-700 text-ink-50 shadow-btn hover:bg-ink-900"
                  : "bg-ink-200 text-white cursor-not-allowed"
              )}
            >
              {submitting ? (
                <><Loader2 size={18} className="animate-spin" /> Submitting…</>
              ) : withinRadius ? (
                <><Camera size={18} /> Prove You Found It</>
              ) : (
                <><Lock size={16} /> Get closer to claim</>
              )}
            </button>
          </>
        )}
      </div>

      {showCamera && (
        <ClaimCamera onPhotoReady={handlePhotoReady} onCancel={() => setShowCamera(false)} />
      )}
    </div>
  );
}
