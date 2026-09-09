// Run with: npm test --workspace backend   (node --test, no test deps)
//
// These cover the claims the Profile Analysis UI makes to the user in words
// — "37 of your 45 rated titles are tagged Drama", "31% of all 118 genre
// tags", "12% more than last month". Each of those is a number the user can
// check by hand, so each is worth pinning down.
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveDisplayName,
  tallyGenres,
  sumCounts,
  buildGenreBreakdown,
  buildRecentGenres,
  buildFavoriteGenres,
  buildRatingCurve,
  buildMonthBuckets,
  monthKeyOf,
  monthWindows,
  isWithin,
  averageRating
} from "./analysisMath.js";

const MOVIE_GENRES = { 28: "Action", 18: "Drama", 80: "Crime" };
const SERIES_GENRES = { 18: "Drama", 80: "Crime", 10765: "Sci-Fi & Fantasy" };

test("resolveDisplayName reads whichever field the document actually has", () => {
  // The movies collection is consistent; the series collection is not —
  // some importers wrote `name`, others `title`. Reading only one is what
  // left most series rendering as a poster with no title under it.
  assert.equal(resolveDisplayName({ title: "Dune" }, "movie"), "Dune");
  assert.equal(resolveDisplayName({ name: "Elite" }, "series"), "Elite");
  assert.equal(resolveDisplayName({ title: "Elite" }, "series"), "Elite");
  assert.equal(resolveDisplayName({ name: "Whiplash" }, "movie"), "Whiplash");
  // Prefers the type's canonical field when both are present.
  assert.equal(resolveDisplayName({ name: "Elite", title: "Élite" }, "series"), "Elite");
  assert.equal(resolveDisplayName(undefined, "movie"), undefined);
  assert.equal(resolveDisplayName({}, "series"), undefined);
});

test("tallyGenres counts one tag per genre per title, skipping unknown ids", () => {
  const docs = [{ genre_ids: [28, 18] }, { genre_ids: [18] }, { genre_ids: [999] }, { genre_ids: null }, {}];
  assert.deepEqual(tallyGenres(docs, MOVIE_GENRES), { Action: 1, Drama: 2 });
});

test("tallyGenres accumulates into an existing tally", () => {
  const counts = tallyGenres([{ genre_ids: [28] }], MOVIE_GENRES);
  tallyGenres([{ genre_ids: [18, 80] }], SERIES_GENRES, counts);
  assert.deepEqual(counts, { Action: 1, Drama: 1, Crime: 1 });
});

test("buildGenreBreakdown: percentages are of the TAG total, not the title count", () => {
  // 3 titles, 6 tags between them. Drama is on all 3 titles but that's 3 of
  // 6 tags = 50%, NOT 100%. This double denominator is exactly the thing
  // that looked like broken arithmetic on screen until the UI named both.
  const movies = tallyGenres([{ genre_ids: [18, 28] }, { genre_ids: [18, 80] }], MOVIE_GENRES);
  const series = tallyGenres([{ genre_ids: [18, 80] }], SERIES_GENRES);

  const { tagTotal, percentByName, genreBreakdown } = buildGenreBreakdown(movies, series);

  assert.equal(tagTotal, 6);
  assert.equal(percentByName.Drama, 50);
  assert.equal(genreBreakdown[0].genre, "Drama");
  assert.equal(genreBreakdown[0].count, 3);
  assert.equal(genreBreakdown[0].percentage, 50);
});

test("buildGenreBreakdown merges the two type tallies rather than picking one", () => {
  const { combined } = buildGenreBreakdown({ Drama: 2 }, { Drama: 3, Crime: 1 });
  assert.deepEqual(combined, { Drama: 5, Crime: 1 });
});

test("buildGenreBreakdown honours the limit, leaving a nameable remainder", () => {
  const counts = { A: 10, B: 9, C: 8, D: 7, E: 6, F: 5, G: 4, H: 3 };
  const { genreBreakdown, tagTotal } = buildGenreBreakdown(counts, {});

  assert.equal(genreBreakdown.length, 6);
  const listed = genreBreakdown.reduce((sum, g) => sum + g.count, 0);
  // The 7 left over are what the UI has to show as "Other" — if this ever
  // came out as 0 the "Other" row would silently vanish.
  assert.equal(tagTotal - listed, 7);
});

test("buildGenreBreakdown handles a user with no ratings at all", () => {
  const { tagTotal, genreBreakdown } = buildGenreBreakdown({}, {});
  assert.equal(tagTotal, 0);
  assert.deepEqual(genreBreakdown, []);
});

test("buildRecentGenres compares share-of-window against the previous window", () => {
  // Horror went from 1 of 4 tags (25%) to 3 of 4 (75%) — a +50 point swing,
  // which is what "50% more than last month" on the card means.
  const recent = { Horror: 3, Drama: 1 };
  const previous = { Horror: 1, Drama: 3 };

  const [top] = buildRecentGenres(recent, previous, { Horror: 20 });

  assert.equal(top.genre, "Horror");
  assert.equal(top.percentage, 75);
  assert.equal(top.deltaVsPreviousPeriod, 50);
  assert.equal(top.deltaVsAllTime, 55);
});

