"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Upload, X, Loader2, ChevronLeft, AlertCircle, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(3, "At least 3 characters").max(100),
  hint: z.string().min(10, "Give explorers something to go on").max(300),
  radius_meters: z.number().min(10).max(500),
  points_staked: z.number().min(1, "Stake at least 1 point").int(),
});
type FormData = z.infer<typeof schema>;

interface TreasureToEdit {
  id: string;
  title: string;
  hint: string | null;
  image_url: string | null;
  radius_meters: number;
  points_staked: number;
  rejection_reason: string | null;
}

export function EditTreasureForm({ treasure, currentBalance }: { treasure: TreasureToEdit; currentBalance: number }) {
  const router = useRouter();
  const supabase = createClient();

  // The creator's balance already has this treasure's original stake
  // removed from it (refunded back on rejection), so the cap here is
  // simply the current balance.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(treasure.image_url);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: treasure.title,
      hint: treasure.hint ?? "",
      radius_meters: treasure.radius_meters,
      points_staked: Math.min(treasure.points_staked, currentBalance || treasure.points_staked),
    },
  });

  const radiusValue = watch("radius_meters");

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onSubmit(data: FormData) {
    if (data.points_staked > currentBalance) {
      setError(`You only have ${currentBalance} points available.`);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      let imageUrl = treasure.image_url;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const fileName = `${treasure.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("treasure-images").upload(fileName, imageFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("treasure-images").getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      // Location is intentionally untouched here — only fixing what the
      // rejection was actually about (photo/hint/title/stake).
      const { error: updateErr } = await supabase
        .from("treasures")
        .update({
          title: data.title,
          hint: data.hint,
          radius_meters: data.radius_meters,
          points_staked: data.points_staked,
          image_url: imageUrl,
          status: "pending",
          rejection_reason: null,
        })
        .eq("id", treasure.id);
      if (updateErr) throw updateErr;

      router.push("/profile");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resubmit");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-ink-50">
      <div className="sticky top-0 z-10 bg-white border-b border-ink-200 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-ink-50 text-ink-400 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-ink-700">Fix & Resubmit</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-5 space-y-5 max-w-lg mx-auto">
        {treasure.rejection_reason && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-red-600 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Why it was rejected:</p>
              <p>{treasure.rejection_reason}</p>
            </div>
          </div>
        )}

        <div>
          <label className="label">Title *</label>
          <input {...register("title")} className="input" />
          {errors.title && <p className="text-red-500 text-xs mt-1.5">{errors.title.message}</p>}
        </div>

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
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
        </div>

        <div>
          <label className="label">Hint *</label>
          <textarea {...register("hint")} className="input resize-none" rows={3} />
          {errors.hint && <p className="text-red-500 text-xs mt-1.5">{errors.hint.message}</p>}
        </div>

        <div>
          <label className="label">
            Claim Radius — <span className="text-ink-700 normal-case tracking-normal font-bold">{radiusValue}m</span>
          </label>
          <input type="range" min={10} max={500} step={10}
            {...register("radius_meters", { valueAsNumber: true })}
            className="w-full accent-ink-700 h-1.5" />
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            <Coins size={13} /> Points to Stake *
            <span className="ml-auto text-ink-400 font-normal text-xs normal-case tracking-normal">
              Balance: {currentBalance}
            </span>
          </label>
          <input type="number" min={1} max={currentBalance}
            {...register("points_staked", { valueAsNumber: true })}
            className="input" />
          {errors.points_staked && <p className="text-red-500 text-xs mt-1.5">{errors.points_staked.message}</p>}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-4 rounded-xl">{error}</div>
        )}

        <button type="submit" disabled={isSubmitting}
          className="w-full py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 bg-ink-700 text-ink-50 shadow-btn hover:bg-ink-900 disabled:opacity-50">
          {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Resubmitting…</> : "🏴‍☠️ Resubmit for Review"}
        </button>
      </form>
    </div>
  );
}
