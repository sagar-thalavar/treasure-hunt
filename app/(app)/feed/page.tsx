import { Suspense } from "react";
import { FeedView } from "@/components/feed/FeedView";

export default function FeedPage() {
  return (
    <Suspense fallback={null}>
      <FeedView />
    </Suspense>
  );
}
