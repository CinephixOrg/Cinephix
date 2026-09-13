// Static art + display table for genre badges — the backend
// (badgeController.js's GENRE_BADGES) owns which genre-name combination
// each `key` maps to and the actual devotee/master thresholds; this file
// only owns what the app needs to RENDER a key it gets back: a label and
// the two tier images. Genre names are deliberately left untranslated,
// same convention every other genre label in this app already follows
// (ProfileCinegraphsTab, ProfileAnalysisCardDeck's own `{{genre}}`
// interpolations) — they're TMDB's own English taxonomy, not localized.
export interface GenreBadgeDefinition {
  key: string;
  label: string;
  devotee: number;
  master: number;
}

export const GENRE_BADGE_DEFINITIONS: GenreBadgeDefinition[] = [
  {
    key: "action",
    label: "Action",
    devotee: require("../../assets/badges/genres/badge_genre_action_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_action_master.png"),
  },
  {
    key: "comedy",
    label: "Comedy",
    devotee: require("../../assets/badges/genres/badge_genre_comedy_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_comedy_master.png"),
  },
  {
    key: "drama",
    label: "Drama",
    devotee: require("../../assets/badges/genres/badge_genre_drama_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_drama_master.png"),
  },
  {
    key: "horror",
    label: "Horror",
    devotee: require("../../assets/badges/genres/badge_genre_horror_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_horror_master.png"),
  },
  {
    key: "romance",
    label: "Romance",
    devotee: require("../../assets/badges/genres/badge_genre_romance_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_romance_master.png"),
  },
  {
    key: "thriller",
    label: "Thriller",
    devotee: require("../../assets/badges/genres/badge_genre_thriller_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_thriller_master.png"),
  },
  {
    key: "scifi",
    label: "Sci-Fi",
    devotee: require("../../assets/badges/genres/badge_genre_scifi_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_scifi_master.png"),
  },
  {
    key: "documentary",
    label: "Documentary",
    devotee: require("../../assets/badges/genres/badge_genre_documentary_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_documentary_master.png"),
  },
];
