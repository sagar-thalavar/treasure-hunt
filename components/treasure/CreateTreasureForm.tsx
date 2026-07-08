"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { MapPin, Upload, X, Loader2, ChevronLeft, ChevronRight, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

const LeafletPicker = dynamic(() => import("./LeafletPicker"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-ink-50 border border-ink-200 rounded-xl flex items-center justify-center">
      <p className="text-ink-200 text-sm">Loading map…</p>
    </div>
  ),
});

const schema = z.object({
  title: z.string().min(3, "At least 3 characters").max(100),
  hint: z.string().min(10, "Give explorers something to go on").max(300),
  radius_meters: z.number().min(10).max(500),
  points_staked: z.number().min(1, "Stake at least 1 point").int(),
});
type FormData = z.infer<typeof schema>;

export function CreateTreasureForm({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [balance, setBalance] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      radius_meters: 100,
      points_staked: 50,
    },
  });

  const radiusValue = watch("radius_meters");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("points_balance").eq("id", userId).single();
      if (!cancelled) setBalance(data?.points_balance ?? 0);
    })();
    return () => { cancelled = true; };
  }, [supabase, userId]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function goToStep2() {
    const valid = await trigger(["title", "hint"]);
    if (valid) {
      if (!imageFile) {
        setError("Add a clue photo before continuing.");
        return;
      }
      setError(null);
      setStep(2);
    }
  }

  async function onSubmit(data: FormData) {
    if (!pinLocation) {
      setError("Tap anywhere on the map to drop the hidden location first.");
      return;
    }
    if (balance !== null && data.points_staked > balance) {
      setError(`You only have ${balance} points — lower the stake or earn more first.`);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      // Ensure the user has a profile row (safety net for accounts created
      // before the handle_new_user trigger existed).
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (!existingProfile) {
        const { data: { user } } = await supabase.auth.getUser();
        const baseUsername =
          user?.user_metadata?.full_name ||
          user?.email?.split("@")[0] ||
          "explorer";
        await supabase.from("profiles").upsert({
          id: userId,
          username: `${baseUsername}-${userId.slice(0, 6)}`,
          avatar_url: user?.user_metadata?.avatar_url ?? null,
        });
      }

      // Clue photo is meant to be public (shown in the feed), so it goes
      // in the existing public treasure-images bucket.
      let imageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("treasure-images").upload(fileName, imageFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("treasure-images").getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      // The location is never exposed anywhere in the UI after this —
      // it's stored purely for the backend GPS proximity check on claim.
      const { error: insertErr } = await supabase.from("treasures").insert({
        creator_id: userId,
        title: data.title,
        hint: data.hint,
        latitude: pinLocation.lat,
        longitude: pinLocation.lng,
        radius_meters: data.radius_meters,
        points_staked: data.points_staked,
        image_url: imageUrl,
        is_active: true,
        // status defaults to 'pending' — goes to the admin queue, not live yet.
      });
      if (insertErr) throw insertErr;

      router.push("/feed?submitted=1");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create treasure");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-ink-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-ink-200 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => step === 2 ? setStep(1) : router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-ink-50 text-ink-400 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-ink-700">
            {step === 1 ? "The Clue" : "Hidden Location & Stake"}
          </h1>
          <p className="text-xs text-ink-200">Step {step} of 2</p>
        </div>
        {/* Step dots */}
        <div className="flex gap-1.5">
          {[1, 2].map(s => (
            <div key={s} className={cn("h-1.5 rounded-full transition-all", step >= s ? "w-6 bg-ink-700" : "w-1.5 bg-ink-200")} />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-5 space-y-5 max-w-lg mx-auto">
        {step === 1 ? (
          <>
            <p className="text-ink-400 text-sm -mt-1">
              This is what other explorers will see in the feed. The exact
              location stays hidden — they have to recognize it from the
              photo and hint.
            </p>

            {/* Title */}
            <div>
              <label className="label">Title *</label>
              <input {...register("title")} className="input" placeholder="e.g. Morning Coffee Mystery" />
              {errors.title && <p className="text-red-500 text-xs mt-1.5">{errors.title.message}</p>}
            </div>

            {/* Clue photo */}
            <div>
              <label className="label">Clue Photo *</label>
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-ink-200 hover:border-ink-400 rounded-xl p-5 text-center cursor-pointer transition-all">
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                    <button type="button" onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}
                      className="absolute top-2 right-2 bg-white border border-ink-200 rounded-full p-1 shadow-sm">
                      <X size={14} className="text-ink-700" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={22} className="mx-auto text-ink-200 mb-2" />
                    <p className="text-ink-400 text-sm font-medium">A clear photo of the spot or item</p>
                    <p className="text-ink-200 text-xs mt-1">PNG, JPG up to 50MB</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </div>

            {/* Hint */}
            <div>
              <label className="label">Hint *</label>
              <textarea {...register("hint")} className="input resize-none" rows={3}
                placeholder="Give explorers something to recognize it by, without giving away the exact spot…" />
              {errors.hint && <p className="text-red-500 text-xs mt-1.5">{errors.hint.message}</p>}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>
            )}

            <button type="button" onClick={goToStep2} className="btn-primary w-full flex items-center justify-center gap-2">
              Next: Hidden Location <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <>
            {/* Map pin */}
            <div>
              <label className="label flex items-center gap-1.5">
                <MapPin size={13} /> Drop Pin on Map *
                {pinLocation ? (
                  <span className="ml-auto text-green-600 font-semibold text-xs normal-case tracking-normal">
                    ✓ Pin set
                  </span>
                ) : (
                  <span className="ml-auto text-ink-200 font-normal text-xs normal-case tracking-normal">
                    Tap the map
                  </span>
                )}
              </label>
              <p className="text-ink-200 text-xs mb-2">
                This location is never shown to anyone — it's only used to
                verify a claim.
              </p>
              <div className="h-52 rounded-xl overflow-hidden border-2 border-dashed border-ink-200">
                <LeafletPicker onLocationSelected={(lat, lng) => setPinLocation({ lat, lng })} />
              </div>
            </div>

            {/* Radius */}
            <div>
              <label className="label">
                Claim Radius — <span className="text-ink-700 normal-case tracking-normal font-bold">{radiusValue}m</span>
              </label>
              <input type="range" min={10} max={500} step={10}
                {...register("radius_meters", { valueAsNumber: true })}
                className="w-full accent-ink-700 h-1.5" />
              <div className="flex justify-between text-xs text-ink-200 mt-1">
                <span>10m — precise</span><span>500m — broad</span>
              </div>
              <p className="text-ink-200 text-xs mt-1.5">
                GPS is typically only accurate to 5–20m outdoors — a tighter
                radius risks rejecting genuine finds, not just cheaters.
              </p>
            </div>

            {/* Points stake */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Coins size={13} /> Points to Stake *
                <span className="ml-auto text-ink-400 font-normal text-xs normal-case tracking-normal">
                  Balance: {balance ?? "…"}
                </span>
              </label>
              <input type="number" min={1} max={balance ?? undefined}
                {...register("points_staked", { valueAsNumber: true })}
                className="input" placeholder="e.g. 50" />
              <p className="text-ink-200 text-xs mt-1.5">
                These points leave your balance now and go to whoever's
                claim gets approved — they aren't refunded just because a
                claim attempt gets rejected, only if this treasure is
                withdrawn unclaimed or if admin review rejects it.
              </p>
              {errors.points_staked && <p className="text-red-500 text-xs mt-1.5">{errors.points_staked.message}</p>}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-4 rounded-xl">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !pinLocation}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                pinLocation
                  ? "bg-ink-700 text-ink-50 shadow-btn hover:bg-ink-900"
                  : "bg-ink-200 text-white cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="animate-spin" /> Submitting…</>
              ) : !pinLocation ? (
                "Drop a pin on the map first"
              ) : (
                "🏴‍☠️ Submit for Review"
              )}
            </button>
            <p className="text-ink-200 text-xs text-center -mt-3">
              Goes to admin review before it's visible to anyone else.
            </p>
          </>
        )}
      </form>
    </div>
  );
}
