import test from "node:test";
import assert from "node:assert/strict";
import { countryCodes, normalizeTitle, pickMatch, titleAndDate } from "./tmdbMatch.js";

test("titles compare without case, accents or punctuation", () => {
  assert.equal(normalizeTitle("Amélie"), normalizeTitle("amelie"));
  assert.equal(normalizeTitle("Spider-Man: No Way Home"), "spider man no way home");
  assert.equal(normalizeTitle("Fast & Furious"), normalizeTitle("Fast and Furious"));
  assert.equal(normalizeTitle("기생충"), "기생충");
});

test("a movie: the exact date first, else the one from that year", () => {
  const results = [
    { id: 1, title: "Oldboy", release_date: "2013-11-27" },
    { id: 2, title: "Oldboy", original_title: "올드보이", release_date: "2003-11-21" },
  ];
  assert.equal(pickMatch(results, { title: "Oldboy", date: "2003-11-21" }, "movie")?.id, 2);
  assert.equal(pickMatch(results, { title: "올드보이", date: "2003-01-01" }, "movie")?.id, 2, "by original title, same year");
  assert.equal(pickMatch(results, { title: "Oldboy", date: "2010-01-01" }, "movie"), null, "no result from that year");
  assert.equal(pickMatch(results, { title: "Old", date: "2003-11-21" }, "movie"), null, "a different title");
  assert.equal(pickMatch(results, { title: "Oldboy", date: undefined }, "movie"), null, "no year to check");
});

test("two same-titled results from one year are no match, unless one has the exact date", () => {
  const results = [
    { id: 1, title: "Home", release_date: "2015-03-01" },
    { id: 2, title: "Home", release_date: "2015-09-01" },
  ];
  assert.equal(pickMatch(results, { title: "Home", date: "2015-05-05" }, "movie"), null);
  assert.equal(pickMatch(results, { title: "Home", date: "2015-09-01" }, "movie")?.id, 2);
});

test("a series matches on its name and first air date", () => {
  const results = [{ id: 93405, name: "Squid Game", original_name: "오징어 게임", first_air_date: "2021-09-17" }];
  const doc = { name: "Squid Game", first_air_date: "2021-09-17" };
  assert.equal(pickMatch(results, titleAndDate(doc, "series"), "series")?.id, 93405);
  assert.equal(pickMatch(results, { title: "Squid Game", date: "2021-09-17" }, "movie"), null, "movie fields don't fit a show");
});

test("countries: a movie's production countries, a show's origin countries", () => {
  assert.deepEqual(countryCodes({ production_countries: [{ iso_3166_1: "KR" }, { iso_3166_1: "US" }, { iso_3166_1: "KR" }, {}] }, "movie"), ["KR", "US"]);
  assert.deepEqual(countryCodes({ origin_country: ["TR"] }, "series"), ["TR"]);
  assert.deepEqual(countryCodes(undefined, "movie"), []);
});
