import React, { createContext, useCallback, useContext, useState } from "react";
import type { Share } from "../types";

interface RecentSharesContextValue {
  // Shares announced since the feed last consumed them — a small queue,
  // not a single value, since a viewer could plausibly create two posts
  // (e.g. share a review, then immediately share a recommendation) before
  // ever revisiting Media to see either one.
  pending: Share[];
  // Called right after any createShare(...) succeeds, from every screen
  // that can create one (ContentDetailScreen, ReviewWriteScreen,
  // ListDetailScreen, ProfileAnalysisModal, BadgeEarnedModal, and the new
  // watchlist poll flow) — this is the one signal SharesFeedSection.tsx
  // needs to prepend the just-created post, since its own feed-fetching
  // state lives on a different, already-mounted screen it has no direct
  // handle to.
  announce: (share: Share) => void;
  // Called by SharesFeedSection.tsx once it's actually prepended the
  // queued shares into its own list — clears the queue so the same post
  // doesn't get prepended twice if this provider's consumer re-renders.
  consume: () => void;
}

const RecentSharesContext = createContext<RecentSharesContextValue | undefined>(undefined);

// Instagram-style "see your own post at the top of the feed right after
// posting" — a client-side illusion, not a backend ranking change. The
// feed's own blended recency+engagement+network score (getShareFeed,
// shareController.js) is untouched; this only affects what the CURRENT
// session shows before the next real fetch (pull-to-refresh, or leaving
// and returning to Media) lets that score settle the post into wherever
// it actually ranks. A brand-new post with 0 likes/views can easily rank
// well below older, more-engaged posts on a true refetch — this context
// exists specifically to paper over that gap for the person who JUST
// posted, the same way Instagram's own feed does.
export function RecentSharesProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Share[]>([]);

  const announce = useCallback((share: Share) => {
    setPending((prev) => [share, ...prev]);
  }, []);

  const consume = useCallback(() => {
    setPending([]);
  }, []);

  return <RecentSharesContext.Provider value={{ pending, announce, consume }}>{children}</RecentSharesContext.Provider>;
}

export function useRecentShares() {
  const ctx = useContext(RecentSharesContext);
  if (!ctx) throw new Error("useRecentShares must be used within a RecentSharesProvider");
  return ctx;
}
