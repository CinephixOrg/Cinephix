import type { VolumeTier } from "../types";

// Same "static art + display table, backend owns the real thresholds"
// split genreBadgeDefinitions.ts already established. Order matters here
// beyond readability: VOLUME_TIER_ORDER's own index is what the level-dot
// indicator (ProfileBadgesTab.tsx) reads as "how many dots are filled."
export const VOLUME_TIER_ORDER: VolumeTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];

export interface VolumeBadgeDefinition {
  key: string;
  label: string;
  tiers: Record<VolumeTier, number>;
}

export const VOLUME_BADGE_DEFINITIONS: VolumeBadgeDefinition[] = [
  {
    key: "movies",
    label: "Movies",
    tiers: {
      bronze: require("../../assets/badges/volume/badge_movies_bronze.png"),
      silver: require("../../assets/badges/volume/badge_movies_silver.png"),
      gold: require("../../assets/badges/volume/badge_movies_gold.png"),
      platinum: require("../../assets/badges/volume/badge_movies_platinum.png"),
      diamond: require("../../assets/badges/volume/badge_movies_diamond.png"),
    },
  },
  {
    key: "series",
    label: "Series",
    tiers: {
      bronze: require("../../assets/badges/volume/badge_series_bronze.png"),
      silver: require("../../assets/badges/volume/badge_series_silver.png"),
      gold: require("../../assets/badges/volume/badge_series_gold.png"),
      platinum: require("../../assets/badges/volume/badge_series_platinum.png"),
      diamond: require("../../assets/badges/volume/badge_series_diamond.png"),
    },
  },
];
