import test from "node:test";
import assert from "node:assert/strict";
import { REPORT_ACTION_LABEL, REPORT_REASONS, authorId, reasonsFor, withoutBlocked } from "./safety.ts";

test("reasons fit what's being reported", () => {
  const user = reasonsFor("User").map((r) => r.value);
  assert.ok(user.includes("impersonation"));
  assert.ok(!user.includes("spoiler"), "a person isn't a spoiler");
  const review = reasonsFor("Review").map((r) => r.value);
  assert.ok(review.includes("spoiler"));
  assert.ok(!review.includes("impersonation"));
  assert.equal(review[review.length - 1], "other", "'Something else' is always last");
  assert.equal(new Set(REPORT_REASONS.map((r) => r.value)).size, REPORT_REASONS.length);
});

test("every reportable type has an action label", () => {
  for (const type of ["User", "List", "Review", "Comment", "Share", "Message"] as const) assert.ok(REPORT_ACTION_LABEL[type]);
});

test("authors come from raw ids or populated people", () => {
  assert.equal(authorId("u1"), "u1");
  assert.equal(authorId({ _id: "u2" }), "u2");
  assert.equal(authorId(null), null);
});

test("blocked people's items are removed; nothing removed keeps the array", () => {
  const items = [{ user: { _id: "a" } }, { user: { _id: "b" } }, { user: null }];
  const blocked = new Set(["b"]);
  assert.deepEqual(withoutBlocked(items, (i) => authorId(i.user), blocked), [items[0], items[2]]);
  assert.equal(withoutBlocked(items, (i) => authorId(i.user), new Set(["z"])), items);
  assert.equal(withoutBlocked(items, (i) => authorId(i.user), new Set()), items);
});

test("every reason and report label exists in every language", async () => {
  const { resources } = await import("../locales/index.ts");
  const keys = [...REPORT_REASONS.map((r) => r.label), ...Object.values(REPORT_ACTION_LABEL), "Block @{{username}}", "Block @{{username}}?", "Block user"];
  for (const [lang, table] of Object.entries(resources as Record<string, { translation: Record<string, string> }>)) {
    for (const key of keys) assert.ok(key in table.translation, `${lang} has no translation for "${key}"`);
  }
});
