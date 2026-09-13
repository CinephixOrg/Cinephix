// 3 one-off (not tiered) badges built from the CineMatch "Sync" feature —
// unlike every ladder family (volume/activity/social), these are simple
// earned-or-not badges: one static image, no level-dot strip, no multiple
// rungs to browse. Modeled on the backend as a degenerate 1-rung ladder
// (badgeController.js's FIRST_SYNC_TIERS/HIGH_MATCH_TIERS/
// SYNC_EXPLORER_TIERS each have exactly one `{tier:"tier1",threshold}`
// entry) purely so the share-verification dispatch table needs no special
// casing — mobile-side, ProfileBadgesTab.tsx builds these using the same
// plain `BadgeTile` genre badges already use (image + label, tinted gray
// when locked, tap opens a plain BadgeDetailModal with no `tiers` strip),
// not the LadderTile/buildLadderTile pair the tiered families use.
export interface SyncBadgeDefinition {
  family: "firstSync" | "highMatch" | "syncExplorer";
  key: string; // matches badgeController.js's own single key per family
  titleKey: string; // translation key for the badge's own display name
  image: number;
}

export const SYNC_BADGE_DEFINITIONS: SyncBadgeDefinition[] = [
  {
    family: "firstSync",
    key: "firstSync",
    titleKey: "First Sync",
    image: require("../../assets/badges/sync/badge_first_sync.png"),
  },
  {
    family: "highMatch",
    key: "highMatch",
    titleKey: "High Match",
    image: require("../../assets/badges/sync/badge_high_match.png"),
  },
  {
    family: "syncExplorer",
    key: "syncExplorer",
    titleKey: "Sync Explorer",
    image: require("../../assets/badges/sync/badge_sync_explorer.png"),
  },
];
