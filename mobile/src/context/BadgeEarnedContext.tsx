import React, { createContext, useContext, useState } from "react";
import type { NewlyEarnedBadge } from "../types";

// Same "global notifier, one mounted display component" shape as
// ToastContext — rateContent()'s own callers (ContentDetailScreen.tsx's
// rate flow, the only place ratings are ever submitted from today) report
// whatever the API response's own newlyEarnedBadges said, and
// BadgeEarnedModal.tsx (mounted once, app/(app)/_layout.tsx alongside
// PodiumNewsModal) is what actually renders the popup. A queue, not a
// single value: a rating can touch more than one badge genre at once
// (e.g. a movie tagged both Horror and Thriller could cross both
// thresholds in the same rating), and each deserves its own full
// congratulations moment rather than being silently dropped or crammed
// into one popup.
interface BadgeEarnedContextValue {
  queue: NewlyEarnedBadge[];
  reportEarnedBadges: (badges: NewlyEarnedBadge[]) => void;
  dismissCurrent: () => void;
}

const BadgeEarnedContext = createContext<BadgeEarnedContextValue | undefined>(undefined);

export function BadgeEarnedProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<NewlyEarnedBadge[]>([]);

  const reportEarnedBadges = (badges: NewlyEarnedBadge[]) => {
    if (badges.length === 0) return;
    setQueue((prev) => [...prev, ...badges]);
  };

  const dismissCurrent = () => setQueue((prev) => prev.slice(1));

  return (
    <BadgeEarnedContext.Provider value={{ queue, reportEarnedBadges, dismissCurrent }}>{children}</BadgeEarnedContext.Provider>
  );
}

export function useBadgeEarned() {
  const ctx = useContext(BadgeEarnedContext);
  if (!ctx) throw new Error("useBadgeEarned must be used within a BadgeEarnedProvider");
  return ctx;
}
