import test from "node:test";
import assert from "node:assert/strict";
import { createTtlCache } from "./ttlCache.js";

// A controllable clock, so expiry is tested by asserting on behaviour rather
// than by sleeping.
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test("returns a stored value before it expires", () => {
  const clock = fakeClock();
  const cache = createTtlCache({ ttlMs: 1000, now: clock.now });

  cache.set("a", { score: 72 });
  clock.advance(999);

  assert.deepEqual(cache.get("a"), { score: 72 });
});

test("stops returning a value once the TTL has passed", () => {
  const clock = fakeClock();
  const cache = createTtlCache({ ttlMs: 1000, now: clock.now });

  cache.set("a", { score: 72 });
  clock.advance(1001);

  assert.equal(cache.get("a"), undefined);
});

test("an expired entry is dropped, not just hidden", () => {
  const clock = fakeClock();
  const cache = createTtlCache({ ttlMs: 1000, now: clock.now });

  cache.set("a", 1);
  clock.advance(1001);
  cache.get("a");

  assert.equal(cache.size, 0);
});

test("a re-set resets the entry's clock", () => {
  const clock = fakeClock();
  const cache = createTtlCache({ ttlMs: 1000, now: clock.now });

  cache.set("a", 1);
  clock.advance(900);
  cache.set("a", 2);
  clock.advance(900);

  // Would be long gone on the original timestamp.
  assert.equal(cache.get("a"), 2);
});

test("misses are undefined, and undefined is what a caller checks for", () => {
  const cache = createTtlCache({ ttlMs: 1000 });
  assert.equal(cache.get("nope"), undefined);
});

test("never grows past its limit", () => {
  const clock = fakeClock();
  const cache = createTtlCache({ ttlMs: 10_000, limit: 3, now: clock.now });

  // All live, so nothing can be swept — the bound has to hold anyway.
  for (let i = 0; i < 10; i++) cache.set(`k${i}`, i);

  assert.ok(cache.size <= 3, `expected <= 3, got ${cache.size}`);
  // The most recent write always survives.
  assert.equal(cache.get("k9"), 9);
});

test("sweeps expired entries instead of evicting live ones", () => {
  const clock = fakeClock();
  const cache = createTtlCache({ ttlMs: 1000, limit: 3, now: clock.now });

  cache.set("old1", 1);
  cache.set("old2", 2);
  clock.advance(1001);
  cache.set("fresh1", 3);
  cache.set("fresh2", 4);

  assert.equal(cache.get("old1"), undefined);
  assert.equal(cache.get("fresh1"), 3);
  assert.equal(cache.get("fresh2"), 4);
});

test("delete and clear remove entries", () => {
  const cache = createTtlCache({ ttlMs: 1000 });

  cache.set("a", 1);
  cache.delete("a");
  assert.equal(cache.get("a"), undefined);

  cache.set("b", 2);
  cache.set("c", 3);
  cache.clear();
  assert.equal(cache.size, 0);
});
