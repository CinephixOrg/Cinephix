import test from "node:test";
import assert from "node:assert/strict";
import { createPrefetcher } from "./prefetch.ts";

function counter() {
  const calls: string[] = [];
  const load = (key: string) => {
    calls.push(key);
    return Promise.resolve(`${key}#${calls.length}`);
  };
  return { calls, load };
}

test("the screen takes the request the tap started instead of starting another", async () => {
  const { calls, load } = counter();
  const prefetcher = createPrefetcher(load);
  prefetcher.prefetch("a");
  assert.equal(await prefetcher.take("a"), "a#1");
  assert.deepEqual(calls, ["a"]);
});

test("a second tap before the screen takes it doesn't start a second request", async () => {
  const { calls, load } = counter();
  const prefetcher = createPrefetcher(load);
  prefetcher.prefetch("a");
  prefetcher.prefetch("a");
  await prefetcher.take("a");
  assert.deepEqual(calls, ["a"]);
});

test("taking empties the slot, so a refresh goes to the network", async () => {
  const { calls, load } = counter();
  const prefetcher = createPrefetcher(load);
  prefetcher.prefetch("a");
  await prefetcher.take("a");
  assert.equal(await prefetcher.take("a"), "a#2");
  assert.deepEqual(calls, ["a", "a"]);
});

test("without a prefetch, taking just loads", async () => {
  const { calls, load } = counter();
  assert.equal(await createPrefetcher(load).take("b"), "b#1");
  assert.deepEqual(calls, ["b"]);
});

test("a prefetch that sat too long isn't used", async () => {
  const { calls, load } = counter();
  let clock = 0;
  const prefetcher = createPrefetcher(load, { ttlMs: 1000, now: () => clock });
  prefetcher.prefetch("a");
  clock = 1000;
  assert.equal(await prefetcher.take("a"), "a#2");
  assert.deepEqual(calls, ["a", "a"]);
});

test("a failed prefetch is dropped quietly and the screen loads again", async () => {
  let attempt = 0;
  const prefetcher = createPrefetcher((key) => (++attempt === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(key)));
  prefetcher.prefetch("a");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await prefetcher.take("a"), "a");
  assert.equal(attempt, 2);
});

test("keys are independent", async () => {
  const { calls, load } = counter();
  const prefetcher = createPrefetcher(load);
  prefetcher.prefetch("a");
  prefetcher.prefetch("b");
  await prefetcher.take("b");
  await prefetcher.take("a");
  assert.deepEqual(calls, ["a", "b"]);
});
