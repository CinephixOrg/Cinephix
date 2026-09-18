import test from "node:test";
import assert from "node:assert/strict";
import { listShareData } from "./listShareData.js";

test("a full list share keeps its snapshot, bounded", () => {
  const data = listShareData({
    listId: "l1",
    name: "  Heist night  ",
    itemCount: 24.7,
    previewPosters: ["/a.jpg", "", null, "/b.jpg", "/c.jpg", "/d.jpg"],
    description: "x".repeat(500),
    ownerUsername: "ana",
  });
  assert.equal(data.name, "Heist night");
  assert.equal(data.itemCount, 24);
  assert.deepEqual(data.previewPosters, ["/a.jpg", "/b.jpg", "/c.jpg"]);
  assert.equal(data.description.length, 200);
  assert.equal(data.ownerUsername, "ana");
});

test("an older app's share without the new fields still stores cleanly", () => {
  const data = listShareData({ listId: "l2", name: "Classics", itemCount: 3, previewPosters: [] });
  assert.equal(data.description, undefined);
  assert.equal(data.ownerUsername, undefined);
  assert.deepEqual(listShareData({ listId: "l3", name: "X" }).previewPosters, []);
  assert.equal(listShareData({ listId: "l3", name: "X", itemCount: -4 }).itemCount, 0);
  assert.equal(listShareData({ listId: "l3", name: "X", description: "   " }).description, undefined);
});
