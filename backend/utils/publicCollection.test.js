import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { buildCollectionEntries } from "./publicCollection.js";

const A = "68ed03ce505e6ffb3b237290";
const B = "68ed03d9505e6ffb3b23f144";
const S = "68ed07c7d4510a0b669c5f0f";
const oid = (id) => new mongoose.Types.ObjectId(id);

test("keeps stored order and turns ObjectIds into strings", () => {
  const entries = buildCollectionEntries([
    { itemId: oid(A), itemType: "movie" },
    { itemId: oid(S), itemType: "series" },
  ]);
  assert.deepEqual(entries, [
    { itemId: A, itemType: "movie" },
    { itemId: S, itemType: "series" },
  ]);
});

test("without ratings (the watchlist), entries carry no rating field at all", () => {
  const [entry] = buildCollectionEntries([{ itemId: oid(A), itemType: "movie" }], null);
  assert.equal("rating" in entry, false);
});

test("with ratings, each entry gets the owner's rating or null", () => {
  const entries = buildCollectionEntries(
    [
      { itemId: oid(A), itemType: "movie" },
      { itemId: oid(B), itemType: "movie" },
    ],
    [{ contentId: A, value: 8 }]
  );
  assert.deepEqual(entries.map((e) => e.rating), [8, null]);
});

test("ratings stored with an ObjectId contentId match, and the newer of two forms wins", () => {
  const entries = buildCollectionEntries(
    [{ itemId: oid(B), itemType: "movie" }],
    [
      { contentId: oid(B), value: 10 },
      { contentId: B, value: 6, updatedAt: new Date("2026-08-14") },
    ]
  );
  assert.equal(entries[0].rating, 6);
});

test("duplicates and malformed subdocuments are dropped", () => {
  const entries = buildCollectionEntries([
    { itemId: oid(A), itemType: "movie" },
    { itemId: oid(A), itemType: "movie" },
    { itemId: oid(A), itemType: "book" },
    { itemType: "movie" },
    null,
  ]);
  assert.deepEqual(entries, [{ itemId: A, itemType: "movie" }]);
});

test("a missing list is an empty list", () => {
  assert.deepEqual(buildCollectionEntries(undefined), []);
});
