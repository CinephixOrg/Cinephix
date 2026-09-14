import test from "node:test";
import assert from "node:assert/strict";
import {
  addToDraft,
  draftKey,
  interleave,
  isDraftChanged,
  removeFromDraft,
  seedsKey,
  suggestionSeeds,
  titleIdentity,
  yearOf,
  type DraftFields,
  type DraftItem,
} from "./listDraft.ts";

test("two records of one title share an identity; another kind or year doesn't", () => {
  const legacy: DraftItem = { id: "68ed07a4d4510a0b669ac941", type: "series", title: "Breaking Bad", posterPath: null, year: "2008" };
  const tmdbTwin: DraftItem = { id: "6a665a82422d412dc658d60a", type: "series", title: " breaking  bad ", posterPath: "/x.jpg", year: "2008" };
  assert.notEqual(draftKey(legacy), draftKey(tmdbTwin));
  assert.equal(titleIdentity(legacy), titleIdentity(tmdbTwin));
  assert.notEqual(titleIdentity(legacy), titleIdentity({ ...tmdbTwin, type: "movie" }));
  assert.notEqual(titleIdentity(legacy), titleIdentity({ ...tmdbTwin, year: "2019" }));
});

const item = (id: string, type: "movie" | "series" = "movie"): DraftItem => ({ id, type, title: id, posterPath: null, year: null });
const fields = (items: DraftItem[], overrides: Partial<DraftFields> = {}): DraftFields => ({
  name: "Weekend",
  description: "",
  isPublic: false,
  items,
  ...overrides,
});

test("adding appends, and adding the same title again changes nothing", () => {
  const one = addToDraft([], item("a"));
  const two = addToDraft(one, item("b"));
  assert.deepEqual(two.map(draftKey), ["movie:a", "movie:b"]);
  assert.equal(addToDraft(two, item("a")), two);
  // Same id as a series is a different title.
  assert.equal(addToDraft(two, item("a", "series")).length, 3);
});

test("removing drops the title, and removing a missing one changes nothing", () => {
  const items = [item("a"), item("b")];
  assert.deepEqual(removeFromDraft(items, "movie:a").map(draftKey), ["movie:b"]);
  assert.equal(removeFromDraft(items, "movie:zzz"), items);
});

test("suggestions draw from the last three added, newest first, once there are three", () => {
  assert.deepEqual(suggestionSeeds([item("a"), item("b")]), []);
  const seeds = suggestionSeeds([item("a"), item("b"), item("c"), item("d")]);
  assert.deepEqual(seeds.map((seed) => seed.id), ["d", "c", "b"]);
  assert.equal(seedsKey(seeds), "movie:d|movie:c|movie:b");
});

test("removing an older title leaves the seeds, and so the suggestions, alone", () => {
  const before = seedsKey(suggestionSeeds([item("a"), item("b"), item("c"), item("d")]));
  const after = seedsKey(suggestionSeeds([item("b"), item("c"), item("d")]));
  assert.equal(before, after);
});

test("interleaves two result lists up to a limit", () => {
  assert.deepEqual(interleave(["m1", "m2", "m3"], ["s1"], 10), ["m1", "s1", "m2", "m3"]);
  assert.deepEqual(interleave(["m1", "m2"], ["s1", "s2"], 3), ["m1", "s1", "m2"]);
  assert.deepEqual(interleave([], [], 5), []);
});

test("a draft is changed by its name, description, visibility or titles, but not by stray spaces", () => {
  const base = fields([item("a"), item("b")]);
  assert.equal(isDraftChanged(base, fields([item("a"), item("b")], { name: " Weekend " })), false);
  assert.equal(isDraftChanged(base, fields([item("a"), item("b")], { name: "Weekday" })), true);
  assert.equal(isDraftChanged(base, fields([item("a"), item("b")], { description: "Cozy" })), true);
  assert.equal(isDraftChanged(base, fields([item("a"), item("b")], { isPublic: true })), true);
  assert.equal(isDraftChanged(base, fields([item("b"), item("a")])), true);
  assert.equal(isDraftChanged(base, fields([item("a")])), true);
});

test("reads a release year from a catalogue date", () => {
  assert.equal(yearOf("1999-03-31"), "1999");
  assert.equal(yearOf(""), null);
  assert.equal(yearOf(null), null);
  assert.equal(yearOf("unknown"), null);
});
