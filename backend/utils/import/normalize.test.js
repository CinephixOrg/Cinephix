import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHeaderIndex,
  cleanIds,
  cleanImdbId,
  cleanNumericId,
  dedupe,
  foldTitle,
  foldTitleLoose,
  inferScale,
  itemKey,
  makeItem,
  mergeItems,
  normalizeRating,
  normalizeType,
  parseBoolean,
  parseDate,
  parseYear,
  pickField,
} from "./normalize.js";

test("folding makes punctuation and case irrelevant", () => {
  assert.equal(foldTitle("WALL·E"), foldTitle("Wall-E"));
  assert.equal(foldTitle("Spider-Man: No Way Home"), "spider man no way home");
});

test("folding strips diacritics so Amélie matches Amelie", () => {
  assert.equal(foldTitle("Amélie"), foldTitle("Amelie"));
});

test("folding normalizes ampersands to the written word", () => {
  assert.equal(foldTitle("Fire & Blood"), foldTitle("Fire and Blood"));
});

test("loose folding drops leading articles and un-swaps trailing ones", () => {
  assert.equal(foldTitleLoose("The Thing"), "thing");
  assert.equal(foldTitleLoose("Thing, The"), "thing");
  assert.equal(foldTitleLoose("A Ghost Story"), "ghost story");
});

test("years are read from bare values, ISO dates and parentheses", () => {
  assert.equal(parseYear("2021"), 2021);
  assert.equal(parseYear("2021-03-04"), 2021);
  assert.equal(parseYear("(1999)"), 1999);
  assert.equal(parseYear(1984), 1984);
});

test("implausible years are rejected rather than stored", () => {
  assert.equal(parseYear("not a year"), null);
  assert.equal(parseYear(""), null);
  assert.equal(parseYear(null), null);
  assert.equal(parseYear("12"), null);
  assert.equal(parseYear(1200), null);
});

test("ratings convert onto the 1-10 scale the app stores", () => {
  assert.equal(normalizeRating(4.5, 5), 9); // Letterboxd half-stars
  assert.equal(normalizeRating(5, 5), 10);
  assert.equal(normalizeRating(8, 10), 8); // IMDb / MAL
  assert.equal(normalizeRating(87, 100), 9); // AniList /100
  assert.equal(normalizeRating(14, 20), 7); // Kitsu /20
});

test("ratings clamp into range and reject non-values", () => {
  assert.equal(normalizeRating(0, 10), null);
  assert.equal(normalizeRating("", 10), null);
  assert.equal(normalizeRating(null, 10), null);
  assert.equal(normalizeRating(-3, 10), null);
  assert.equal(normalizeRating(99, 10), 10);
  assert.equal(normalizeRating(0.4, 5), 1); // rounds to 0, clamps up to 1
});

test("comma decimals from European exports still parse", () => {
  assert.equal(normalizeRating("3,5", 5), 7);
});

test("scale inference reads the shape of the data", () => {
  assert.equal(inferScale([4.5, 3, 5]), 5); // fractional, tops out at 5
  assert.equal(inferScale([8, 9, 10]), 10);
  assert.equal(inferScale([70, 85, 90]), 100);
  assert.equal(inferScale([]), 10);
  assert.equal(inferScale([3, 5]), 10); // integers only — not a star scale
});

test("type words map to the two kinds the app has", () => {
  assert.equal(normalizeType("tvSeries"), "series");
  assert.equal(normalizeType("TV Mini Series"), "series");
  assert.equal(normalizeType("movie"), "movie");
  assert.equal(normalizeType("tvMovie"), "movie");
  assert.equal(normalizeType("OVA"), "series");
  assert.equal(normalizeType(undefined, "series"), "series");
  assert.equal(normalizeType("videoGame", "movie"), "movie");
});

test("imdb ids are canonicalized and bare digits get the prefix", () => {
  assert.equal(cleanImdbId("tt0111161"), "tt0111161");
  assert.equal(cleanImdbId("https://www.imdb.com/title/tt0111161/"), "tt0111161");
  assert.equal(cleanImdbId("0111161"), "tt0111161");
  assert.equal(cleanImdbId(""), undefined);
  assert.equal(cleanImdbId("nm0000123"), undefined);
});

test("numeric ids reject TV Time's -1 unknown marker", () => {
  assert.equal(cleanNumericId("-1"), undefined);
  assert.equal(cleanNumericId(-1), undefined);
  assert.equal(cleanNumericId("0"), undefined);
  assert.equal(cleanNumericId("1399"), 1399);
  assert.equal(cleanNumericId(""), undefined);
});

