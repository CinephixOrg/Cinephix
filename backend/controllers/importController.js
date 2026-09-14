import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import ActivityLog from "../models/ActivityLog.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess } from "../utils/response.js";
import { extractFiles, hashBuffer } from "../utils/import/archive.js";
import { normalizeFiles, selectFiles } from "../utils/import/adapters.js";
import { buildCatalogIndex, collectLookupKeys, matchAll, CONFIDENCE } from "../utils/import/match.js";
import { SOURCE_CATALOG, getSource } from "../utils/import/sources.js";
import { createTtlCache } from "../utils/ttlCache.js";
import { rebuildUserCineGraph } from "../utils/cineGraph.js";
import { resolveTmdbHits } from "../utils/catalogUpsert.js";

// One generic import endpoint behind every platform.
//
//   Upload -> Normalize -> Match -> Save
//
// The per-platform knowledge lives in utils/import/sources.js as data. This
// controller knows only the four stages, which is why adding a source costs
// a catalogue entry rather than a second copy of everything below.

// The matcher already refuses the cases it cannot decide (an ambiguous title
// with no year, a year that contradicts by more than one), so everything it
// does return is worth writing. Raising this trades recall for precision.
const MIN_CONFIDENCE = CONFIDENCE.TITLE_ONLY;

// Favourites are a hand-picked few per type on the profile, not a list —
// the same cap updateFavorites enforces.
const MAX_FAVORITES_PER_TYPE = 5;

// Parallel TMDB searches. Matches the old importer's chunk size, which sat
// comfortably inside TMDB's rate limit.
const TMDB_CONCURRENCY = 20;

// A ceiling on live lookups for titles the catalogue has never seen. Without
// one, a 20k-title library would issue 20k searches and take an hour; the
// import still succeeds, and the response reports what it skipped.
const TMDB_LOOKUP_LIMIT = 750;

// TMDB answers for a title+year never change in a way that matters here, and
// libraries overlap heavily between users. A day is long enough to serve a
// burst of imports from one lookup.
const tmdbCache = createTtlCache({ ttlMs: 24 * 60 * 60 * 1000, limit: 5000 });

// Guards against a double-submit — a retried upload, or a tap that fired
// twice — replaying an import that has already been applied.
const recentImports = createTtlCache({ ttlMs: 5 * 60 * 1000, limit: 200 });

// @desc    List the platforms an import can be run from
// @route   GET /api/users/import/sources
export const getImportSources = asyncHandler(async (req, res) => {
  // Static for the life of the deploy — let the client keep it. Private
  // rather than public: the request carries an Authorization header, and a
  // shared cache has no business storing it even though the body is the
  // same for everyone.
  res.set("Cache-Control", "private, max-age=86400");
  return sendSuccess(res, { sources: SOURCE_CATALOG }, "Import sources");
});

async function searchTmdb(type, title, year) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `${type}:${title.toLowerCase()}:${year ?? ""}`;
  const cached = tmdbCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const path = type === "series" ? "tv" : "movie";
  const yearParam = year ? (type === "series" ? `&first_air_date_year=${year}` : `&primary_release_year=${year}`) : "";
  const url = `https://api.themoviedb.org/3/search/${path}?query=${encodeURIComponent(title)}${yearParam}&api_key=${apiKey}`;

  let found = null;
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const results = data.results || [];
      // Trust the first result only when the year was part of the query or
      // there is nothing to disambiguate against — TMDB's relevance ranking
      // is good, but "first hit for a bare title" is how wrong films get
      // written into someone's history.
      found = results[0] || null;
      if (found && !year && results.length > 1) {
        const exact = results.find(
          (r) => (r.title || r.name || "").toLowerCase() === title.toLowerCase()
        );
        found = exact || null;
      }
    }
  } catch {
    // Network failure on an enrichment step is not an import failure.
  }

  tmdbCache.set(cacheKey, found);
  return found;
}

