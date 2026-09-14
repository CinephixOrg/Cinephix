import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_LIST_ITEMS, normalizeListItems } from "./listItems.js";

const A = "6a0000000000000000000001";
const B = "6a0000000000000000000002";
const NOW = new Date("2026-09-14T10:00:00Z");

test("keeps the given order and drops repeats", () => {
  const { items } = normalizeListItems(
    [
      { itemId: B, itemType: "series" },
      { itemId: A, itemType: "movie" },
      { itemId: B, itemType: "series" },
    ],
    [],
    NOW
  );
  assert.deepEqual(
    items.map((item) => [item.itemId, item.itemType]),
    [
      [B, "series"],
      [A, "movie"],
    ]
  );
});

test("the same id as a movie and as a series are different titles", () => {
  const { items } = normalizeListItems([{ itemId: A, itemType: "movie" }, { itemId: A, itemType: "series" }], [], NOW);
  assert.equal(items.length, 2);
});

test("a title already on the list keeps the date it was added; new ones get now", () => {
  const firstAdded = new Date("2025-01-01T00:00:00Z");
  const { items } = normalizeListItems(
    [{ itemId: A, itemType: "movie" }, { itemId: B, itemType: "movie" }],
    [{ itemId: A.toUpperCase(), itemType: "movie", addedAt: firstAdded }],
    NOW
  );
  assert.equal(items[0].addedAt, firstAdded);
  assert.equal(items[1].addedAt, NOW);
});

test("rejects anything that isn't a valid item", () => {
  for (const bad of [undefined, "nope", {}, [{ itemId: "123", itemType: "movie" }], [{ itemId: A, itemType: "book" }], [null]]) {
    assert.ok(normalizeListItems(bad).error, JSON.stringify(bad));
  }
});

test("an empty list is fine", () => {
  assert.deepEqual(normalizeListItems([]), { items: [] });
});

test("caps how many titles a list can hold", () => {
  const many = Array.from({ length: MAX_LIST_ITEMS + 1 }, (_, i) => ({
    itemId: i.toString(16).padStart(24, "0"),
    itemType: "movie",
  }));
  assert.ok(normalizeListItems(many).error);
  assert.equal(normalizeListItems(many.slice(0, MAX_LIST_ITEMS)).items.length, MAX_LIST_ITEMS);
});
