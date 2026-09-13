// 2 one-off (not tiered) badges, same shape as syncBadgeDefinitions.ts's
// own — a single image + title, no ladder to browse, no share button
// wired anywhere yet (same scope note as sync/loyalty's one-offs).
export interface SeasonalBadgeDefinition {
  family: "halloweenViewer" | "newYearViewer";
  key: string;
  titleKey: string;
  image: number;
}

export const SEASONAL_BADGE_DEFINITIONS: SeasonalBadgeDefinition[] = [
  {
    family: "halloweenViewer",
    key: "halloweenViewer",
    titleKey: "Halloween Viewer",
    image: require("../../assets/badges/seasonal/badge_halloween_viewer.png"),
  },
  {
    family: "newYearViewer",
    key: "newYearViewer",
    titleKey: "New Year Viewer",
    image: require("../../assets/badges/seasonal/badge_new_year_viewer.png"),
  },
];
