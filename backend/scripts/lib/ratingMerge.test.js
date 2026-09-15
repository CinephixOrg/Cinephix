import { test } from "node:test";
import assert from "node:assert/strict";
import { planRatingMerge } from "./ratingMerge.js";

const ids = (docs) => docs.map((doc) => doc._id).sort();

test("a rating only on the merged-away document is moved", () => {
  const from = [{ _id: "6a66643102f3ec1baf890731", user: "u1", contentId: "rich" }];
  assert.deepEqual(planRatingMerge(from, []), { remove: [], move: from });
});

test("the real 28 Days Later case: one user, two forms on the merged-away document", () => {
  // Seeded in July without timestamps (ObjectId contentId), then rated again in
  // the app in August (string contentId). The August rating is the one kept.
  const seeded = { _id: "6a66643102f3ec1baf890731", user: "691f53a845194a18bc31db24", contentId: { oid: "6a665a9f422d412dc658d654" }, value: 10 };
  const inApp = {
    _id: "6a7f855f9484891206f30637",
    user: "691f53a845194a18bc31db24",
    contentId: "6a665a9f422d412dc658d654",
    value: 6,
    createdAt: new Date("2026-08-14T21:15:11.276Z"),
    updatedAt: new Date("2026-08-14T21:15:11.276Z"),
  };
  const plan = planRatingMerge([seeded, inApp], []);
  assert.deepEqual(ids(plan.remove), [seeded._id]);
  assert.deepEqual(ids(plan.move), [inApp._id]);
});

test("the same user after a partial move: newest already on the kept document", () => {
  const kept = { _id: "6a7f855f9484891206f30637", user: "u1", updatedAt: new Date("2026-08-14") };
  const leftover = { _id: "6a66643102f3ec1baf890731", user: "u1" };
  assert.deepEqual(planRatingMerge([leftover], [kept]), { remove: [leftover], move: [] });
});

test("a newer rating on the merged-away document replaces an older one on the kept document", () => {
  const older = { _id: "a1", user: "u1", updatedAt: new Date("2026-01-01") };
  const newer = { _id: "a2", user: "u1", updatedAt: new Date("2026-06-01") };
  assert.deepEqual(planRatingMerge([newer], [older]), { remove: [older], move: [newer] });
});

test("every user ends with exactly one rating", () => {
  const from = [
    { _id: "f1", user: "u1", updatedAt: new Date("2026-03-01") },
    { _id: "f2", user: "u1", updatedAt: new Date("2026-02-01") },
    { _id: "f3", user: "u2", updatedAt: new Date("2026-02-01") },
    { _id: "f4", user: "u3", updatedAt: new Date("2026-02-01") },
  ];
  const to = [
    { _id: "t1", user: "u1", updatedAt: new Date("2026-04-01") },
    { _id: "t2", user: "u1", updatedAt: new Date("2026-01-01") },
    { _id: "t3", user: "u3", updatedAt: new Date("2026-01-01") },
    { _id: "t4", user: "u9", updatedAt: new Date("2026-01-01") }, // no rating on `from`: untouched
  ];
  const plan = planRatingMerge(from, to);
  assert.deepEqual(ids(plan.remove), ["f1", "f2", "t2", "t3"]);
  assert.deepEqual(ids(plan.move), ["f3", "f4"]);

  const all = [...from, ...to];
  const removed = new Set(ids(plan.remove));
  const survivors = all.filter((doc) => !removed.has(doc._id));
  const perUser = Map.groupBy(survivors, (doc) => doc.user);
  for (const [user, docs] of perUser) assert.equal(docs.length, 1, `user ${user}`);
});

test("equal timestamps fall back to the newer ObjectId, deterministically", () => {
  const at = new Date("2026-05-01");
  const a = { _id: "6a0000000000000000000001", user: "u1", updatedAt: at };
  const b = { _id: "6a0000000000000000000002", user: "u1", updatedAt: at };
  assert.deepEqual(planRatingMerge([a], [b]), { remove: [a], move: [] });
  assert.deepEqual(planRatingMerge([b], [a]), { remove: [a], move: [b] });
});
