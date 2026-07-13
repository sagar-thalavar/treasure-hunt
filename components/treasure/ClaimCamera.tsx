"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Image as ImageIcon, RotateCcw, Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClaimCameraProps {
  onPhotoReady: (blob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}

type Mode = "choose" | "camera" | "preview";

/**
 * Lets a finder either take a live back-camera photo (with a preview +
 * retake step, adapted from the getUserMedia + canvas pattern used in the
 * guestbook project's selfie camera, just facing the environment instead
 * of the user) or upload one from their gallery — both offered per the
 * locked v1 spec.
 */
export function ClaimCamera({ onPhotoReady, onCancel }: ClaimCameraProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  async function startCamera() {
    setCameraError(null);
    setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError("Couldn't access the camera. Check your browser's camera permission, or upload a photo instead.");
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setMode("preview");
      },
      "image/jpeg",
      0.85
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setPreviewBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMode("preview");
  }

  function retake() {
    setPreviewUrl(null);
    setPreviewBlob(null);
    startCamera();
  }

  function confirm() {
    if (previewBlob && previewUrl) onPhotoReady(previewBlob, previewUrl);
  }

  function cancelAll() {
    stopStream();
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <span className="text-white text-sm font-semibold">Proof of Find</span>
        <button onClick={cancelAll} className="text-white/70 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      {/* min-h-0 lets the preview image shrink to the space left after the
          button bar instead of overflowing the viewport (flex min-height:auto);
          max-w keeps the capture UI phone-shaped on desktop monitors */}
      <div className="flex-1 min-h-0 w-full max-w-2xl mx-auto flex items-center justify-center relative">
        {mode === "choose" && (
          <div className="w-full max-w-xs px-6 space-y-3">
            <button onClick={startCamera} className="w-full btn-primary flex items-center justify-center gap-2 py-4">
              <Camera size={18} /> Take a Photo
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full btn-secondary flex items-center justify-center gap-2 py-4 !bg-white/10 !text-white !border-white/20">
              <ImageIcon size={18} /> Upload from Gallery
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>
        )}

        {mode === "camera" && (
          cameraError ? (
            <div className="text-center px-6">
              <AlertCircle size={28} className="mx-auto text-red-400 mb-3" />
              <p className="text-white text-sm mb-4">{cameraError}</p>
              <button onClick={() => fileInputRef.current?.click()} className="btn-primary">
                Upload from Gallery instead
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <button
                onClick={captureFrame}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-white/40 active:scale-95 transition-transform"
              />
            </>
          )
        )}

        {mode === "preview" && previewUrl && (
          <div className="w-full h-full min-h-0 flex flex-col">
            <img src={previewUrl} alt="Captured" className="flex-1 min-h-0 w-full object-contain bg-black" />
            <div className="flex gap-3 p-4 bg-black/80">
              <button onClick={retake} className={cn("flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2",
                "bg-white/10 text-white border border-white/20")}>
                <RotateCcw size={16} /> Retake
              </button>
              <button onClick={confirm} className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-ink-700 text-ink-50">
                <Check size={16} /> Use This Photo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
