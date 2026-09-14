import test from "node:test";
import assert from "node:assert/strict";
import { buildNamedIndex, searchNamed } from "./collectionQuery.ts";

type List = { id: string; name: string };

const LISTS: List[] = [
  { id: "weekend", name: "Weekend Horror" },
  { id: "ghibli", name: "Best of Ghibli" },
  { id: "classics", name: "Horror Classics" },
  { id: "amelie", name: "Amélie & friends" },
  { id: "winter", name: "Kış filmleri" },
];

const search = (query: string, lists: List[] = LISTS) =>
  searchNamed(buildNamedIndex(lists, (list) => list.name), query).map((list) => list.id);

test("an empty search is every list, in the lists' own order", () => {
  assert.deepEqual(search(""), ["weekend", "ghibli", "classics", "amelie", "winter"]);
  assert.deepEqual(search("   "), ["weekend", "ghibli", "classics", "amelie", "winter"]);
});

test("a name starting with the search ranks above one that only contains it", () => {
  assert.deepEqual(search("horror"), ["classics", "weekend"]);
});

test("the exact name ranks first", () => {
  const lists = [
    { id: "long", name: "Horror Classics" },
    { id: "exact", name: "Horror" },
  ];
  assert.deepEqual(search("horror", lists), ["exact", "long"]);
});

test("case, accents and the Turkish dotless i don't matter", () => {
  assert.deepEqual(search("AMELIE"), ["amelie"]);
  assert.deepEqual(search("kis"), ["winter"]);
});

test("one typo still finds the list", () => {
  assert.deepEqual(search("ghilbi"), ["ghibli"]);
});

test("equally good matches keep the lists' own order", () => {
  const lists = [
    { id: "second", name: "Road Trip Two" },
    { id: "first", name: "Road Trip One" },
  ];
  assert.deepEqual(search("road trip", lists), ["second", "first"]);
});

test("nothing matching is an empty result", () => {
  assert.deepEqual(search("zzzz"), []);
});
