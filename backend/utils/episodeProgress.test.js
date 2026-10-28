import test from "node:test";
import assert from "node:assert/strict";
import { episodesUpTo, isWatched, markAll, markEpisodes, progressSummary } from "./episodeProgress.js";

const NOW = new Date("2026-10-28T12:00:00Z");
const SEASONS = [
  { season_number: 0, episode_count: 3 },
  { season_number: 1, episode_count: 3 },
  { season_number: 2, episode_count: 4 },
];
const LAST_AIRED = { s: 2, e: 2 }; // S2E3–4 not aired yet

test("marking an episode stores it with the date, once", () => {
  let p = markEpisodes(null, [{ s: 1, e: 2 }], true, { now: NOW });
  p = markEpisodes(p, [{ s: 1, e: 2 }], true, { now: new Date("2026-11-01") });
  assert.deepEqual(p.eps, [{ s: 1, e: 2, at: NOW }]);
  assert.ok(isWatched(p, 1, 2));
  assert.ok(!isWatched(p, 1, 1));
});

test("marking a season adds only what isn't watched yet, keeping earlier dates", () => {
  const earlier = new Date("2026-01-01");
  const p = markEpisodes({ eps: [{ s: 1, e: 1, at: earlier }] }, [1, 2, 3].map((e) => ({ s: 1, e })), true, { now: NOW });
  assert.deepEqual(p.eps, [{ s: 1, e: 1, at: earlier }, { s: 1, e: 2, at: NOW }, { s: 1, e: 3, at: NOW }]);
});

test("unmarking a season removes its episodes and nothing else", () => {
  const p = markEpisodes({ eps: [{ s: 1, e: 1, at: NOW }, { s: 2, e: 1, at: NOW }] }, [1, 2, 3].map((e) => ({ s: 1, e })), false);
  assert.deepEqual(p.eps, [{ s: 2, e: 1, at: NOW }]);
});

test("'all watched' is one undated mark up to the last aired episode, specials aside", () => {
  const p = markAll(null, LAST_AIRED, true);
  assert.deepEqual(p, { eps: [], all: { s: 2, e: 2 } });
  assert.ok(isWatched(p, 1, 3));
  assert.ok(isWatched(p, 2, 2));
  assert.ok(!isWatched(p, 2, 3), "not aired when marked");
  assert.ok(!isWatched(p, 0, 1), "specials are not the series");
});

test("'all watched' keeps the dated history; taking it back clears everything", () => {
  const dated = { eps: [{ s: 1, e: 1, at: NOW }], all: null };
  assert.deepEqual(markAll(dated, LAST_AIRED, true).eps, dated.eps);
  assert.deepEqual(markAll({ ...dated, all: LAST_AIRED }, LAST_AIRED, false), { eps: [], all: null });
});

test("unmarking one episode under 'all' spells the rest out, undated", () => {
  const p = markEpisodes({ eps: [], all: LAST_AIRED }, [{ s: 1, e: 2 }], false, { seasons: SEASONS });
  assert.equal(p.all, null);
  assert.deepEqual(p.eps, [{ s: 1, e: 1 }, { s: 1, e: 3 }, { s: 2, e: 1 }, { s: 2, e: 2 }]);
  assert.ok(!isWatched(p, 1, 2));
});

test("episodesUpTo stops at the given episode and skips specials", () => {
  assert.deepEqual(episodesUpTo({ s: 2, e: 1 }, SEASONS), [{ s: 1, e: 1 }, { s: 1, e: 2 }, { s: 1, e: 3 }, { s: 2, e: 1 }]);
});

test("the summary counts aired regular episodes only", () => {
  const p = markEpisodes(null, [{ s: 1, e: 1 }, { s: 2, e: 2 }, { s: 0, e: 1 }], true, { now: NOW });
  assert.deepEqual(progressSummary(p, SEASONS, LAST_AIRED), {
    watched: 2,
    aired: 5,
    perSeason: { 1: { watched: 1, aired: 3 }, 2: { watched: 1, aired: 2 } },
  });
  assert.equal(progressSummary(null, SEASONS, null).aired, 0);
});
