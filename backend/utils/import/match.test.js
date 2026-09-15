import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCatalogIndex,
  collectLookupKeys,
  CONFIDENCE,
  docIds,
  docTitle,
  docYear,
  matchAll,
  matchItem,
} from "./match.js";
import { makeItem } from "./normalize.js";

// A catalogue whose documents use the several id shapes this collection has
// accumulated: nested under `id`, flat with a suffix, and bare.
const MOVIES = [
  { _id: "m1", title: "Dune", release_date: "2021-10-22", id: { tmdb: 438631, imdb: "tt1160419" } },
  { _id: "m2", title: "Dune", release_date: "1984-12-14", imdb_id: "tt0087182" },
  { _id: "m3", title: "The Thing", release_date: "1982-06-25", tmdb_id: 1091 },
  { _id: "m4", title: "Amélie", release_date: "2001-04-25", tmdb: 194 },
  { _id: "m5", title: "Sicario", release_date: "2015-09-18" },
  { _id: "m6", title: "WALL·E", release_date: "2008-06-27" },
];

const SERIES = [
  { _id: "s1", name: "Game of Thrones", first_air_date: "2011-04-17", id: { tvdb: 121361 } },
  { _id: "s2", title: "Severance", first_air_date: "2022-02-18" }, // name lives in `title`
];

const movieIndex = buildCatalogIndex(MOVIES, "movie");
const seriesIndex = buildCatalogIndex(SERIES, "series");

test("reads ids from every shape the catalogue uses", () => {
  assert.deepEqual(docIds(MOVIES[0]), { imdb: "tt1160419", tmdb: 438631 });
  assert.deepEqual(docIds(MOVIES[1]), { imdb: "tt0087182" });
  assert.deepEqual(docIds(MOVIES[2]), { tmdb: 1091 });
  assert.deepEqual(docIds(MOVIES[3]), { tmdb: 194 });
});

test("reads a series name from either field", () => {
  assert.equal(docTitle(SERIES[0], "series"), "Game of Thrones");
  assert.equal(docTitle(SERIES[1], "series"), "Severance");
  assert.equal(docTitle(MOVIES[0], "movie"), "Dune");
});

test("reads a year from release_date or first_air_date", () => {
  assert.equal(docYear(MOVIES[0]), 2021);
  assert.equal(docYear(SERIES[0]), 2011);
  assert.equal(docYear({}), null);
});

test("an imdb id wins outright, even against a contradicting year", () => {
  const result = matchItem(makeItem({ title: "Whatever", year: 1900, ids: { imdb: "tt0087182" } }), movieIndex);
  assert.equal(result.doc._id, "m2");
  assert.equal(result.via, "imdb");
  assert.equal(result.confidence, CONFIDENCE.ID);
});

test("a tmdb id matches a document storing it flat", () => {
  assert.equal(matchItem(makeItem({ title: "x", ids: { tmdb: 1091 } }), movieIndex).doc._id, "m3");
});

test("a tvdb id matches a series", () => {
  const result = matchItem(makeItem({ title: "x", type: "series", ids: { tvdb: 121361 } }), seriesIndex);
  assert.equal(result.doc._id, "s1");
});

test("title plus year picks the right one of two remakes", () => {
  assert.equal(matchItem(makeItem({ title: "Dune", year: 2021 }), movieIndex).doc._id, "m1");
  assert.equal(matchItem(makeItem({ title: "Dune", year: 1984 }), movieIndex).doc._id, "m2");
});

test("a year off by one still matches, at reduced confidence", () => {
  const result = matchItem(makeItem({ title: "Sicario", year: 2016 }), movieIndex);
  assert.equal(result.doc._id, "m5");
  assert.equal(result.confidence, CONFIDENCE.TITLE_YEAR_NEAR);
});

test("an ambiguous title with no year is refused rather than guessed", () => {
  // Two Dunes exist and nothing distinguishes them — importing the wrong
  // film is worse than importing neither.
  assert.equal(matchItem(makeItem({ title: "Dune" }), movieIndex), null);
});

test("an unambiguous title with no year is accepted at low confidence", () => {
  const result = matchItem(makeItem({ title: "Sicario" }), movieIndex);
  assert.equal(result.doc._id, "m5");
  assert.equal(result.confidence, CONFIDENCE.TITLE_ONLY);
});

test("a wrong year by more than one does not match a lone candidate loosely", () => {
  // "Sicario" 1999 is a different film that happens to share a title.
  const result = matchItem(makeItem({ title: "Sicario", year: 1999 }), movieIndex);
  assert.equal(result, null);
});

test("punctuation and diacritics do not prevent a match", () => {
  assert.equal(matchItem(makeItem({ title: "Amelie", year: 2001 }), movieIndex).doc._id, "m4");
  assert.equal(matchItem(makeItem({ title: "Wall-E", year: 2008 }), movieIndex).doc._id, "m6");
});

test("an article-swapped title matches loosely", () => {
  const result = matchItem(makeItem({ title: "Thing, The", year: 1982 }), movieIndex);
  assert.equal(result.doc._id, "m3");
  assert.equal(result.confidence, CONFIDENCE.TITLE_LOOSE);
});

test("nothing recognisable matches nothing", () => {
  assert.equal(matchItem(makeItem({ title: "A Film That Does Not Exist", year: 2020 }), movieIndex), null);
  assert.equal(matchItem(makeItem({ title: "" }), movieIndex), null);
});

test("matchAll partitions and reports which rule fired", () => {
  const { matched, unmatched, byRule } = matchAll(
    [
      makeItem({ title: "Dune", year: 2021, ids: { imdb: "tt1160419" } }),
      makeItem({ title: "Sicario", year: 2015 }),
      makeItem({ title: "Nonexistent", year: 2020 }),
    ],
    movieIndex
  );
  assert.equal(matched.length, 2);
  assert.equal(unmatched.length, 1);
  assert.equal(byRule.imdb, 1);
  assert.equal(byRule["title+year"], 1);
});