// Fetches the catalogue documents that could match these items.
//
// Two queries rather than one $or: the id lookups hit their indexes, and
// keeping the title lookup separate means a large title list can't stop the
// id half from using an index. Exact-title only — the fold-based matching
// that follows is what absorbs case, punctuation and diacritic differences
// between the documents this returns.
async function fetchCandidates(Model, items) {
  const { imdb, tmdb, tvdb, titles } = collectLookupKeys(items);
  const titleField = Model.modelName === "Series" ? "name" : "title";

  const idClauses = [];
  if (imdb.length) idClauses.push({ "id.imdb": { $in: imdb } }, { imdb_id: { $in: imdb } }, { imdb: { $in: imdb } });
  if (tmdb.length) idClauses.push({ "id.tmdb": { $in: tmdb } }, { tmdb_id: { $in: tmdb } }, { tmdb: { $in: tmdb } });
  if (tvdb.length) idClauses.push({ "id.tvdb": { $in: tvdb } }, { tvdb_id: { $in: tvdb } }, { tvdb: { $in: tvdb } });

  const projection = "title name release_date first_air_date id imdb_id tmdb_id tvdb_id imdb tmdb tvdb";

  // Series keep their name in `name` or `title` depending on how the
  // document was created, so both are queried; for movies the two collapse
  // to the same field and only one clause is issued.
  const titleClauses =
    titleField === "title"
      ? { title: { $in: titles } }
      : { $or: [{ title: { $in: titles } }, { [titleField]: { $in: titles } }] };

  const [byId, byTitle] = await Promise.all([
    idClauses.length ? Model.find({ $or: idClauses }).select(projection).lean() : [],
    titles.length ? Model.find(titleClauses).select(projection).lean() : [],
  ]);

  // Both queries routinely return the same document.
  const merged = new Map();
  for (const doc of byId) merged.set(String(doc._id), doc);
  for (const doc of byTitle) merged.set(String(doc._id), doc);
  return Array.from(merged.values());
}

