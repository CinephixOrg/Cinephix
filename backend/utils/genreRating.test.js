import { test } from "node:test";
import assert from "node:assert/strict";
import { NEUTRAL_GENRE_RATING, genreRatingForScore } from "./genreRating.js";

test("the neutral baseline is 2.5 stars on the 1-10 scale", () => {
  assert.equal(NEUTRAL_GENRE_RATING, 5);
});

test("a rated genre keeps its real average", () => {
  assert.equal(genreRatingForScore({ count: 4, ratedCount: 2, avgRating: 8.5 }), 8.5);
  assert.equal(genreRatingForScore({ count: 1, ratedCount: 1, avgRating: 1 }), 1);
});

test("a watched but unrated genre is neutral, not 0", () => {
  assert.equal(genreRatingForScore({ count: 3, ratedCount: 0, avgRating: 0 }), NEUTRAL_GENRE_RATING);
});

test("graphs written before ratedCount existed: a real average counts, 0 is unrated", () => {
  assert.equal(genreRatingForScore({ count: 2, avgRating: 7 }), 7);
  assert.equal(genreRatingForScore({ count: 2, avgRating: 0 }), NEUTRAL_GENRE_RATING);
});

test("missing or malformed nodes are neutral", () => {
  assert.equal(genreRatingForScore(undefined), NEUTRAL_GENRE_RATING);
  assert.equal(genreRatingForScore({ count: 2 }), NEUTRAL_GENRE_RATING);
  assert.equal(genreRatingForScore({ count: 2, ratedCount: 1, avgRating: null }), NEUTRAL_GENRE_RATING);
});
