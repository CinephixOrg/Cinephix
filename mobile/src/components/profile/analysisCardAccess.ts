import type { AccountTier } from "../../types";

// Ranked cheapest-first. `dev` sits above premium so an internal account
// always passes every gate below.
const TIER_RANK: Record<AccountTier, number> = {
  free: 0,
  plus: 1,
  premium: 2,
  dev: 3,
};

export function tierRank(tier: AccountTier | undefined): number {
  return TIER_RANK[tier ?? "free"] ?? 0;
}

export function tierAllows(viewerTier: AccountTier | undefined, minTier: AccountTier): boolean {
  return tierRank(viewerTier) >= tierRank(minTier);
}

// ---------------------------------------------------------------------------
// Which Profile Analysis cards each tier can see.
//
// EVERY card is "free" today — running an analysis at all is already gated
// upstream (ProfileAnalysesTab shows Free an upsell instead of the button),
// so a second gate here would be dead weight right now. This table exists so
// that when the deck IS split across tiers, it's a one-word edit per card
// rather than a hunt through render logic: change a value to "plus" or
// "premium" and that card disappears for anyone below it, with the deck's
// dots, indexes and reveal-tracking all following automatically.
//
// Note the two Premium charts (rating-curve, activity-timeline) are ALSO
// gated server-side — backend/config/tiers.js's analysisAdvancedCards
// decides whether their data is computed at all. That's the real
// entitlement; leaving them "free" here is deliberate, so a Premium user's
// shared analysis keeps its extra cards for whoever opens it. Raising them
// here would additionally hide those cards from lower-tier *viewers*.
// ---------------------------------------------------------------------------
export const ANALYSIS_CARD_MIN_TIER: Record<string, AccountTier> = {
  "ai-summary": "free",
  "genre-breakdown": "free",
  "recent-genres": "free",
  "favorite-genres": "free",
  stats: "free",
  "monthly-stats": "free",
  "rating-curve": "free",
  "activity-timeline": "free",
  "premium-tease": "free",
};

export function analysisCardMinTier(cardKey: string): AccountTier {
  return ANALYSIS_CARD_MIN_TIER[cardKey] ?? "free";
}