test("cleanIds omits absent providers instead of storing falsy values", () => {
  assert.deepEqual(cleanIds({ imdb: "tt1", tmdb: "", tvdb: "-1" }), {});
  assert.deepEqual(cleanIds({ imdb: "tt12345", tmdb: "603" }), { imdb: "tt12345", tmdb: 603 });
});

test("column lookup ignores case and punctuation", () => {
  const row = { "Your Rating": "8", your_title: "Dune" };
  const index = buildHeaderIndex(row);
  assert.equal(pickField(row, index, ["your rating"]), "8");
  assert.equal(pickField(row, index, ["YOUR_RATING"]), "8");
  assert.equal(pickField(row, index, ["Your Title"]), "Dune");
  assert.equal(pickField(row, index, ["Missing"]), undefined);
});

test("column lookup falls through empty values to the next candidate", () => {
  const row = { Title: "", Name: "Dune" };
  const index = buildHeaderIndex(row);
  assert.equal(pickField(row, index, ["Title", "Name"]), "Dune");
});

test("booleans read export vocabulary, not mere truthiness", () => {
  assert.equal(parseBoolean("true"), true);
  assert.equal(parseBoolean("false"), false);
  assert.equal(parseBoolean("Yes"), true);
  assert.equal(parseBoolean("0"), false);
  assert.equal(parseBoolean(3), true);
  assert.equal(parseBoolean("", true), true); // falls back when unknown
  assert.equal(parseBoolean("garbage", false), false);
});

test("invalid dates become null rather than Invalid Date", () => {
  assert.equal(parseDate("nonsense"), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate("2024-01-02").getUTCFullYear(), 2024);
});

test("items key on an external id when they have one", () => {
  assert.equal(itemKey(makeItem({ title: "Dune", ids: { imdb: "tt1160419" } })), "imdb:tt1160419");
  assert.equal(itemKey(makeItem({ title: "Dune", ids: { tmdb: 438631 } })), "movie:tmdb:438631");
  assert.equal(itemKey(makeItem({ title: "Dune" })), "movie:dune");
});

test("merging is sticky for flags and keeps the earliest watch date", () => {
  const base = makeItem({ title: "Dune", watched: true, watchedAt: new Date("2024-05-01") });
  mergeItems(base, makeItem({ title: "Dune", favorite: true, rating: 9, watchedAt: new Date("2023-01-01") }));
  assert.equal(base.watched, true);
  assert.equal(base.favorite, true);
  assert.equal(base.rating, 9);
  assert.equal(base.watchedAt.getUTCFullYear(), 2023);
});

test("merging promotes movie to series but never demotes", () => {
  const base = makeItem({ title: "Fargo", type: "movie" });
  mergeItems(base, makeItem({ title: "Fargo", type: "series" }));
  assert.equal(base.type, "series");
  const series = makeItem({ title: "Fargo", type: "series" });
  mergeItems(series, makeItem({ title: "Fargo", type: "movie" }));
  assert.equal(series.type, "series");
});

test("dedupe collapses one film split across several export files", () => {
  // Exactly the Letterboxd shape: watched.csv, ratings.csv, likes/films.csv.
  const items = dedupe([
    makeItem({ title: "Dune", year: 2021, watched: true }),
    makeItem({ title: "Dune", year: 2021, rating: 9 }),
    makeItem({ title: "Dune", year: 2021, favorite: true }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].watched, true);
  assert.equal(items[0].favorite, true);
  assert.equal(items[0].rating, 9);
});

test("dedupe joins an id-bearing row to a yearless title-only row", () => {
  const items = dedupe([
    makeItem({ title: "Dune", year: 2021, ids: { imdb: "tt1160419" }, watched: true }),
    makeItem({ title: "Dune", favorite: true }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].favorite, true);
  assert.equal(items[0].ids.imdb, "tt1160419");
});

test("dedupe keeps genuine remakes apart", () => {
  const items = dedupe([
    makeItem({ title: "Dune", year: 1984, watched: true }),
    makeItem({ title: "Dune", year: 2021, watched: true, ids: { imdb: "tt1160419" } }),
  ]);
  assert.equal(items.length, 2);
});

test("dedupe drops rows that identify nothing", () => {
  assert.equal(dedupe([makeItem({ title: "" })]).length, 0);
});

test("a movie and a series of the same name stay separate", () => {
  const items = dedupe([
    makeItem({ title: "Fargo", year: 1996, type: "movie" }),
    makeItem({ title: "Fargo", year: 2014, type: "series" }),
  ]);
  assert.equal(items.length, 2);
});
