import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SUGGESTIONS,
  MAX_SEEDS,
  MAX_SUGGESTIONS,
  catalogKey,
  createTitleMatcher,
  mergeRecommendations,
  parseSuggestionRequest,
} from "./listSuggestions.js";

// ---- Duplicate records ------------------------------------------------------------

test("a title on the list matches its duplicate record: same kind, title and year", () => {
  const onList = createTitleMatcher();
  onList.add("series", "Breaking Bad", "2008-01-20");
  // The TMDB twin of the legacy record the user added.
  assert.equal(onList.has("series", "Breaking Bad", "2008-01-20"), true);
  assert.equal(onList.has("series", "breaking  bad!", "2008-09-01"), true);
  // A different kind or year is a different title.
  assert.equal(onList.has("movie", "Breaking Bad", "2008-01-20"), false);
  assert.equal(onList.has("series", "Breaking Bad", "2019-10-11"), false);
});

test("a record without a year still matches its dated twin, either way round", () => {
  const onList = createTitleMatcher();
  onList.add("series", "The Mentalist", null);
  assert.equal(onList.has("series", "The Mentalist", "2008-09-23"), true);
  const dated = createTitleMatcher();
  dated.add("series", "The Mentalist", "2008-09-23");
  assert.equal(dated.has("series", "The Mentalist", ""), true);
});

test("accents and punctuation don't make a different title", () => {
  const onList = createTitleMatcher();
  onList.add("movie", "Amélie", "2001-04-25");
  assert.equal(onList.has("movie", "AMELIE", "2001"), true);
  assert.equal(onList.has("movie", "", "2001"), false);
});

const id = (n) => n.toString(16).padStart(24, "0");
const c = (key) => ({ key });

// ---- Requests -------------------------------------------------------------------

test("reads seeds, keeps only the most recent few, and always excludes them", () => {
  const seeds = [1, 2, 3, 4].map((n) => ({ itemId: id(n), itemType: "movie" }));
  const request = parseSuggestionRequest({ seeds, exclude: [{ itemId: id(9), itemType: "series" }] });
  assert.equal(request.seeds.length, MAX_SEEDS);
  assert.deepEqual(request.seeds.map((seed) => seed.itemId), [id(2), id(3), id(4)]);
  assert.ok(request.exclude.has(catalogKey("series", id(9))));
  assert.ok(request.exclude.has(catalogKey("movie", id(4))));
  assert.equal(request.limit, DEFAULT_SUGGESTIONS);
});

test("clamps the limit and ignores malformed exclusions", () => {
  const seeds = [{ itemId: id(1), itemType: "series" }];
  assert.equal(parseSuggestionRequest({ seeds, limit: 500 }).limit, MAX_SUGGESTIONS);
  assert.equal(parseSuggestionRequest({ seeds, limit: 0 }).limit, 1);
  const request = parseSuggestionRequest({ seeds, exclude: [{ itemId: "x", itemType: "movie" }, null] });
  assert.equal(request.exclude.size, 1);
});

test("rejects a request without valid seeds", () => {
  for (const body of [undefined, {}, { seeds: [] }, { seeds: [{ itemId: "1", itemType: "movie" }] }, { seeds: [{ itemId: id(1), itemType: "book" }] }]) {
    assert.ok(parseSuggestionRequest(body).error, JSON.stringify(body));
  }
  assert.ok(parseSuggestionRequest({ seeds: [{ itemId: id(1), itemType: "movie" }], exclude: "nope" }).error);
});

// ---- Merging ----------------------------------------------------------------------

test("a title recommended for more of the seeds ranks first", () => {
  const merged = mergeRecommendations([
    [c("a"), c("shared")],
    [c("b"), c("c"), c("shared")],
  ]);
  assert.equal(merged[0].key, "shared");
});

test("otherwise the pool takes turns from each seed", () => {
  const merged = mergeRecommendations([
    [c("a1"), c("a2")],
    [c("b1"), c("b2")],
    [c("c1")],
  ]);
  assert.deepEqual(merged.map((x) => x.key), ["a1", "b1", "c1", "a2", "b2"]);
});

test("each title appears once", () => {
  const merged = mergeRecommendations([[c("x"), c("y")], [c("y"), c("x")]]);
  assert.deepEqual(merged.map((x) => x.key).sort(), ["x", "y"]);
});

test("nothing to merge is an empty pool", () => {
  assert.deepEqual(mergeRecommendations([]), []);
  assert.deepEqual(mergeRecommendations([[], null]), []);
});
