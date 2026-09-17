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
  {
    key: "adventure",
    label: "Adventure",
    devotee: require("../../assets/badges/genres/badge_genre_adventure_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_adventure_master.png"),
  },
  {
    key: "animation",
    label: "Animation",
    devotee: require("../../assets/badges/genres/badge_genre_animation_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_animation_master.png"),
  },
  {
    key: "crime",
    label: "Crime",
    devotee: require("../../assets/badges/genres/badge_genre_crime_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_crime_master.png"),
  },
  {
    key: "family",
    label: "Family",
    devotee: require("../../assets/badges/genres/badge_genre_family_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_family_master.png"),
  },
  {
    key: "fantasy",
    label: "Fantasy",
    devotee: require("../../assets/badges/genres/badge_genre_fantasy_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_fantasy_master.png"),
  },
  {
    key: "history",
    label: "History",
    devotee: require("../../assets/badges/genres/badge_genre_history_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_history_master.png"),
  },
  {
    key: "musical",
    label: "Musical",
    devotee: require("../../assets/badges/genres/badge_genre_musical_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_musical_master.png"),
  },
  {
    key: "mystery",
    label: "Mystery",
    devotee: require("../../assets/badges/genres/badge_genre_mystery_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_mystery_master.png"),
  },
  {
    key: "war",
    label: "War",
    devotee: require("../../assets/badges/genres/badge_genre_war_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_war_master.png"),
  },
  {
    key: "western",
    label: "Western",
    devotee: require("../../assets/badges/genres/badge_genre_western_devotee.png"),
    master: require("../../assets/badges/genres/badge_genre_western_master.png"),
  },
];
