// Finding a catalog movie on TMDB, for details the catalog doesn't carry
// (services/movieCountries.js). The catalog has no TMDB id for most movies,
// only a title and a release date, so a search result counts only when both
// agree — anything less and the movie is left without the detail rather
// than given another film's.
//
// Pure, so it runs under `node --test` (tmdbMovieMatch.test.js).

/** A title for comparing: case, accents, punctuation and spacing don't count. */
export function normalizeTitle(title) {
  return String(title ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // Back together: NFKD also splits Hangul syllables into their letters.
    .normalize("NFC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The search result that is this movie: same title (or original title) and same release year; else null. */
export function pickMatch(results, { title, releaseDate }) {
  const year = String(releaseDate ?? "").slice(0, 4);
  const wanted = normalizeTitle(title);
  if (!wanted || !/^\d{4}$/.test(year)) return null;
  return (
    (results ?? []).find(
      (result) =>
        String(result.release_date ?? "").slice(0, 4) === year &&
        [result.title, result.original_title].some((candidate) => normalizeTitle(candidate) === wanted)
    ) ?? null
  );
}

/** ISO codes from a TMDB movie's production_countries, in TMDB's order. */
export function countryCodes(productionCountries) {
  return [...new Set((productionCountries ?? []).map((country) => country?.iso_3166_1).filter((code) => /^[A-Z]{2}$/.test(code ?? "")))];
}
