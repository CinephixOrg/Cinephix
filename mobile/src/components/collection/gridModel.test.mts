import test from "node:test";
import assert from "node:assert/strict";
import { classifyChange, computeMetrics, contentHeight, nextBand, rowHeightOf, tilePosition } from "./gridModel.ts";

const metrics = computeMetrics(400, { columns: 5, gap: 6, paddingX: 16, paddingTop: 4, posterRatio: 1.5 });

test("five tiles and four gaps fit inside the padded width", () => {
  assert.equal(metrics.tileWidth, 68); // floor((400 - 32 - 24) / 5)
  assert.equal(metrics.tileHeight, 102);
  assert.ok(metrics.paddingX * 2 + metrics.tileWidth * 5 + metrics.gap * 4 <= 400);
});

test("positions run left to right, then wrap to the next row", () => {
  assert.deepEqual(tilePosition(0, metrics), { x: 16, y: 4 });
  assert.deepEqual(tilePosition(4, metrics), { x: 16 + 4 * 74, y: 4 });
  assert.deepEqual(tilePosition(5, metrics), { x: 16, y: 4 + rowHeightOf(metrics) });
});

test("content height has no trailing gap and includes the bottom padding", () => {
  assert.equal(contentHeight(0, metrics, 110), 4 + 110);
  assert.equal(contentHeight(5, metrics, 0), 4 + 102);
  assert.equal(contentHeight(6, metrics, 0), 4 + 102 * 2 + 6);
});

test("the first list is initial and an identical one is the same", () => {
  assert.equal(classifyChange(null, ["a"]).kind, "initial");
  assert.equal(classifyChange(["a", "b"], ["a", "b"]).kind, "same");
});

test("removing titles keeps everything else in order: a removal, with the removed indices", () => {
  assert.deepEqual(classifyChange(["a", "b", "c", "d"], ["a", "c", "d"]), { kind: "removal", removed: [1], added: [] });
  assert.deepEqual(classifyChange(["a", "b", "c", "d"], ["a", "d"]), { kind: "removal", removed: [1, 2], added: [] });
  assert.deepEqual(classifyChange(["a", "b"], []), { kind: "removal", removed: [0, 1], added: [] });
});

test("undoing a removal is an insertion at the original index", () => {
  assert.deepEqual(classifyChange(["a", "c", "d"], ["a", "b", "c", "d"]), { kind: "insertion", removed: [], added: [1] });
  assert.deepEqual(classifyChange([], ["a"]), { kind: "insertion", removed: [], added: [0] });
});

test("anything that changes the relative order is a reorder", () => {
  assert.equal(classifyChange(["a", "b", "c"], ["c", "b", "a"]).kind, "reorder");
  assert.equal(classifyChange(["a", "b", "c"], ["b", "a"]).kind, "reorder"); // removed one and swapped two
  assert.equal(classifyChange(["a", "b"], ["b", "a", "c"]).kind, "reorder");
  assert.equal(classifyChange(["a", "b"], ["a", "c"]).kind, "reorder"); // same length, different title
});

test("the band covers the viewport plus overscan on both sides", () => {
  const rowHeight = rowHeightOf(metrics); // 108
  const band = nextBand(null, 10 * rowHeight + 4, 7 * rowHeight, metrics, 4);
  assert.deepEqual(band, { first: 6, last: 21 });
});

test("the band never starts above the first row", () => {
  assert.deepEqual(nextBand(null, 0, 700, metrics, 6), { first: 0, last: 12 });
});

test("small scrolls keep the same band object; nearing an edge moves it", () => {
  const rowHeight = rowHeightOf(metrics);
  const band = nextBand(null, 10 * rowHeight + 4, 7 * rowHeight, metrics, 4);
  assert.equal(nextBand(band, 11 * rowHeight + 4, 7 * rowHeight, metrics, 4), band);
  const moved = nextBand(band, 14 * rowHeight + 4, 7 * rowHeight, metrics, 4);
  assert.notEqual(moved, band);
  assert.deepEqual(moved, { first: 10, last: 25 });
});
