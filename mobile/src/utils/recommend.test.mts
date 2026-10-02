import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RECOMMEND_QUERY,
  contentHref,
  genreNames,
  formatRating,
  recommendFilterCount,
  searchKey,
  shouldSearch,
  toPicked,
  toggleIn,
} from "./recommend.ts";
import type { Movie, Series } from "../types/index.ts";

const GENRES = [
  { id: 18, name: "Drama" },
  { id: 80, name: "Crime" },
  { id: 53, name: "Thriller" },
  { id: 28, name: "Action" },
];

test("nothing to search by means no search", () => {
  assert.equal(shouldSearch(DEFAULT_RECOMMEND_QUERY), false);
  assert.equal(shouldSearch({ ...DEFAULT_RECOMMEND_QUERY, query: "   " }), false);
  assert.equal(shouldSearch({ ...DEFAULT_RECOMMEND_QUERY, query: "heat" }), true);
  assert.equal(shouldSearch({ ...DEFAULT_RECOMMEND_QUERY, genres: [18] }), true, "a filter alone browses");
});

test("equal searches share a key whatever order their filters were picked in", () => {
  const a = searchKey({ type: "movie", query: " Heat ", years: ["1995", "1990"], genres: [80, 18] });
  const b = searchKey({ type: "movie", query: "heat", years: ["1990", "1995"], genres: [18, 80] });
  assert.equal(a, b);
  assert.notEqual(a, searchKey({ type: "series", query: "heat", years: ["1990", "1995"], genres: [18, 80] }));
});

test("the filter badge counts Series, years and genres", () => {
  assert.equal(recommendFilterCount(DEFAULT_RECOMMEND_QUERY), 0);
  assert.equal(recommendFilterCount({ type: "series", query: "x", years: ["2020"], genres: [18, 80] }), 4);
});

test("toggleIn adds and removes", () => {
  assert.deepEqual(toggleIn([1, 2], 3), [1, 2, 3]);
  assert.deepEqual(toggleIn([1, 2], 1), [2]);
});

test("a picked movie carries its year, rating and up to three genre names", () => {
  const movie = {
    _id: "m1",
    title: "Heat",
    release_date: "1995-12-15",
    poster_path: "/heat.jpg",
    overview: "A cat-and-mouse thriller.",
    vote_average: 8.26,
    genre_ids: [80, 18, 99, 53, 28],
  } as unknown as Movie;
  const picked = toPicked(movie, "movie", GENRES);
  assert.deepEqual(picked, {
    contentType: "movie",
    contentId: "m1",
    title: "Heat",
    posterUrl: "/heat.jpg",
    genres: ["Crime", "Drama", "Thriller"],
    releaseYear: 1995,
    overview: "A cat-and-mouse thriller.",
    rating: 8.26,
  });
});

test("a series with missing data leaves those fields out rather than inventing them", () => {
  const series = { _id: "s1", name: "Dark", first_air_date: "", poster_path: null, vote_average: 0 } as unknown as Series;
  const picked = toPicked(series, "series", GENRES);
  assert.equal(picked.title, "Dark");
  assert.equal(picked.releaseYear, undefined);
  assert.equal(picked.posterUrl, undefined);
  assert.equal(picked.rating, undefined);
  assert.deepEqual(picked.genres, []);
});

test("ratings read with one decimal", () => {
  assert.equal(formatRating(8.26), "8.3");
  assert.equal(formatRating(7), "7.0");
  assert.equal(formatRating(0), null);
  assert.equal(formatRating(undefined), null);
});

test("a recommendation opens its title in the chat's own stack", () => {
  assert.equal(contentHref("/socials/messages/c1", "movie", "m1"), "/socials/content/movie/m1");
  assert.equal(contentHref("/socials/communities/noir", "series", "s1"), "/socials/content/series/s1");
  assert.equal(contentHref("/user/u42/chat", "movie", "m1"), "/user/u42/content/movie/m1");
});

test("genre ids become up to three names, skipping unknown ids", () => {
  assert.deepEqual(genreNames([18, 12345, 80, 53, 28], GENRES), ["Drama", "Crime", "Thriller"]);
  assert.deepEqual(genreNames(undefined, GENRES), []);
});
