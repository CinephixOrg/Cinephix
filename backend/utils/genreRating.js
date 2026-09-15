// The rating CineMatch uses for one CineGraph genre when comparing two users.
//
// A genre someone has watched but never rated has avgRating 0 in their
// CineGraph (utils/cineGraph.js). Compared as-is, that 0 reads as "hated
// everything in it" and drags their rating similarity with everyone down —
// most of all against people who rated the genre highly. An unrated genre is
// treated as a neutral 2.5 stars instead.

/** 2.5 of 5 stars, on Rating.value's 1-10 scale (the scale CineGraph averages use). */
export const NEUTRAL_GENRE_RATING = 5;

export function genreRatingForScore(node) {
  if (!node || typeof node.avgRating !== "number") return NEUTRAL_GENRE_RATING;
  // Graphs written before ratedCount existed carry only avgRating; for those
  // a real average is anything above 0, since ratings start at 1.
  const rated = typeof node.ratedCount === "number" ? node.ratedCount > 0 : node.avgRating > 0;
  return rated ? node.avgRating : NEUTRAL_GENRE_RATING;
}
