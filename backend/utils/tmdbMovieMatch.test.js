import test from "node:test";
import assert from "node:assert/strict";
import { countryCodes, normalizeTitle, pickMatch } from "./tmdbMovieMatch.js";

test("titles compare without case, accents or punctuation", () => {
  assert.equal(normalizeTitle("Amélie"), normalizeTitle("amelie"));
  assert.equal(normalizeTitle("Spider-Man: No Way Home"), "spider man no way home");
  assert.equal(normalizeTitle("Fast & Furious"), normalizeTitle("Fast and Furious"));
  assert.equal(normalizeTitle("기생충"), "기생충");
});

test("a match needs the same title and the same release year", () => {
  const results = [
    { id: 1, title: "Oldboy", release_date: "2013-11-27" },
    { id: 2, title: "Oldboy", original_title: "올드보이", release_date: "2003-11-21" },
  ];
  assert.equal(pickMatch(results, { title: "Oldboy", releaseDate: "2003-11-21" })?.id, 2);
  assert.equal(pickMatch(results, { title: "올드보이", releaseDate: "2003-01-01" })?.id, 2, "by original title");
  assert.equal(pickMatch(results, { title: "Oldboy", releaseDate: "2010-01-01" }), null, "no result from that year");
  assert.equal(pickMatch(results, { title: "Old", releaseDate: "2003-11-21" }), null, "a different title");
  assert.equal(pickMatch(results, { title: "Oldboy", releaseDate: undefined }), null, "no year to check");
});

test("production countries become ISO codes, deduplicated, in order", () => {
  assert.deepEqual(
    countryCodes([{ iso_3166_1: "KR", name: "South Korea" }, { iso_3166_1: "US" }, { iso_3166_1: "KR" }, { name: "?" }]),
    ["KR", "US"]
  );
  assert.deepEqual(countryCodes(undefined), []);
});
