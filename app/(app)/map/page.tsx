import { redirect } from "next/navigation";

// The map-based browsing view has been replaced by the Discovery feed
// (see PROJECT_PLAN.md — showing exact treasure locations defeated the
// whole recognition-based hunt mechanic). This redirect just keeps any
// old links/bookmarks to /map working.
export default function MapPage() {
  redirect("/feed");
}