// @desc    Import a library export from any supported platform
// @route   POST /api/users/import
export const runImport = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const startedAt = new Date();

  // SSE. Axios in React Native resolves only once the whole body has
  // arrived, but the client reads partial responseText off XMLHttpRequest as
  // it streams, so these blocks drive a real progress bar. Holding the
  // connection open also keeps intermediaries from timing out a long import.
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  // The client can vanish mid-import (cancelled, backgrounded, connection
  // dropped). Writing to a closed response throws, which would turn a
  // successful import into a logged crash.
  let clientGone = false;
  res.on("close", () => {
    clientGone = true;
  });

  const send = (data) => {
    if (clientGone || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  const fail = (message) => {
    send({ status: "error", message });
    return res.end();
  };
  const progress = (phase, text, current, total) =>
    send({ phase, text, ...(current !== undefined && { current }), ...(total !== undefined && { total }) });

  try {
    const sourceId = String(req.body?.source || "").toLowerCase();
    const source = getSource(sourceId);
    if (!source) return fail("Choose a platform to import from.");
    if (!req.file) return fail("No file was uploaded.");

    // ---- Idempotency -----------------------------------------------------
    const fingerprint = `${userId}:${sourceId}:${hashBuffer(req.file.buffer)}`;
    const replay = recentImports.get(fingerprint);
    if (replay) {
      send({ ...replay, replayed: true });
      return res.end();
    }

    // ---- Stage 0: unpack -------------------------------------------------
    progress("extract", "Reading your export…");
    let files;
    try {
      files = extractFiles(req.file.buffer, req.file.originalname || "");
    } catch {
      return fail("That file could not be opened. Make sure it is the export archive as downloaded.");
    }
    const selected = selectFiles(sourceId, files);
    if (selected.length === 0) {
      return fail(`No ${source.label} data was found in that file. Please upload the export as downloaded.`);
    }

    // ---- Stage 1-2: parse and normalize ----------------------------------
    progress("normalize", "Reading your library…");
    const { items, stats } = normalizeFiles(sourceId, selected);
    if (items.length === 0) return fail("That export contained no titles to import.");

    const movieItems = items.filter((item) => item.type === "movie");
    const seriesItems = items.filter((item) => item.type === "series");

    // ---- Stage 3: match --------------------------------------------------
    progress("match", `Matching ${items.length} titles…`, 0, items.length);
    const Movie = mongoose.model("Movie");
    const Series = mongoose.model("Series");

    // Everything this user already references. The catalogue holds some
    // films twice (a legacy record and a later TMDB-enriched one); the
    // matcher picks the twin the user already has, so an import can't add
    // the same film again under its other id.
    const owned = await User.findById(userId)
      .select("watchlist.itemId toWatchList.itemId favoriteMovies favoriteSeries")
      .lean();
    const preferIds = owned
      ? [
          ...(owned.watchlist || []).map((entry) => entry.itemId),
          ...(owned.toWatchList || []).map((entry) => entry.itemId),
          ...(owned.favoriteMovies || []),
          ...(owned.favoriteSeries || []),
        ].map(String)
      : [];

    const [movieDocs, seriesDocs] = await Promise.all([
      movieItems.length ? fetchCandidates(Movie, movieItems) : [],
      seriesItems.length ? fetchCandidates(Series, seriesItems) : [],
    ]);

    const movieResult = matchAll(movieItems, buildCatalogIndex(movieDocs, "movie", { preferIds }), MIN_CONFIDENCE);
    const seriesResult = matchAll(seriesItems, buildCatalogIndex(seriesDocs, "series", { preferIds }), MIN_CONFIDENCE);

    const matched = [...movieResult.matched, ...seriesResult.matched];
    const unmatched = [...movieResult.unmatched, ...seriesResult.unmatched];
    const byRule = { ...movieResult.byRule };
    for (const [rule, count] of Object.entries(seriesResult.byRule)) {
      byRule[rule] = (byRule[rule] || 0) + count;
    }

    // ---- Stage 3b: fill the gaps from TMDB -------------------------------
    let tmdbAdded = 0;
    let tmdbResolved = 0;
    let tmdbSkipped = 0;
    const stillUnmatched = [];

    if (unmatched.length > 0 && process.env.TMDB_API_KEY) {
      const lookups = unmatched.slice(0, TMDB_LOOKUP_LIMIT);
      tmdbSkipped = unmatched.length - lookups.length;
      stillUnmatched.push(...unmatched.slice(TMDB_LOOKUP_LIMIT));

      progress("lookup", `Looking up ${lookups.length} new titles…`, 0, lookups.length);
      const found = [];

      for (let i = 0; i < lookups.length; i += TMDB_CONCURRENCY) {
        // Nobody is waiting for the answer any more. Stop searching, but
        // still fall through to the save below: what has already been
        // matched is the user's own library, it is only ever added to, and
        // a later run picks up from there rather than starting over.
        if (clientGone) {
          stillUnmatched.push(...lookups.slice(i));
          break;
        }
        const chunk = lookups.slice(i, i + TMDB_CONCURRENCY);
        const hits = await Promise.all(chunk.map((item) => searchTmdb(item.type, item.title, item.year)));
        chunk.forEach((item, k) => {
          if (hits[k]) found.push({ item, hit: hits[k] });
          else stillUnmatched.push(item);
        });
        progress("lookup", `Looking up new titles…`, Math.min(i + TMDB_CONCURRENCY, lookups.length), lookups.length);
      }

      // Resolve every hit against the catalogue in one batch per type:
      // an existing TMDB id first, then a legacy record with the same title
      // and release date (enriched in place, keeping its _id), and only then
      // a new document. Resolving hit by hit on the TMDB id alone created a
      // second record for every film that so far existed only as a legacy
      // document.
      for (const type of ["movie", "series"]) {
        const group = found.filter((entry) => entry.item.type === type);
        if (group.length === 0) continue;
        let resolved;
        try {
          resolved = await resolveTmdbHits(type === "series" ? Series : Movie, type, group.map((entry) => entry.hit));
        } catch (error) {
          console.error(`Import: resolving ${type} lookups failed:`, error);
          stillUnmatched.push(...group.map((entry) => entry.item));
          continue;
        }
        for (const { item, hit } of group) {
          const entry = resolved.get(Number(hit.id));
          if (!entry) {
            stillUnmatched.push(item);
            continue;
          }
          matched.push({ item, doc: { _id: entry._id }, via: "tmdb", confidence: CONFIDENCE.ID });
          tmdbResolved += 1;
          if (entry.via === "created") tmdbAdded += 1;
        }
      }
      byRule.tmdb = tmdbResolved;
    } else {
      stillUnmatched.push(...unmatched);
    }

    // ---- Stage 4: save ---------------------------------------------------
    progress("save", "Saving to your profile…");
    const user = await User.findById(userId);
    if (!user) return fail("User not found.");

    user.watchlist = user.watchlist || [];
    user.toWatchList = user.toWatchList || [];
    // favoriteMovies/favoriteSeries are the fields the profile reads. This
    // used to write a `favorites` field that isn't on the User schema, so
    // Mongoose silently discarded every imported favorite.
    user.favoriteMovies = user.favoriteMovies || [];
    user.favoriteSeries = user.favoriteSeries || [];

    // `watchlist` is this schema's *watched* list and `toWatchList` is the
    // to-watch one — long-standing naming, not a mix-up here.
    const watchedIds = new Set(user.watchlist.map((entry) => String(entry.itemId)));
    const toWatchIds = new Set(user.toWatchList.map((entry) => String(entry.itemId)));
    const favoriteIds = new Set([...user.favoriteMovies, ...user.favoriteSeries].map(String));

    const existingRatings = await Rating.find({ user: userId }).select("contentId contentType").lean();
    const ratedKeys = new Set(existingRatings.map((r) => `${r.contentType}_${r.contentId}`));

    const newRatings = [];
    const addedWatchedIds = [];
    let addedWatched = 0;
    let addedWatchlist = 0;
    let addedFavorites = 0;
    let addedRatings = 0;
    let addedEpisodes = 0;
    let alreadyHad = 0;

    for (const { item, doc } of matched) {
      const id = String(doc._id);
      const type = item.type;
      let touched = false;

      if (item.watched && !watchedIds.has(id)) {
        user.watchlist.push({ itemId: doc._id, itemType: type, addedAt: item.watchedAt || startedAt });
        watchedIds.add(id);
        addedWatchedIds.push(id);
        addedWatched += 1;
        addedEpisodes += item.episodes || 0;
        touched = true;
      }

      // Only queue something the user hasn't already seen.
      if (item.watchlist && !item.watched && !toWatchIds.has(id) && !watchedIds.has(id)) {
        user.toWatchList.push({ itemId: doc._id, itemType: type, addedAt: startedAt });
        toWatchIds.add(id);
        // Recorded too: the activity log's revert pulls these ids out of
        // both lists, so leaving them out would make a watchlist-only
        // addition impossible to undo.
        addedWatchedIds.push(id);
        addedWatchlist += 1;
        touched = true;
      }

      const favoriteList = type === "series" ? user.favoriteSeries : user.favoriteMovies;
      if (item.favorite && !favoriteIds.has(id) && favoriteList.length < MAX_FAVORITES_PER_TYPE) {
        favoriteList.push(doc._id);
        favoriteIds.add(id);
        addedFavorites += 1;
        touched = true;
      }

      const ratingKey = `${type}_${id}`;
      if (item.rating !== null && !ratedKeys.has(ratingKey)) {
        newRatings.push({ user: userId, contentId: id, contentType: type, value: item.rating });
        ratedKeys.add(ratingKey);
        addedRatings += 1;
        touched = true;
      }

      if (!touched) alreadyHad += 1;
    }

    if (newRatings.length > 0) await Rating.insertMany(newRatings);
    const listsChanged = addedWatched + addedWatchlist + addedFavorites > 0;
    if (listsChanged) await user.save();
    // CineGraph counts Watched List titles and averages ratings, so either
    // kind of addition changes it.
    const cineGraphChanged = addedWatched > 0 || addedRatings > 0;
    if (cineGraphChanged) {
      try {
        await rebuildUserCineGraph(userId);
      } catch {
        // The graph rebuilds on the next change too — not worth failing an
        // otherwise successful import over.
      }
    }

    if (listsChanged || addedRatings > 0) {
      const ratingIds = newRatings.length
        ? (await Rating.find({ user: userId, createdAt: { $gte: startedAt } }).select("_id").lean()).map((r) => r._id)
        : [];
      await ActivityLog.create({
        userId,
        actionType: "IMPORT",
        details: `Imported ${matched.length} titles from ${source.label}`,
        payload: {
          source: sourceId,
          addedWatchlistIds: addedWatchedIds,
          addedRatingIds: ratingIds,
          updatedCineGraph: cineGraphChanged,
        },
      });
    }

    const summary = {
      status: "completed",
      source: sourceId,
      sourceLabel: source.label,
      durationMs: Date.now() - startedAt.getTime(),
      parsed: {
        files: selected.length,
        rows: stats.rows,
        titles: stats.items,
        movies: stats.movies,
        series: stats.series,
        ratingScale: stats.ratingScale,
      },
      matched: {
        total: matched.length,
        unmatched: stillUnmatched.length,
        skipped: tmdbSkipped,
        byRule,
        // What could not be resolved, so the user can see which titles were
        // left out instead of only how many.
        samples: stillUnmatched.slice(0, 25).map((item) => ({
          title: item.title,
          year: item.year,
          type: item.type,
        })),
      },
      added: {
        watched: addedWatched,
        watchlist: addedWatchlist,
        favorites: addedFavorites,
        ratings: addedRatings,
        episodes: addedEpisodes,
        alreadyHad,
        fromTmdb: tmdbAdded,
      },
      // The two keys the previous importer's clients read directly, so an
      // app build from before this change still shows a correct result.
      importedMovies: addedWatched,
      importedEpisodes: addedEpisodes,
    };

    recentImports.set(fingerprint, summary);
    send(summary);
    return res.end();
  } catch (error) {
    console.error("Import failed:", error);
    return fail(error?.message || "Something went wrong during the import.");
  }
});
