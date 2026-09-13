import type { ActivityTier } from "../types";

// Same single-metric-ladder shape as activityBadgeDefinitions.ts (hence
// reusing its `ActivityTier`/`ActivityBadge`/`ActivityBadgeResponse` types
// rather than a parallel Social* set — the shape is identical, only the
// data source differs) — followers (real audience size), influencer
// (total likes received across a user's own Shares), and podium (how many
// of the people-podium's own categories this user currently ranks top-3
// in). Deliberately no live "you just earned it!" popup wiring anywhere
// for these 3 — see badgeController.js's own FOLLOWERS_TIERS/
// INFLUENCER_TIERS doc comment and feedController.js's own
// computePodiumBadge doc comment for exactly why (each crosses its
// threshold from someone ELSE's action or a ranking shift, not the
// viewer's own, so there's no single request to hang a live notification
// off of) — they're still fully real, correctly computed badges, visible
// and shareable from the Badges tab, just never announced the instant
// they're earned.
export const SOCIAL_TIER_ORDER: Record<string, ActivityTier[]> = {
  followers: ["tier1", "tier2", "tier3", "tier4"],
  influencer: ["tier1", "tier2", "tier3"],
  podium: ["tier1", "tier2", "tier3"],
};

export interface SocialBadgeDefinition {
  family: "followers" | "influencer" | "podium";
  key: string; // matches badgeController.js's/feedController.js's own single key per family
  label: string; // translatable plural noun ("Followers"/"Likes"/"Podiums")
  tierImages: Partial<Record<ActivityTier, number>>;
  tierLabelKeys: Partial<Record<ActivityTier, string>>; // tier -> translation key for the invented rank name
}

export const SOCIAL_BADGE_DEFINITIONS: SocialBadgeDefinition[] = [
  {
    family: "followers",
    key: "followers",
    label: "Followers",
    tierImages: {
      tier1: require("../../assets/badges/social/badge_followers_tier1.png"),
      tier2: require("../../assets/badges/social/badge_followers_tier2.png"),
      tier3: require("../../assets/badges/social/badge_followers_tier3.png"),
      tier4: require("../../assets/badges/social/badge_followers_tier4.png"),
    },
    tierLabelKeys: { tier1: "Familiar Face", tier2: "Rising Star", tier3: "Local Celebrity", tier4: "Icon" },
  },
  {
    family: "influencer",
    key: "likes",
    label: "Likes",
    tierImages: {
      tier1: require("../../assets/badges/social/badge_influencer_tier1.png"),
      tier2: require("../../assets/badges/social/badge_influencer_tier2.png"),
      tier3: require("../../assets/badges/social/badge_influencer_tier3.png"),
    },
    tierLabelKeys: { tier1: "Voice", tier2: "Influencer", tier3: "Luminary" },
  },
  {
    family: "podium",
    key: "podium",
    label: "Podiums",
    tierImages: {
      tier1: require("../../assets/badges/social/badge_podium_tier1.png"),
      tier2: require("../../assets/badges/social/badge_podium_tier2.png"),
      tier3: require("../../assets/badges/social/badge_podium_tier3.png"),
    },
    tierLabelKeys: { tier1: "Contender", tier2: "Champion", tier3: "Legend" },
  },
];
