// Finding a catalog title on TMDB, for details the catalog doesn't carry
// (services/tmdbTitles.js). Most of the catalog has no TMDB id, only a title
// and a date, so a search result counts only when those agree — the rule
// catalogUpsert.js's findLegacyTwin uses the other way round: the exact date
// first, else the one result from that year with that title; two from the
// same year could be different titles, so that's no match. Anything less and
// the title goes without the detail rather than getting another's.
//
// Pure, so it runs under `node --test` (tmdbMatch.test.js).

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

const FIELDS = {
  movie: { titles: ["title", "original_title"], date: "release_date" },
  series: { titles: ["name", "original_name"], date: "first_air_date" },
};

/** A catalog title's own title and date, whichever shape it's stored in. */
export function titleAndDate(doc, type) {
  return type === "series"
    ? { title: doc.name ?? doc.title, date: doc.first_air_date }
    : { title: doc.title ?? doc.name, date: doc.release_date };
}

/** The search result that is this title, or null. */
export function pickMatch(results, { title, date }, type) {
  const fields = FIELDS[type];
  const wanted = normalizeTitle(title);
  const year = String(date ?? "").slice(0, 4);
  if (!fields || !wanted || !/^\d{4}$/.test(year)) return null;

  const sameTitle = (results ?? []).filter((result) => fields.titles.some((field) => normalizeTitle(result[field]) === wanted));
  const exact = sameTitle.find((result) => result[fields.date] === date);
  if (exact) return exact;
  const sameYear = sameTitle.filter((result) => String(result[fields.date] ?? "").slice(0, 4) === year);
  return sameYear.length === 1 ? sameYear[0] : null;
}

/** ISO country codes from a TMDB movie's production_countries or a show's origin_country, once each, in order. */
export function countryCodes(details, type) {
  const raw = type === "series" ? details?.origin_country ?? [] : (details?.production_countries ?? []).map((country) => country?.iso_3166_1);
  return [...new Set(raw.filter((code) => /^[A-Z]{2}$/.test(code ?? "")))];
}
