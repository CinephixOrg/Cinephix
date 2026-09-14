import test from "node:test";
import assert from "node:assert/strict";
import { initialTracking, trackChange } from "./gridModel.ts";

type Item = { id: string };
const keyOf = (item: Item) => item.id;
const items = (...ids: string[]): Item[] => ids.map((id) => ({ id }));
const EXIT = 200;

test("a removal glides the rest and keeps the removed item as a ghost in its old slot", () => {
  const start = initialTracking(items("a", "b", "c"), keyOf);
  const next = trackChange(start, items("a", "c"), keyOf, EXIT, 1000);
  assert.equal(next.motion, "glide");
  assert.deepEqual(
    next.ghosts.map((ghost) => [ghost.key, ghost.index, ghost.expiresAt]),
    [["b", 1, 1200]]
  );
  assert.equal(next.reorders, 0);
});

test("an item put back by Undo appears, and stops being a ghost", () => {
  const start = initialTracking(items("a", "b", "c"), keyOf);
  const removed = trackChange(start, items("a", "c"), keyOf, EXIT, 1000);
  const restored = trackChange(removed, items("a", "b", "c"), keyOf, EXIT, 1100);
  assert.deepEqual([...restored.appearing], ["b"]);
  assert.deepEqual(restored.ghosts, []);
});

test("ghosts drop out once their exit has played", () => {
  const start = initialTracking(items("a", "b", "c"), keyOf);
  const removed = trackChange(start, items("a", "c"), keyOf, EXIT, 1000);
  const later = trackChange(removed, items("a"), keyOf, EXIT, 1300);
  assert.deepEqual(later.ghosts.map((ghost) => ghost.key), ["c"]);
});

test("a new order is a reorder: no glide, no ghosts, and the fade counter moves", () => {
  const start = initialTracking(items("a", "b", "c"), keyOf);
  const removed = trackChange(start, items("a", "c"), keyOf, EXIT, 1000);
  const searched = trackChange(removed, items("c", "a"), keyOf, EXIT, 1050);
  assert.equal(searched.motion, "snap");
  assert.deepEqual(searched.ghosts, []);
  assert.equal(searched.reorders, 1);
});

test("the same keys again keep the previous motion", () => {
  const start = initialTracking(items("a", "b"), keyOf);
  const glided = trackChange(start, items("a"), keyOf, EXIT, 1000);
  const same = trackChange(glided, items("a"), keyOf, EXIT, 1010);
  assert.equal(same.motion, "glide");
});
