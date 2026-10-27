import { countryCodes, pickMatch } from "../utils/tmdbMovieMatch.js";

// Long enough for TMDB's usual answer, short enough that a slow one doesn't
// hold up the detail page: past it, the page opens without countries.
const TMDB_TIMEOUT_MS = 2500;

async function tmdb(path, params, signal) {
  const query = new URLSearchParams({ ...params, api_key: process.env.TMDB_API_KEY });
  const res = await fetch(`https://api.themoviedb.org/3${path}?${query}`, { signal });
  if (!res.ok) throw new Error(`TMDB ${path} ${res.status}`);
  return res.json();
}

/**
 * A movie's production countries (ISO codes) for its detail page.
 *
 * The catalog doesn't carry them, and for most movies has no TMDB id to look
 * them up by either. So the first time a movie's page is opened it's found
 * on TMDB by title and release year (utils/tmdbMovieMatch.js) and its
 * countries are kept on the movie — an empty list when there's no sure
 * match, so it isn't searched for again. Every later open reads them
 * straight from the movie.
 *
 * Never fails the page: on a TMDB error or timeout the movie comes back as
 * it was, and the next open tries again.
 */
export async function withProductionCountries(movieModel, movie) {
  if (Array.isArray(movie.production_countries) || !process.env.TMDB_API_KEY) return movie;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);
  try {
    let tmdbId = Number(movie.tmdb_id) || null;
    if (!tmdbId) {
      const year = String(movie.release_date ?? "").slice(0, 4);
      const search = await tmdb("/search/movie", { query: movie.title ?? "", primary_release_year: year }, controller.signal);
      tmdbId = pickMatch(search.results, { title: movie.title, releaseDate: movie.release_date })?.id ?? null;
    }
    const codes = tmdbId ? countryCodes((await tmdb(`/movie/${tmdbId}`, {}, controller.signal)).production_countries) : [];

    // The raw collection, so the movie's own fields (and its strict:false
    // schema) are left exactly as they were apart from these two.
    await movieModel.collection.updateOne(
      { _id: movie._id },
      { $set: { production_countries: codes, ...(tmdbId && !movie.tmdb_id ? { tmdb_id: tmdbId } : {}) } }
    );
    return { ...movie, production_countries: codes };
  } catch (error) {
    if (error?.name !== "AbortError") console.error("Production countries lookup failed:", error?.message);
    return movie;
  } finally {
    clearTimeout(timer);
  }
}
