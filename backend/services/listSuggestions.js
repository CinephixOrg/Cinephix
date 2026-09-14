import mongoose from "mongoose";
import { createTtlCache } from "../utils/ttlCache.js";
import { readTmdbId, resolveTmdbHits } from "../utils/catalogUpsert.js";
import { catalogKey, createTitleMatcher, mergeRecommendations } from "../utils/listSuggestions.js";

// Suggestions for a list being built: "people who liked these also liked".
//
// For each seed (the last few titles added) TMDB's recommendations for that
// title, falling back to TMDB's similar titles when it has none. A seed with
// no TMDB id — much of the catalogue is a legacy import without one — or no
// TMDB answer uses the catalogue's own genre-overlap match instead. The
// seeds' lists are merged into one pool (utils/listSuggestions.js) and
// matched to catalogue records without writing anything: a recommendation
// the catalogue doesn't have is simply skipped.
//
// "Already on the list" is decided by title as well as by record. The
// catalogue holds some titles twice (a legacy record beside a TMDB-keyed
// one), so a list can hold one record of Breaking Bad while its
// recommendations resolve to the other; matching by kind, title and year
// keeps it out either way, and keeps two records of one title from both
// being suggested.

const TMDB_TIMEOUT_MS = 4000;
// A title's recommendations barely move within a day of edits.
const RECOMMENDATIONS_TTL_MS = 6 * 60 * 60 * 1000;
const PER_SEED = 20;
const LOCAL_CANDIDATE_POOL = 400;
const LOCAL_MIN_VOTE_COUNT = 20;
const OBJECT_ID = /^[a-f\d]{24}$/;

const recommendationsCache = createTtlCache({ ttlMs: RECOMMENDATIONS_TTL_MS, limit: 2000 });

const MODELS = {
  movie: () => mongoose.connection.model("Movie"),
  series: () => mongoose.connection.model("Series"),
};
const TMDB_PATH = { movie: "movie", series: "tv" };

const titleOf = (type, doc) => (type === "series" ? doc.name ?? doc.title : doc.title ?? doc.name) ?? "";
const dateOf = (type, doc) => (type === "series" ? doc.first_air_date : doc.release_date) || null;

