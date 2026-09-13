import type { ActivityTier, StreakTier } from "../types";

// Founding Cinephile — one-off, same shape as syncBadgeDefinitions.ts's
// own one-off badges (a single image + title, no ladder to browse).
export const FOUNDING_CINEPHILE_DEFINITION = {
  family: "founding" as const,
  key: "founding",
  titleKey: "Founding Cinephile",
  image: require("../../assets/badges/loyalty/badge_founding_cinephile.png"),
};

// Membership anniversary — a real 3-tier ladder (generic tier1..tier3,
// same neutral-tier convention every ladder besides genre/streak uses),
// its own invented rank words distinct from every other family's.
export const MEMBERSHIP_TIER_ORDER: ActivityTier[] = ["tier1", "tier2", "tier3"];
export const MEMBERSHIP_BADGE_DEFINITION = {
  family: "membership" as const,
  key: "membership",
  label: "Days",
  tierImages: {
    tier1: require("../../assets/badges/loyalty/badge_anniversary_tier1.png"),
    tier2: require("../../assets/badges/loyalty/badge_anniversary_tier2.png"),
    tier3: require("../../assets/badges/loyalty/badge_anniversary_tier3.png"),
  } as Record<ActivityTier, number>,
  tierLabelKeys: { tier1: "Member", tier2: "Loyalist", tier3: "Veteran" } as Record<ActivityTier, string>,
};

// Streak — the one other ladder (besides genre) whose tier VALUES are
// real, fixed milestones rather than generic "tier1".."tierN" — 7/30/100
// consecutive days, matching the badge art's own file names
// (badge_streak_7day/30day/100day.png). No `tierLabelKeys` map: unlike
// every invented-word ladder, the display title is built directly from
// the tier's own real day-count via one shared translated template
// ("{{days}}-Day Streak") rather than a per-tier translated word — see
// ProfileBadgesTab.tsx's own streak tile construction.
export const STREAK_TIER_ORDER: StreakTier[] = ["7day", "30day", "100day"];
export const STREAK_BADGE_DEFINITION = {
  family: "streak" as const,
  key: "streak",
  label: "Days",
  tierImages: {
    "7day": require("../../assets/badges/loyalty/badge_streak_7day.png"),
    "30day": require("../../assets/badges/loyalty/badge_streak_30day.png"),
    "100day": require("../../assets/badges/loyalty/badge_streak_100day.png"),
  } as Record<StreakTier, number>,
};
