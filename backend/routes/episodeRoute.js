// routes/episodeRoute.js — a series' seasons and episodes, and which of them
// the signed-in user has watched (TC-141). Mounted at /api/episodes.
import express from "express";
import mongoose from "mongoose";
import authMiddleware from "../middleware/authMiddleware.js";
import EpisodeProgress from "../models/EpisodeProgress.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendError, sendSuccess } from "../utils/response.js";
import { seasonEpisodes, seriesSeasons } from "../services/episodeTracking.js";
import { markAll, markEpisodes, progressSummary } from "../utils/episodeProgress.js";

const router = express.Router();
const getSeries = () => mongoose.connection.model("Series");

const isCount = (value) => Number.isInteger(value) && value >= 0;

/** The series, its seasons from TMDB, and this user's progress — or an error already sent. */
async function load(req, res) {
  const { seriesId } = req.params;
  if (!mongoose.isValidObjectId(seriesId)) return sendError(res, "Invalid series", 400);
  const model = getSeries();
  const doc = await model.findById(seriesId).select("_id name title first_air_date tmdb_id id tmdb tmdb_unmatched").lean();
  if (!doc) return sendError(res, "Series not found", 404);
  let tmdb;
  try {
    tmdb = await seriesSeasons(model, doc);
  } catch {
    return sendError(res, "Episodes are unavailable right now", 503);
  }
  const progress = await EpisodeProgress.findOne({ user: req.user.id, series: doc._id }).select("eps all").lean();
  return { doc, tmdb, progress };
}

const payload = (tmdb, progress) => ({
  seasons: tmdb.seasons,
  lastAired: tmdb.lastAired,
  progress: { eps: progress?.eps ?? [], all: progress?.all ?? null },
  summary: progressSummary(progress, tmdb.seasons, tmdb.lastAired),
});

/**
 * Stores the new progress. Read, changed and written whole, so two changes
 * to the same series at once could lose one — the app sends them one at a
 * time (mobile/src/api/episodeService.ts). Nothing left watched removes the
 * document rather than keeping an empty one.
 */
async function save(userId, seriesId, next) {
  if (next.eps.length === 0 && !next.all) {
    await EpisodeProgress.deleteOne({ user: userId, series: seriesId });
    return null;
  }
  return EpisodeProgress.findOneAndUpdate(
    { user: userId, series: seriesId },
    { $set: { eps: next.eps, all: next.all } },
    { upsert: true, new: true, projection: { eps: 1, all: 1 } }
  ).lean();
}

// GET /api/episodes/:seriesId — seasons, the newest aired episode, and the
// user's progress. `data` is null for a series TMDB doesn't know.
router.get(
  "/:seriesId",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const loaded = await load(req, res);
    if (!loaded) return;
    if (!loaded.tmdb) return sendSuccess(res, null);
    sendSuccess(res, payload(loaded.tmdb, loaded.progress));
  })
);

// GET /api/episodes/:seriesId/seasons/:season — that season's episodes.
router.get(
  "/:seriesId/seasons/:season",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const season = Number(req.params.season);
    if (!isCount(season)) return sendError(res, "Invalid season", 400);
    const loaded = await load(req, res);
    if (!loaded) return;
    if (!loaded.tmdb) return sendError(res, "Series not found on TMDB", 404);
    try {
      sendSuccess(res, await seasonEpisodes(loaded.tmdb.tmdbId, season));
    } catch {
      sendError(res, "Episodes are unavailable right now", 503);
    }
  })
);

// PUT /api/episodes/:seriesId/watched — { season, episode?, watched }.
// Without `episode`, the whole season: marking takes its aired episodes,
// unmarking all of them.
router.put(
  "/:seriesId/watched",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { season, episode, watched } = req.body ?? {};
    if (!isCount(season) || (episode !== undefined && !(isCount(episode) && episode > 0)) || typeof watched !== "boolean") {
      return sendError(res, "Invalid episode", 400);
    }
    const loaded = await load(req, res);
    if (!loaded) return;
    if (!loaded.tmdb) return sendError(res, "Series not found on TMDB", 404);

    let episodes;
    if (episode !== undefined) {
      episodes = [{ s: season, e: episode }];
    } else {
      try {
        const list = await seasonEpisodes(loaded.tmdb.tmdbId, season);
        episodes = list.filter((ep) => !watched || ep.aired).map((ep) => ({ s: season, e: ep.episode_number }));
      } catch {
        return sendError(res, "Episodes are unavailable right now", 503);
      }
    }
    const next = markEpisodes(loaded.progress, episodes, watched, { seasons: loaded.tmdb.seasons });
    const saved = await save(req.user.id, loaded.doc._id, next);
    sendSuccess(res, payload(loaded.tmdb, saved));
  })
);

// PUT /api/episodes/:seriesId/watched-all — { watched }. Marked: every
// episode aired so far, as past viewing (no date). Unmarked: nothing.
router.put(
  "/:seriesId/watched-all",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { watched } = req.body ?? {};
    if (typeof watched !== "boolean") return sendError(res, "Invalid request", 400);
    const loaded = await load(req, res);
    if (!loaded) return;
    if (!loaded.tmdb) return sendError(res, "Series not found on TMDB", 404);
    if (watched && !loaded.tmdb.lastAired) return sendError(res, "No episodes have aired yet", 409);
    const saved = await save(req.user.id, loaded.doc._id, markAll(loaded.progress, loaded.tmdb.lastAired, watched));
    sendSuccess(res, payload(loaded.tmdb, saved));
  })
);

export default router;
