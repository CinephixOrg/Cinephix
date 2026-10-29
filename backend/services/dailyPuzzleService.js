import { conn } from "../db/connections.js";
import { createMovieModel } from "../models/Movie.js";
import { createSeriesModel } from "../models/Series.js";
import DailyPuzzle from "../models/DailyPuzzle.js";
import DailyPuzzleLapState from "../models/DailyPuzzleLapState.js";
import { logger } from "../middleware/logger.js";

const Movie = createMovieModel(conn);
const Series = createSeriesModel(conn);

// Live-checked against this app's real catalog (2026-10-24): `vote_count`
// is only backfilled by the nightly TMDB trending-sync cron
// (tmdbSyncService.js), not the original bulk import, so it's a genuine
// "has this title actually been seen as popular/trending" signal rather
// than a raw catalog field — ~20 is low enough to pull in a few hundred
// combined movie/series candidates today (not just the top ~140 at a
// vote_count>=100 bar) while still excluding near-zero-vote noise, and the
// pool only grows as that sync keeps running.
const MIN_VOTE_COUNT = 20;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

async function buildEligiblePool() {
  const [movies, series] = await Promise.all([
    Movie.find({ vote_count: { $gte: MIN_VOTE_COUNT }, poster_path: { $exists: true, $ne: null } })
      .select("_id")
      .lean(),
    Series.find({ vote_count: { $gte: MIN_VOTE_COUNT }, poster_path: { $exists: true, $ne: null } })
      .select("_id")
      .lean(),
  ]);
  return [
    ...movies.map((m) => ({ contentId: m._id, contentType: "movie" })),
    ...series.map((s) => ({ contentId: s._id, contentType: "series" })),
  ];
}

// Shuffle-once + walk-a-position-pointer, same lap pattern
// officialContentService.js's pickFromPool already established for "one
// deterministic pick per day for everyone" — not a date-hash. Advances
// DailyPuzzleLapState exactly once per call; callers (the midnight cron,
// and the lazy self-heal below) are responsible for only calling this once
// per real day.
async function advanceLap() {
  let lapState = await DailyPuzzleLapState.findOne({});
  if (!lapState) lapState = await DailyPuzzleLapState.create({ order: [], position: 0 });

  if (lapState.position >= lapState.order.length) {
    lapState.order = shuffle(await buildEligiblePool());
    lapState.position = 0;
  }
  if (lapState.order.length === 0) {
    await lapState.save();
    return null;
  }

  const picked = lapState.order[lapState.position];
  lapState.position += 1;
  await lapState.save();
  return picked;
}

async function hydrate(contentId, contentType) {
  const model = contentType === "movie" ? Movie : Series;
  const doc = await model.findById(contentId).select("title name poster_path").lean();
  if (!doc) return null;
  return { title: doc.title || doc.name, posterPath: doc.poster_path || null };
}

// Writes today's DailyPuzzle doc if one doesn't already exist. Called from
// the midnight cron (server.js) and, defensively, from
// getOrCreateTodaysPuzzle below in case that cron tick was ever missed —
// either way this never picks twice for the same date (DailyPuzzle.date
// has a unique index, and the lap position only advances when a pick is
// actually about to be written).
export async function pickTodaysPuzzle() {
  const date = todayDateKey();
  const existing = await DailyPuzzle.findOne({ date }).lean();
  if (existing) return existing;

  const picked = await advanceLap();
  if (!picked) {
    logger.error("dailyPuzzleService: no eligible titles in the pool — check MIN_VOTE_COUNT / catalog state");
    return null;
  }

  const content = await hydrate(picked.contentId, picked.contentType);
  if (!content) {
    // The picked id vanished from the catalog between selection and
    // hydration (deleted title) — try once more rather than leaving today
    // with no puzzle at all.
    return pickTodaysPuzzle();
  }

  try {
    return await DailyPuzzle.create({
      date,
      contentId: picked.contentId,
      contentType: picked.contentType,
      title: content.title,
      posterPath: content.posterPath,
    });
  } catch (err) {
    // Unique-index race (two near-simultaneous callers both tried to
    // create today's doc) — the loser just reads what the winner wrote.
    if (err.code === 11000) return DailyPuzzle.findOne({ date }).lean();
    throw err;
  }
}

export async function getOrCreateTodaysPuzzle() {
  const date = todayDateKey();
  const existing = await DailyPuzzle.findOne({ date }).lean();
  return existing || pickTodaysPuzzle();
}

export { todayDateKey };
