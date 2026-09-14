import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { computeCineGraphs } from "./cineGraph.js";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "./genreConstants.js";

const ACTION = MOVIE_GENRE_MAP[28];
const DRAMA = MOVIE_GENRE_MAP[18];
const COMEDY = MOVIE_GENRE_MAP[35];
const SERIES_DRAMA = SERIES_GENRE_MAP[18];

const MOVIE_A = "68ed03ce505e6ffb3b237290";
const MOVIE_B = "68ed03d9505e6ffb3b23f144";
const MOVIE_C = "68ed03d3505e6ffb3b23aed6";
const SHOW = "68ed07c7d4510a0b669c5f0f";

const genres = new Map([
  [MOVIE_A, [28, 18]],
  [MOVIE_B, [18]],
  [MOVIE_C, [35]],
]);
const seriesGenres = new Map([[SHOW, [18]]]);

const watched = (...ids) => ids.map((id) => ({ itemId: new mongoose.Types.ObjectId(id), itemType: "movie" }));
const plain = (map) => Object.fromEntries(map);

test("count is watched titles per genre, whether rated or not", () => {
  const { movie } = computeCineGraphs({ watchlist: watched(MOVIE_A, MOVIE_B), ratings: [], movieGenres: genres, seriesGenres });
  assert.deepEqual(plain(movie), {
    [ACTION]: { count: 1, ratedCount: 0, avgRating: 0 },
    [DRAMA]: { count: 2, ratedCount: 0, avgRating: 0 },
  });
});

test("rating a title never adds to count — the old double count", () => {
  const { movie } = computeCineGraphs({
    watchlist: watched(MOVIE_A),
    ratings: [{ contentId: MOVIE_A, value: 8 }],
    movieGenres: genres,
    seriesGenres,
  });
  assert.deepEqual(movie.get(DRAMA), { count: 1, ratedCount: 1, avgRating: 8 });
});

test("a removed title leaves nothing behind, even if it was rated", () => {
  const { movie } = computeCineGraphs({
    watchlist: watched(MOVIE_B),
    // The rating for A is still there if a caller forgot to delete it; it
    // isn't on the Watched List, so it doesn't count.
    ratings: [{ contentId: MOVIE_A, value: 10 }, { contentId: MOVIE_B, value: 6 }],
    movieGenres: genres,
    seriesGenres,
  });
  assert.equal(movie.has(ACTION), false);
  assert.deepEqual(movie.get(DRAMA), { count: 1, ratedCount: 1, avgRating: 6 });
});

test("ratings stored with an ObjectId contentId are found", () => {
  const { movie } = computeCineGraphs({
    watchlist: watched(MOVIE_A, MOVIE_B),
    ratings: [
      { contentId: new mongoose.Types.ObjectId(MOVIE_A), value: 9 },
      { contentId: MOVIE_B, value: 6 },
    ],
    movieGenres: genres,
    seriesGenres,
  });
  assert.deepEqual(movie.get(DRAMA), { count: 2, ratedCount: 2, avgRating: 7.5 });
});

test("both id forms for one title count once, using the newer rating", () => {
  const { movie } = computeCineGraphs({
    watchlist: watched(MOVIE_B),
    ratings: [
      { contentId: new mongoose.Types.ObjectId(MOVIE_B), value: 10 }, // seeded, no timestamps
      { contentId: MOVIE_B, value: 6, updatedAt: new Date("2026-08-14") },
    ],
    movieGenres: genres,
    seriesGenres,
  });
  assert.deepEqual(movie.get(DRAMA), { count: 1, ratedCount: 1, avgRating: 6 });
});

test("duplicate watched entries and repeated genre ids count once", () => {
  const { movie } = computeCineGraphs({
    watchlist: watched(MOVIE_C, MOVIE_C),
    ratings: [],
    movieGenres: new Map([[MOVIE_C, [35, 35]]]),
    seriesGenres,
  });
  assert.deepEqual(movie.get(COMEDY), { count: 1, ratedCount: 0, avgRating: 0 });
});

test("titles missing from the catalogue or with unknown genres are skipped", () => {
  const { movie } = computeCineGraphs({
    watchlist: watched(MOVIE_A, "6a0000000000000000000001"),
    ratings: [],
    movieGenres: new Map([[MOVIE_A, [999999]]]),
    seriesGenres,
  });
  assert.equal(movie.size, 0);
});

test("series use the series genre table and their own graph", () => {
  const { movie, series } = computeCineGraphs({
    watchlist: [{ itemId: SHOW, itemType: "series" }],
    ratings: [{ contentId: SHOW, value: 7 }],
    movieGenres: genres,
    seriesGenres,
  });
  assert.equal(movie.size, 0);
  assert.deepEqual(series.get(SERIES_DRAMA), { count: 1, ratedCount: 1, avgRating: 7 });
});

test("averages are rounded to two decimals", () => {
  const { movie } = computeCineGraphs({
    watchlist: watched(MOVIE_A, MOVIE_B),
    ratings: [
      { contentId: MOVIE_A, value: 7 },
      { contentId: MOVIE_B, value: 8 },
    ],
    movieGenres: new Map([
      [MOVIE_A, [18]],
      [MOVIE_B, [18]],
    ]),
    seriesGenres,
  });
  assert.equal(movie.get(DRAMA).avgRating, 7.5);
  const three = computeCineGraphs({
    watchlist: watched(MOVIE_A, MOVIE_B, MOVIE_C),
    ratings: [
      { contentId: MOVIE_A, value: 7 },
      { contentId: MOVIE_B, value: 8 },
      { contentId: MOVIE_C, value: 8 },
    ],
    movieGenres: new Map([
      [MOVIE_A, [18]],
      [MOVIE_B, [18]],
      [MOVIE_C, [18]],
    ]),
    seriesGenres,
  });
  assert.equal(three.movie.get(DRAMA).avgRating, 7.67);
});
