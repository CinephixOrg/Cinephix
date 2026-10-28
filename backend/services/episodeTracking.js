// A series' seasons and episodes, for its detail page's episode tracking
// (TC-141). From TMDB each time — nothing here is stored in the catalogue —
// and remembered in memory a few hours (services/tmdb.js), since the same
// shows are opened again and again.
import { tmdbGetCached } from "./tmdb.js";
import { tmdbIdFor } from "./tmdbTitles.js";

const today = () => new Date().toISOString().slice(0, 10);
const aired = (date) => Boolean(date) && date <= today();

/**
 * { tmdbId, seasons, lastAired } for a catalogue series, or null when it has
 * no TMDB match. `seasons` lists regular seasons first and Specials (season
 * 0) last, each { season_number, name, episode_count, air_date };
 * `lastAired` is the newest aired episode, { s, e }, or null before the
 * first one. Throws when TMDB is down or slow: the caller says so rather
 * than showing a series with no episodes.
 */
export async function seriesSeasons(model, doc) {
  const tmdbId = await tmdbIdFor(model, doc, "series");
  if (!tmdbId) return null;
  const details = await tmdbGetCached(`/tv/${tmdbId}`);
  const seasons = (details.seasons ?? [])
    .filter((season) => season.episode_count > 0)
    .map(({ season_number, name, episode_count, air_date }) => ({ season_number, name, episode_count, air_date: air_date ?? null }))
    .sort((a, b) => (a.season_number === 0) - (b.season_number === 0) || a.season_number - b.season_number);
  const last = details.last_episode_to_air;
  const lastAired = last?.season_number > 0 ? { s: last.season_number, e: last.episode_number } : null;
  return { tmdbId, seasons, lastAired };
}

/**
 * One season's episodes: [{ episode_number, name, air_date, runtime, aired }].
 * Only what the episode list shows — no overviews or stills.
 */
export async function seasonEpisodes(tmdbId, seasonNumber) {
  const season = await tmdbGetCached(`/tv/${tmdbId}/season/${seasonNumber}`);
  return (season.episodes ?? []).map(({ episode_number, name, air_date, runtime }) => ({
    episode_number,
    name: name ?? null,
    air_date: air_date ?? null,
    runtime: runtime ?? null,
    aired: aired(air_date),
  }));
}
