// 5 one-off (not tiered) badges, same shape as syncBadgeDefinitions.ts's
// own — a single image + title, no ladder to browse. Eclectic Taste is
// the one exception with a real, meaningful `count` (distinct genres
// touched, see badgeController.js's own computeEclecticTasteBadge) —
// still rendered as a plain one-off tile here since there's no ladder of
// separate rungs to browse, just a single threshold to clear.
export interface SpecialBadgeDefinition {
  family: "timeTraveler" | "eclecticTaste" | "dayOneViewer" | "hiddenGem" | "pollParticipant";
  key: string;
  titleKey: string;
  image: number;
}

export const SPECIAL_BADGE_DEFINITIONS: SpecialBadgeDefinition[] = [
  {
    family: "timeTraveler",
    key: "timeTraveler",
    titleKey: "Time Traveler",
    image: require("../../assets/badges/special/badge_time_traveler.png"),
  },
  {
    family: "eclecticTaste",
    key: "eclecticTaste",
    titleKey: "Eclectic Taste",
    image: require("../../assets/badges/special/badge_eclectic_taste.png"),
  },
  {
    family: "dayOneViewer",
    key: "dayOneViewer",
    titleKey: "Day-One Viewer",
    image: require("../../assets/badges/special/badge_day_one_viewer.png"),
  },
  {
    family: "hiddenGem",
    key: "hiddenGem",
    titleKey: "Hidden Gem Hunter",
    image: require("../../assets/badges/special/badge_hidden_gem_hunter.png"),
  },
  {
    family: "pollParticipant",
    key: "pollParticipant",
    titleKey: "Poll Participant",
    image: require("../../assets/badges/special/badge_poll_participant.png"),
  },
];
