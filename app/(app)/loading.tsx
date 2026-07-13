// Streams instantly on navigation while the destination page's data
// loads, so taps feel immediate instead of frozen. Applies to every
// route in the (app) group via the nearest-ancestor Suspense boundary.
export default function Loading() {
  return (
    <div className="h-full flex items-center justify-center bg-ink-50">
      <div className="w-8 h-8 rounded-full border-[3px] border-ink-200 border-t-ink-700 animate-spin" />
    </div>
  );
}
