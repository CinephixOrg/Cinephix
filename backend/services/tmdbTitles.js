import { tmdbConfigured, tmdbGet, tmdbGetCached } from "./tmdb.js";
import { countryCodes, pickMatch, titleAndDate } from "../utils/tmdbMatch.js";
import { readTmdbId } from "../utils/catalogUpsert.js";

/**
 * A catalog title's TMDB id.
 *
 * Most of the catalog has none, so the first time a title needs one it's
 * found on TMDB by title and date (utils/tmdbMatch.js) and kept on the title
 * — only the id, 13 bytes. A title with no sure match is marked so it isn't
 * searched for again. A TMDB error or timeout throws and marks nothing: the
 * next open tries again.
 */
export async function tmdbIdFor(model, doc, type) {
  const known = readTmdbId(doc);
  if (known) return known;
  if (doc.tmdb_unmatched || !tmdbConfigured()) return null;

  const { title, date } = titleAndDate(doc, type);
  const year = String(date ?? "").slice(0, 4);
  const search = await tmdbGet(type === "series" ? "/search/tv" : "/search/movie", {
    query: title ?? "",
    ...(/^\d{4}$/.test(year) ? { [type === "series" ? "first_air_date_year" : "primary_release_year"]: year } : {}),
  });
  const match = pickMatch(search.results, { title, date }, type);
  // The raw collection, so nothing else on the title changes (and the
  // models' strict:false schemas don't matter).
  await model.collection.updateOne({ _id: doc._id }, { $set: match ? { tmdb_id: match.id } : { tmdb_unmatched: true } });
  return match?.id ?? null;
}

// A stored TMDB rating is refreshed once it's this old.
const RATING_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Fewer votes than this and TMDB's average says little (a new show's "3.5
// from 2 votes"): no rating is shown.
export const MIN_TMDB_VOTES = 10;

/**
 * A title's TMDB rating — { average, count } — or null when there isn't one
 * worth showing.
 *
 * Kept on the title in the catalog's own vote_average/vote_count (the fields
 * the daily TMDB sync already fills), with tmdb_rated_at saying when, and
 * fetched again once that's a month old. Never throws: no match, too few
 * votes, or TMDB down or slow, and there's simply no rating.
 */
export async function tmdbRating(model, doc, type) {
  try {
    let average = doc.vote_average;
    let count = doc.vote_count;
    const fresh = doc.tmdb_rated_at && Date.now() - new Date(doc.tmdb_rated_at).getTime() < RATING_MAX_AGE_MS;
    if (!fresh) {
      const tmdbId = await tmdbIdFor(model, doc, type);
      if (!tmdbId) return null;
      const details = await tmdbGetCached(`/${type === "series" ? "tv" : "movie"}/${tmdbId}`);
      average = details.vote_average;
      count = details.vote_count;
      await model.collection.updateOne({ _id: doc._id }, { $set: { vote_average: average, vote_count: count, tmdb_rated_at: new Date() } });
    }
    if (!(count >= MIN_TMDB_VOTES) || typeof average !== "number") return null;
    return { average: Math.round(average * 10) / 10, count };
  } catch (error) {
    if (error?.name !== "AbortError") console.error("TMDB rating lookup failed:", error?.message);
    return null;
  }
}

/**
 * A title's production countries (ISO codes), for its detail page.
 *
 * A show carries them already. A movie's come from TMDB each time, never
 * stored — remembered in memory a while (services/tmdb.js). Never fails the
 * page: no match, or TMDB down or slow, and there are simply no countries.
 */
export async function productionCountries(model, doc, type) {
  if (type === "series") return countryCodes(doc, "series");
  try {
    const tmdbId = await tmdbIdFor(model, doc, type);
    if (!tmdbId) return [];
    return countryCodes(await tmdbGetCached(`/movie/${tmdbId}`), "movie");
  } catch (error) {
    if (error?.name !== "AbortError") console.error("Production countries lookup failed:", error?.message);
    return [];
  }
}
