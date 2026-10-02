import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_CATEGORIES,
  DEFAULT_ACTIVITY_FILTERS,
  activityQueryKey,
  activityRows,
  appendActivity,
  hiddenCategoryCount,
  markVars,
  mergeFreshActivity,
  sentenceFor,
  shownCategories,
  splitEmphasis,
  starString,
  toggleCategory,
} from "./personalActivity.ts";
import type { PersonalActivityItem } from "../types/index.ts";

const item = (key: string, iso: string, extra: Partial<PersonalActivityItem> = {}): PersonalActivityItem =>
  ({ key, type: "rated", createdAt: iso, ...extra }) as PersonalActivityItem;

test("from everything, one tap hides just that type", () => {
  const f = toggleCategory(DEFAULT_ACTIVITY_FILTERS, "ratings");
  assert.deepEqual(shownCategories(f), ACTIVITY_CATEGORIES.filter((c) => c !== "ratings"));
  assert.equal(hiddenCategoryCount(f), 1);
  assert.deepEqual(toggleCategory(f, "ratings").categories, [], "ticking it back is everything again");
  assert.equal(hiddenCategoryCount(DEFAULT_ACTIVITY_FILTERS), 0);
});

test("ticks stay in menu order, and the last type can't be unticked", () => {
  let f = DEFAULT_ACTIVITY_FILTERS;
  for (const c of ACTIVITY_CATEGORIES) if (c !== "follows" && c !== "ratings") f = toggleCategory(f, c);
  assert.deepEqual(f.categories, ["ratings", "follows"]);
  f = toggleCategory(f, "ratings");
  assert.deepEqual(f.categories, ["follows"]);
  assert.equal(toggleCategory(f, "follows"), f, "unticking the last one is refused");
});

test("equal filters share a cache key", () => {
  const a = activityQueryKey({ range: "all", categories: ["follows", "ratings"] });
  const b = activityQueryKey({ range: "all", categories: ["ratings", "follows"] });
  assert.equal(a, b);
  assert.notEqual(a, activityQueryKey({ range: "week", categories: ["ratings", "follows"] }));
  assert.equal(activityQueryKey(DEFAULT_ACTIVITY_FILTERS), "week|");
});

test("sentences speak in the second person and fall back when a name is missing", () => {
  const content = { id: "m", title: "Inception", type: "movie" as const };
  assert.deepEqual(sentenceFor(item("1", "2026-09-18", { content }), "Media"), {
    key: "You rated {{title}}",
    vars: { title: "Inception" },
  });
  const liked = sentenceFor(item("2", "2026-09-18", { type: "review_liked", content, targetUser: { _id: "u", username: "ana" } }), "Media");
  assert.equal(liked.key, "You liked {{username}}'s review of {{title}}");
  assert.equal(sentenceFor(item("3", "2026-09-18", { type: "review_liked", content }), "Media").key, "You liked a review of {{title}}");
  assert.deepEqual(sentenceFor(item("4", "2026-09-18", { type: "list_created", listName: "My Favorites" }), "Media"), {
    key: "You created a new list {{name}}",
    vars: { name: "My Favorites" },
  });
  const share = sentenceFor(item("5", "2026-09-18", { type: "shared", shareType: "recommendation", shareTitle: "Dark" }), "Media");
  assert.deepEqual(share, { key: "You recommended {{title}} on {{media}}", vars: { title: "Dark", media: "Media" } });
  assert.equal(sentenceFor(item("6", "2026-09-18", { type: "shared", shareType: "poll" }), "Media").key, "You posted a poll on {{media}}");
  assert.equal(sentenceFor(item("7", "2026-09-18", { type: "profile_analyzed" }), "Media").key, "You ran a CineGraph analysis");
});

test("interpolated values come back as emphasised runs, in any word order", () => {
  const vars = markVars({ title: "Inception", username: "ana" });
  // A language that puts the name after the title.
  const resolved = `${vars.title} filmi için ${vars.username} yorumunu beğendin`;
  assert.deepEqual(splitEmphasis(resolved), [
    { text: "Inception", strong: true },
    { text: " filmi için ", strong: false },
    { text: "ana", strong: true },
    { text: " yorumunu beğendin", strong: false },
  ]);
  assert.deepEqual(splitEmphasis("plain"), [{ text: "plain", strong: false }]);
});

test("ratings read as stars with a half", () => {
  assert.equal(starString(10), "★★★★★");
  assert.equal(starString(9), "★★★★½");
  assert.equal(starString(1), "½");
  assert.equal(starString(undefined), "");
});