/** TMDB results for a path, [] when TMDB has none, or null when TMDB couldn't be reached. */
async function tmdbResults(path, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.themoviedb.org/3${path}?api_key=${apiKey}&page=1`, { signal: controller.signal });
    if (response.status === 404) return [];
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** TMDB's recommendations for a title, or its similar titles when it has none. Null when TMDB is unavailable. */
async function tmdbRecommendations(type, tmdbId) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `${type}:${tmdbId}`;
  const cached = recommendationsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let hits = [];
  for (const endpoint of ["recommendations", "similar"]) {
    const results = await tmdbResults(`/${TMDB_PATH[type]}/${tmdbId}/${endpoint}`, apiKey);
    // Not cached: the next request tries TMDB again.
    if (results === null) return null;
    if (results.length > 0) {
      hits = results;
      break;
    }
  }
  recommendationsCache.set(cacheKey, hits);
  return hits;
}

function fromTmdb(type, hit) {
  return {
    key: `tmdb:${type}:${hit.id}`,
    type,
    tmdbHit: hit,
    title: (type === "series" ? hit.name : hit.title) ?? "",
    posterPath: hit.poster_path ?? null,
    releaseDate: (type === "series" ? hit.first_air_date : hit.release_date) || null,
  };
}

// The catalogue's own match: titles sharing the most genres with the seed,
// from a popularity-sorted pool with a vote floor to keep obscure noise out
// (the same approach as GET /api/content/:type/:id/similar).
async function localSimilar(seed) {
  const genres = seed.doc.genre_ids || [];
  if (genres.length === 0) return [];
  const candidates = await MODELS[seed.itemType]()
    .find({ _id: { $ne: seed.doc._id }, genre_ids: { $in: genres }, vote_count: { $gte: LOCAL_MIN_VOTE_COUNT } })
    .select("title name poster_path genre_ids vote_average release_date first_air_date")
    .sort({ popularity: -1 })
    .limit(LOCAL_CANDIDATE_POOL)
    .lean();

  const wanted = new Set(genres);
  return candidates
    .map((doc) => ({ doc, overlap: (doc.genre_ids || []).filter((g) => wanted.has(g)).length }))
    .sort((a, b) => b.overlap - a.overlap || (b.doc.vote_average || 0) - (a.doc.vote_average || 0))
    .slice(0, PER_SEED)
    .map(({ doc }) => ({
      key: `db:${seed.itemType}:${doc._id}`,
      type: seed.itemType,
      catalogId: doc._id,
      title: titleOf(seed.itemType, doc),
      posterPath: doc.poster_path ?? null,
      releaseDate: dateOf(seed.itemType, doc),
    }));
}

async function candidatesFor(seed) {
  const tmdbId = readTmdbId(seed.doc);
  if (tmdbId !== null) {
    const hits = await tmdbRecommendations(seed.itemType, tmdbId);
    if (hits && hits.length > 0) return hits.slice(0, PER_SEED).map((hit) => fromTmdb(seed.itemType, hit));
  }
  return localSimilar(seed);
}

/**
 * What's already on the list, in the forms a duplicate record can be
 * recognized by: each title (kind, title, year) and each TMDB id.
 */
async function describeExcluded(exclude) {
  const idsByType = { movie: [], series: [] };
  for (const key of exclude) {
    const [type, id] = key.split(":");
    if (idsByType[type] && OBJECT_ID.test(id)) idsByType[type].push(id);
  }
  const titles = createTitleMatcher();
  const tmdbIds = { movie: new Set(), series: new Set() };
  await Promise.all(
    Object.entries(idsByType).map(async ([type, ids]) => {
      if (ids.length === 0) return;
      const docs = await MODELS[type]()
        .find({ _id: { $in: ids } })
        .select("title name release_date first_air_date id tmdb_id tmdb")
        .lean();
      for (const doc of docs) {
        titles.add(type, titleOf(type, doc), dateOf(type, doc));
        const tmdbId = readTmdbId(doc);
        if (tmdbId !== null) tmdbIds[type].add(tmdbId);
      }
    })
  );
  return { titles, tmdbIds };
}

/**
 * Up to `limit` titles to suggest for a list, best first:
 * `[{ id, type, title, poster_path, releaseDate }]`.
 */
export async function suggestForList({ seeds, exclude, limit }) {
  const [seedDocs, excluded] = await Promise.all([
    Promise.all(
      seeds.map(async (seed) => {
        const doc = await MODELS[seed.itemType]().findById(seed.itemId).select("id tmdb_id tmdb genre_ids").lean();
        return doc ? { ...seed, doc } : null;
      })
    ),
    describeExcluded(exclude),
  ]);
  const ranked = await Promise.all(seedDocs.filter(Boolean).map((seed) => candidatesFor(seed).catch(() => [])));

  const suggestedTitles = createTitleMatcher();
  const merged = mergeRecommendations(ranked).filter((candidate) => {
    if (!candidate.posterPath) return false;
    if (candidate.tmdbHit && excluded.tmdbIds[candidate.type].has(Number(candidate.tmdbHit.id))) return false;
    if (excluded.titles.has(candidate.type, candidate.title, candidate.releaseDate)) return false;
    // Two records of one title, reached through different seeds, show once.
    if (suggestedTitles.has(candidate.type, candidate.title, candidate.releaseDate)) return false;
    suggestedTitles.add(candidate.type, candidate.title, candidate.releaseDate);
    return true;
  });

  // Only the top of the pool is matched against the catalogue, with headroom
  // for titles it doesn't have.
  const pool = merged.slice(0, limit * 2 + 10);
  const hitsByType = { movie: [], series: [] };
  for (const candidate of pool) if (candidate.tmdbHit) hitsByType[candidate.type].push(candidate.tmdbHit);
  // Read-only: suggesting a title must never write to (or duplicate) the catalogue.
  const [resolvedMovies, resolvedSeries] = await Promise.all([
    hitsByType.movie.length ? resolveTmdbHits(MODELS.movie(), "movie", hitsByType.movie, { write: false }) : new Map(),
    hitsByType.series.length ? resolveTmdbHits(MODELS.series(), "series", hitsByType.series, { write: false }) : new Map(),
  ]);
  const resolved = { movie: resolvedMovies, series: resolvedSeries };

  const taken = new Set(exclude);
  const items = [];
  for (const candidate of pool) {
    const catalogId = candidate.catalogId ?? resolved[candidate.type].get(Number(candidate.tmdbHit?.id))?._id;
    if (!catalogId) continue;
    const key = catalogKey(candidate.type, catalogId);
    if (taken.has(key)) continue;
    taken.add(key);
    items.push({
      id: String(catalogId),
      type: candidate.type,
      title: candidate.title,
      poster_path: candidate.posterPath,
      releaseDate: candidate.releaseDate,
    });
    if (items.length >= limit) break;
  }
  return { items };
}
