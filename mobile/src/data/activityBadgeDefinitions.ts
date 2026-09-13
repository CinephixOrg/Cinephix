import type { ActivityTier } from "../types";

// 3 independent single-metric ladders (rating count, review count, list
// count) — each gets one slot + level-dot tile, same "one slot per ladder"
// treatment volume badges already established (see ProfileBadgesTab.tsx's
// own doc comment on why). Unlike volume's shared 5-tier VOLUME_TIER_ORDER,
// each of these has its OWN tier count (5/4/3) and its OWN invented rank
// ladder — reusing "Amateur"/"Enthusiast"/... here would blur two
// unrelated achievements together, so every ladder gets fully distinct
// words instead.
export const ACTIVITY_TIER_ORDER: Record<string, ActivityTier[]> = {
  ratingCount: ["tier1", "tier2", "tier3", "tier4", "tier5"],
  reviewCount: ["tier1", "tier2", "tier3", "tier4"],
  listCount: ["tier1", "tier2", "tier3"],
};

export interface ActivityBadgeDefinition {
  family: "ratingCount" | "reviewCount" | "listCount";
  key: string; // "ratings" | "reviews" | "lists" — matches badgeController.js's own single key per family
  label: string; // translatable plural noun ("Ratings"/"Reviews"/"Lists" — all 3 already exist as keys elsewhere in the app)
  tierImages: Partial<Record<ActivityTier, number>>;
  tierLabelKeys: Partial<Record<ActivityTier, string>>; // tier -> translation key for the invented rank name
}

export const ACTIVITY_BADGE_DEFINITIONS: ActivityBadgeDefinition[] = [
  {
    family: "ratingCount",
    key: "ratings",
    label: "Ratings",
    tierImages: {
      tier1: require("../../assets/badges/activity/badge_rating_count_tier1.png"),
      tier2: require("../../assets/badges/activity/badge_rating_count_tier2.png"),
      tier3: require("../../assets/badges/activity/badge_rating_count_tier3.png"),
      tier4: require("../../assets/badges/activity/badge_rating_count_tier4.png"),
      tier5: require("../../assets/badges/activity/badge_rating_count_tier5.png"),
    },
    tierLabelKeys: { tier1: "Newcomer", tier2: "Rater", tier3: "Critic", tier4: "Tastemaker", tier5: "Oracle" },
  },
  {
    family: "reviewCount",
    key: "reviews",
    label: "Reviews",
    tierImages: {
      tier1: require("../../assets/badges/activity/badge_review_writer_tier1.png"),
      tier2: require("../../assets/badges/activity/badge_review_writer_tier2.png"),
      tier3: require("../../assets/badges/activity/badge_review_writer_tier3.png"),
      tier4: require("../../assets/badges/activity/badge_review_writer_tier4.png"),
    },
    tierLabelKeys: { tier1: "Rookie", tier2: "Reviewer", tier3: "Wordsmith", tier4: "Author" },
  },
  {
    family: "listCount",
    key: "lists",
    label: "Lists",
    tierImages: {
      tier1: require("../../assets/badges/activity/badge_list_creator_tier1.png"),
      tier2: require("../../assets/badges/activity/badge_list_creator_tier2.png"),
      tier3: require("../../assets/badges/activity/badge_list_creator_tier3.png"),
    },
    tierLabelKeys: { tier1: "Organizer", tier2: "Curator", tier3: "Archivist" },
  },
];
