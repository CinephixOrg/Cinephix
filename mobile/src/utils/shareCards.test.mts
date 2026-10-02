import test from "node:test";
import assert from "node:assert/strict";
import { snippet, cineGraphSlices, matchTone, topGenresFrom } from "./shareCards.ts";
import type { CineGraphData } from "../types/index.ts";

test("top genres combine movies and series, highest first", () => {
  const graph = {
    movieStats: { Drama: 10, Crime: 4, Comedy: 0 },
    seriesStats: { Crime: 8, "Sci-Fi": 5 },
    movieGenreRatings: {},
    seriesGenreRatings: {},
  } as CineGraphData;
  assert.deepEqual(topGenresFrom(graph), ["Crime", "Drama", "Sci-Fi"]);
  assert.deepEqual(topGenresFrom(graph, 1), ["Crime"]);
  assert.deepEqual(topGenresFrom(null), []);
});

test("snippets are tidied and cut at a word", () => {
  assert.equal(snippet("  Film   nerd.\nCoffee. "), "Film nerd. Coffee.");
  assert.equal(snippet(""), undefined);
  assert.equal(snippet(null), undefined);
  const long = "I watch everything from silent classics to modern horror and I rate honestly, always";
  const cut = snippet(long, 40)!;
  assert.ok(cut.endsWith("…"));
  assert.ok(cut.length <= 41);
  assert.ok(!cut.includes("  "));
});

test("match tone thresholds", () => {
  assert.equal(matchTone(92), "high");
  assert.equal(matchTone(70), "high");
  assert.equal(matchTone(69), "medium");
  assert.equal(matchTone(45), "medium");
  assert.equal(matchTone(12), "low");
});

test("CineGraph slices: top three by share plus the rest", () => {
  const { top, other } = cineGraphSlices([
    { genre: "Drama", percentage: 31.4 },
    { genre: "Crime", percentage: 22.6 },
    { genre: "Comedy", percentage: 9 },
    { genre: "Horror", percentage: 18 },
  ]);
  assert.deepEqual(top, [
    { genre: "Drama", percentage: 31 },
    { genre: "Crime", percentage: 23 },
    { genre: "Horror", percentage: 18 },
  ]);
  assert.equal(other, 28);
  assert.deepEqual(cineGraphSlices(undefined), { top: [], other: 0 });
  assert.equal(cineGraphSlices([{ genre: "A", percentage: 70 }, { genre: "B", percentage: 40 }]).other, 0, "never negative");
});