test("rows: a header for each day, items under it", () => {
  const rows = activityRows([
    item("a", new Date(2026, 8, 18, 20).toISOString()),
    item("b", new Date(2026, 8, 18, 9).toISOString()),
    item("c", new Date(2026, 8, 16, 12).toISOString()),
  ]);
  assert.deepEqual(
    rows.map((r) => (r.kind === "day" ? "|" : r.key)),
    ["|", "a", "b", "|", "c"]
  );
});

test("older pages append without duplicates", () => {
  const merged = appendActivity([item("a", "2026-09-18"), item("b", "2026-09-17")], [item("b", "2026-09-17"), item("c", "2026-09-10")]);
  assert.deepEqual(merged.map((i) => i.key), ["a", "b", "c"]);
});

test("a refresh keeps what's been scrolled through, and the same array when nothing changed", () => {
  const cached = [item("a", "2026-09-18T10:00Z"), item("b", "2026-09-17T10:00Z"), item("c", "2026-09-10T10:00Z")];
  assert.equal(mergeFreshActivity(cached, [cached[0], cached[1]], true), cached, "unchanged keeps identity");
  const fresh = [item("z", "2026-09-18T12:00Z"), item("a", "2026-09-18T10:00Z")];
  assert.deepEqual(mergeFreshActivity(cached, fresh, true).map((i) => i.key), ["z", "a", "b", "c"]);
  assert.deepEqual(mergeFreshActivity(cached, fresh, false).map((i) => i.key), ["z", "a"], "a complete page replaces");
  const rerated = [item("a", "2026-09-18T10:00Z", { value: 4 }), cached[1]];
  assert.notEqual(mergeFreshActivity(cached, rerated, true), cached, "a changed value is noticed");
});

test("pages that arrive out of order still give one header per day and unique keys", () => {
  const rows = activityRows([
    item("a", new Date(2026, 8, 18, 9).toISOString()),
    item("b", new Date(2026, 8, 12, 9).toISOString()),
    // A later page carrying an item from a day already shown above, and a repeat.
    item("c", new Date(2026, 8, 18, 7).toISOString()),
    item("b", new Date(2026, 8, 12, 9).toISOString()),
  ]);
  const keys = rows.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length, "every key unique");
  assert.deepEqual(
    rows.map((r) => (r.kind === "day" ? "|" : r.key)),
    ["|", "a", "c", "|", "b"]
  );
});

test("every label and sentence the Activity page shows exists in every language", async () => {
  const { resources } = await import("../locales/index.ts");
  const { CATEGORY_LABEL, RANGE_LABEL } = await import("./personalActivity.ts");
  const content = { id: "m", title: "T", type: "movie" as const };
  const person = { _id: "u", username: "ana" };
  const samples: Partial<PersonalActivityItem>[] = [
    { type: "rated", content },
    { type: "reviewed", content },
    { type: "review_liked", content },
    { type: "review_liked", content, targetUser: person },
    { type: "list_liked", listName: "L" },
    { type: "list_liked", listName: "L", targetUser: person },
    { type: "followed", targetUser: person },
    { type: "list_created", listName: "L" },
    { type: "watchlist_added", content },
    { type: "towatch_added", content },
    { type: "favorited", content },
    { type: "group_joined", groupName: "G" },
    { type: "match_analyzed" },
    { type: "match_analyzed", targetUser: person },
    { type: "profile_analyzed" },
    { type: "profile_analyzed", nickname: "N" },
    ...["review", "recommendation", "list", "analysis", "poll", "badge", "unknown"].flatMap((shareType) => [
      { type: "shared" as const, shareType: shareType as PersonalActivityItem["shareType"] },
      { type: "shared" as const, shareType: shareType as PersonalActivityItem["shareType"], shareTitle: "X" },
    ]),
  ];
  const keys = new Set<string>([
    ...Object.values(RANGE_LABEL),
    ...Object.values(CATEGORY_LABEL),
    ...samples.map((sample) => sentenceFor(item("k", "2026-09-18", sample), "Media").key),
    "Media",
    "{{percent}}% match",
  ]);
  const tables = resources as Record<string, { translation: Record<string, string> }>;
  for (const [lang, { translation }] of Object.entries(tables)) {
    for (const key of keys) assert.ok(key in translation, `${lang} has no translation for "${key}"`);
  }
});
