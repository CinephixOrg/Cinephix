import type { ProfileAnalysis } from "../types";

// A one-shot in-memory relay for handing a full ProfileAnalysis object
// (too large/complex to serialize through URL params) to a pushed
// AnalyzeStoryScreen route — set right before router.push from
// AnalyzeInfoModal.tsx (a fresh analysis), app/(app)/profile/analyses.tsx
// (a tapped history entry), or ShareCard.tsx/ChatRoom.tsx (a shared/
// received analysis), read exactly once on that screen's own mount. Plain
// module state rather than a React Context: this is a single relay between
// two specific screens at a time, not shared app state anything else needs
// to read or subscribe to.
//
// `origin` drives the story screen's own "is this mine or someone else's"
// branching: "own" keeps today's Share CTA and no ownership header; "shared"
// shows a small `data.nickname` header instead and hides the Share CTA
// (viewing someone else's shared analysis isn't a re-share decision).
export interface PendingProfileAnalysis {
  data: ProfileAnalysis;
  origin: "own" | "shared";
}

let pending: PendingProfileAnalysis | null = null;

export function setPendingProfileAnalysis(data: ProfileAnalysis, origin: "own" | "shared" = "own") {
  pending = { data, origin };
}

export function takePendingProfileAnalysis(): PendingProfileAnalysis | null {
  const value = pending;
  pending = null;
  return value;
}
