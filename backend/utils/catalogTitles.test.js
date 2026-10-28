import test from "node:test";
import assert from "node:assert/strict";
import { selectOriginalTitles, titleFields } from "./catalogTitles.js";

test("titleFields carries the original name only together with its language", () => {
  assert.deepEqual(titleFields({ name: "Back Streets", original_name: "Arka Sokaklar", original_language: "tr" }), {
    title: "Back Streets",
    original_title: "Arka Sokaklar",
    original_language: "tr",
  });
  assert.deepEqual(titleFields({ title: "Breaking Bad", original_title: "Breaking Bad" }), { title: "Breaking Bad" });
  assert.deepEqual(titleFields({ title: "Old legacy film", original_language: "tr" }), { title: "Old legacy film" });
});

// The plugin's hook, run against a stand-in for a Mongoose query.
function runHook(projection) {
  let hook;
  selectOriginalTitles({ pre: (_ops, fn) => (hook = fn) });
  const query = {
    current: projection,
    projection() {
      return this.current;
    },
    select(extra) {
      this.current = { ...this.current, ...extra };
    },
  };
  hook.call(query);
  return query.current;
}

test("a projection that picks the title also picks the original name and language", () => {
  assert.deepEqual(runHook({ title: 1, poster_path: 1 }), {
    title: 1,
    poster_path: 1,
    original_title: 1,
    original_name: 1,
    original_language: 1,
  });
  assert.ok(runHook({ _id: 1, name: 1 }).original_name);
});

test("projections without a title, exclusive ones and none at all are left as they are", () => {
  assert.deepEqual(runHook({ genre_ids: 1 }), { genre_ids: 1 });
  assert.deepEqual(runHook({ overview: 0, title: 0 }), { overview: 0, title: 0 });
  assert.equal(runHook(undefined), undefined);
});