test("minConfidence refuses inferences the caller does not want", () => {
  const items = [makeItem({ title: "Sicario" })]; // title-only, 0.5
  assert.equal(matchAll(items, movieIndex).matched.length, 1);
  assert.equal(matchAll(items, movieIndex, CONFIDENCE.TITLE_YEAR).matched.length, 0);
});

test("lookup keys are deduplicated so the catalogue query stays small", () => {
  const keys = collectLookupKeys([
    makeItem({ title: "Dune", ids: { imdb: "tt1", tmdb: 1 } }),
    makeItem({ title: "Dune", ids: { imdb: "tt1" } }),
    makeItem({ title: "Sicario" }),
  ]);
  assert.deepEqual(keys.imdb, ["tt1"]);
  assert.deepEqual(keys.tmdb, [1]);
  assert.deepEqual(keys.titles.sort(), ["Dune", "Sicario"]);
});

test("an empty catalogue matches nothing without throwing", () => {
  const empty = buildCatalogIndex([], "movie");
  assert.equal(matchItem(makeItem({ title: "Dune", year: 2021 }), empty), null);
  assert.equal(empty.size, 0);
});

test("documents with no title do not poison the index", () => {
  const index = buildCatalogIndex([{ _id: "x" }, { _id: "y", title: "Dune", release_date: "2021-01-01" }], "movie");
  assert.equal(matchItem(makeItem({ title: "Dune", year: 2021 }), index).doc._id, "y");
});

test("accuracy: a representative library matches end to end", () => {
  // Each entry is a real-world way a source names something the catalogue
  // already holds.
  const cases = [
    [makeItem({ title: "Dune", year: 2021, ids: { tmdb: 438631 } }), "m1"],
    [makeItem({ title: "DUNE", year: 2021 }), "m1"],
    [makeItem({ title: "Dune", year: 1985 }), "m2"], // off-by-one
    [makeItem({ title: "The Thing", year: 1982 }), "m3"],
    [makeItem({ title: "Amélie", year: 2001 }), "m4"],
    [makeItem({ title: "Sicario", year: 2015 }), "m5"],
    [makeItem({ title: "WALL·E", year: 2008 }), "m6"],
  ];
  for (const [item, expected] of cases) {
    const result = matchItem(item, movieIndex);
    assert.ok(result, `${item.title} (${item.year}) should match`);
    assert.equal(result.doc._id, expected, `${item.title} (${item.year})`);
  }
});

// ---------------------------------------------------------------------------
// Catalogue twins: the same film stored twice (legacy + TMDB-enriched)
// ---------------------------------------------------------------------------

// The real pair from the bug report. The rich twin's ObjectId is newer.
const TRUMAN_LEGACY = { _id: "68ed03ce505e6ffb3b237290", title: "The Truman Show", release_date: "1998-06-04" };
const TRUMAN_RICH = { _id: "6a665a6e422d412dc658d5d9", title: "The Truman Show", release_date: "1998-06-04", tmdb_id: 37165 };

test("twins: without a preference the older legacy document wins, whatever order the database returns", () => {
  const item = makeItem({ title: "The Truman Show", year: 1998 });
  for (const docs of [[TRUMAN_LEGACY, TRUMAN_RICH], [TRUMAN_RICH, TRUMAN_LEGACY]]) {
    assert.equal(matchItem(item, buildCatalogIndex(docs, "movie")).doc._id, TRUMAN_LEGACY._id);
  }
});

test("twins: the one the user already has wins, so an import can't add the film twice", () => {
  const item = makeItem({ title: "The Truman Show", year: 1998 });
  for (const docs of [[TRUMAN_LEGACY, TRUMAN_RICH], [TRUMAN_RICH, TRUMAN_LEGACY]]) {
    const index = buildCatalogIndex(docs, "movie", { preferIds: [TRUMAN_RICH._id] });
    assert.equal(matchItem(item, index).doc._id, TRUMAN_RICH._id);
  }
});

test("twins: an id match defers to the user's own twin of the same film", () => {
  const item = makeItem({ title: "The Truman Show", year: 1998, ids: { tmdb: 37165 } });
  const plain = buildCatalogIndex([TRUMAN_LEGACY, TRUMAN_RICH], "movie");
  assert.equal(matchItem(item, plain).doc._id, TRUMAN_RICH._id, "without a preference the id match stands");
  const owned = buildCatalogIndex([TRUMAN_LEGACY, TRUMAN_RICH], "movie", { preferIds: [TRUMAN_LEGACY._id] });
  const result = matchItem(item, owned);
  assert.equal(result.doc._id, TRUMAN_LEGACY._id);
  assert.equal(result.via, "tmdb");
});

test("twins: no year, but exactly one twin is owned — that one is taken", () => {
  const item = makeItem({ title: "The Truman Show" });
  assert.equal(matchItem(item, buildCatalogIndex([TRUMAN_LEGACY, TRUMAN_RICH], "movie")), null);
  const index = buildCatalogIndex([TRUMAN_LEGACY, TRUMAN_RICH], "movie", { preferIds: [TRUMAN_LEGACY._id] });
  assert.equal(matchItem(item, index).doc._id, TRUMAN_LEGACY._id);
});

test("a preference never overrides a closer year: remakes stay distinct", () => {
  const index = buildCatalogIndex(MOVIES, "movie", { preferIds: ["m2"] });
  assert.equal(matchItem(makeItem({ title: "Dune", year: 2021 }), index).doc._id, "m1");
});