test("buildRecentGenres reports null (not zero) when there is no prior window", () => {
  // "Unchanged" and "nothing to compare with" have to be distinguishable —
  // the UI draws an arrow for one and nothing for the other.
  const [top] = buildRecentGenres({ Horror: 2 }, {}, {});
  assert.equal(top.deltaVsPreviousPeriod, null);
  assert.notEqual(top.deltaVsPreviousPeriod, 0);
});

test("buildRecentGenres treats a genre absent from the previous window as 0%", () => {
  const [top] = buildRecentGenres({ Horror: 2 }, { Drama: 4 }, {});
  assert.equal(top.percentage, 100);
  assert.equal(top.deltaVsPreviousPeriod, 100);
});

test("buildFavoriteGenres exposes counts and tag total for the Other row", () => {
  const { items, tagTotal } = buildFavoriteGenres({ A: 5, B: 3, C: 2, D: 1, E: 1, F: 1 }, 5);
  assert.equal(tagTotal, 13);
  assert.equal(items.length, 5);
  const listed = items.reduce((sum, g) => sum + g.count, 0);
  assert.equal(tagTotal - listed, 1);
  assert.equal(items[0].percentage, 38); // 5/13
});

test("buildFavoriteGenres on an empty favorites list divides by nothing", () => {
  const { items, tagTotal } = buildFavoriteGenres({});
  assert.equal(tagTotal, 0);
  assert.deepEqual(items, []);
});

test("buildRatingCurve buckets 1-10 and never drops a rating", () => {
  const ratings = [{ value: 10 }, { value: 8 }, { value: 8 }, { value: 1 }];
  const curve = buildRatingCurve(ratings);

  assert.equal(curve.length, 10);
  assert.equal(curve[9].value, 10);
  assert.equal(curve[9].count, 1);
  assert.equal(curve[7].count, 2);
  assert.equal(curve[0].count, 1);
  // The histogram total must equal totalRatings, or the chart contradicts
  // the stats card sitting two swipes away.
  assert.equal(
    curve.reduce((sum, c) => sum + c.count, 0),
    ratings.length
  );
});

test("buildRatingCurve clamps out-of-range values instead of discarding them", () => {
  const curve = buildRatingCurve([{ value: 0 }, { value: 11 }, { value: 7.4 }]);
  assert.equal(curve[0].count, 1); // 0 -> 1
  assert.equal(curve[9].count, 1); // 11 -> 10
  assert.equal(curve[6].count, 1); // 7.4 -> 7
  assert.equal(
    curve.reduce((sum, c) => sum + c.count, 0),
    3
  );
});

test("buildMonthBuckets returns six months ending with the current one", () => {
  const buckets = buildMonthBuckets(new Date(2026, 8, 9)); // September 2026
  assert.equal(buckets.length, 6);
  assert.equal(buckets[0].key, "2026-3"); // April (month index 3)
  assert.equal(buckets[5].key, "2026-8"); // September
  assert.equal(buckets[5].start.getDate(), 1);
});

test("buildMonthBuckets crosses a year boundary", () => {
  const buckets = buildMonthBuckets(new Date(2026, 1, 15)); // February 2026
  assert.equal(buckets[0].key, "2025-8"); // September 2025
  assert.equal(buckets[5].key, "2026-1");
});

test("monthKeyOf matches the bucket keys it is looked up against", () => {
  const buckets = buildMonthBuckets(new Date(2026, 8, 9));
  const key = monthKeyOf(new Date(2026, 7, 31, 23, 59));
  assert.ok(buckets.some((b) => b.key === key));
});

test("monthWindows: the query bound is exclusive, the label date is not", () => {
  // Regression: monthEnd was originally the last day at 00:00 and used as a
  // `$lt` bound, which silently dropped everything that happened on the
  // final day of the month.
  const { monthStart, monthEnd, periodEnd, prevMonthStart } = monthWindows(new Date(2026, 7, 9));

  assert.equal(monthStart.getMonth(), 7);
  assert.equal(monthStart.getDate(), 1);
  assert.equal(monthEnd.getMonth(), 8); // 1 September — exclusive bound
  assert.equal(monthEnd.getDate(), 1);
  assert.equal(periodEnd.getDate(), 31); // "1-31 August", the label
  assert.equal(prevMonthStart.getMonth(), 6);

  const lastInstantOfAugust = new Date(2026, 7, 31, 23, 30);
  assert.equal(isWithin(lastInstantOfAugust, monthStart, monthEnd), true);
});

test("isWithin is inclusive of the start and exclusive of the end", () => {
  const start = new Date(2026, 7, 1);
  const end = new Date(2026, 8, 1);
  assert.equal(isWithin(start, start, end), true);
  assert.equal(isWithin(end, start, end), false);
  assert.equal(isWithin(new Date(2026, 6, 31), start, end), false);
  assert.equal(isWithin(null, start, end), false);
  assert.equal(isWithin(undefined, start, end), false);
});

test("averageRating rounds to one decimal and treats an empty set as 0", () => {
  assert.equal(averageRating([{ value: 8 }, { value: 7 }]), 7.5);
  assert.equal(averageRating([{ value: 8 }, { value: 7 }, { value: 7 }]), 7.3);
  assert.equal(averageRating([]), 0);
});

test("sumCounts totals a tally", () => {
  assert.equal(sumCounts({ a: 1, b: 2, c: 3 }), 6);
  assert.equal(sumCounts({}), 0);
});
