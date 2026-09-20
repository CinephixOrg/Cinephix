import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { idOf, isHiddenEntry, stripHidden } from "./blockFilter.js";

const A = new mongoose.Types.ObjectId(); // the viewer
const B = new mongoose.Types.ObjectId(); // blocked
const C = new mongoose.Types.ObjectId(); // someone else
const hidden = new Set([B.toString()]);

test("ids come out of strings, ObjectIds and populated documents", () => {
  assert.equal(idOf(B.toString()), B.toString());
  assert.equal(idOf(B), B.toString());
  assert.equal(idOf({ _id: B, username: "b" }), B.toString());
  assert.equal(idOf({ _id: B.toString() }), B.toString());
  assert.equal(idOf(null), null);
  assert.equal(idOf(42), null);
});

test("an entry is hidden when it is the person, or anything they made", () => {
  assert.equal(isHiddenEntry({ _id: B, username: "b" }, hidden), true, "a person in a list");
  assert.equal(isHiddenEntry({ user: B, text: "review" }, hidden), true, "raw author id");
  assert.equal(isHiddenEntry({ user: { _id: B, username: "b" } }, hidden), true, "populated author");
  assert.equal(isHiddenEntry({ owner: { _id: B } }, hidden), true, "list owner");
  assert.equal(isHiddenEntry({ sender: B.toString() }, hidden), true, "message sender");
  assert.equal(isHiddenEntry({ actor: { _id: B } }, hidden), true, "activity actor");
  assert.equal(isHiddenEntry({ otherUser: { _id: B } }, hidden), true, "inbox row");
  assert.equal(
    isHiddenEntry({ type: "group", name: "Noir", lastMessageSenderId: { _id: B, username: "b" } }, hidden),
    false,
    "a community isn't hidden because a blocked person spoke last"
  );
  assert.equal(isHiddenEntry({ user: C, text: "fine" }, hidden), false);
  assert.equal(isHiddenEntry({ _id: B }, hidden), false, "an id alone (no username) isn't a person — e.g. a list with B's id collision");
  assert.equal(isHiddenEntry({ title: "Inception" }, hidden), false);
});

test("hidden entries leave every list, at any depth, and nothing else changes", () => {
  const body = {
    success: true,
    data: {
      items: [
        { user: { _id: B, username: "b" }, text: "gone" },
        { user: { _id: C, username: "c" }, text: "kept", likedBy: [{ _id: B, username: "b" }, { _id: C, username: "c" }] },
      ],
      podium: { mostFollowed: [{ user: { _id: B } }, { user: { _id: C } }] },
      total: 2,
    },
  };
  const out = stripHidden(body, hidden);
  assert.deepEqual(out.data.items.map((i) => i.text), ["kept"]);
  assert.deepEqual(out.data.items[0].likedBy.map((u) => u.username), ["c"]);
  assert.equal(out.data.podium.mostFollowed.length, 1);
  assert.equal(out.data.total, 2, "counts are the endpoint's business");
  assert.equal(body.data.items.length, 2, "the original isn't mutated");
});

test("a single object on its own is never removed — only list entries", () => {
  const profile = { success: true, data: { _id: B, username: "b", bio: "hi" } };
  assert.equal(stripHidden(profile, hidden), profile);
});

test("nothing to hide returns the very same value", () => {
  const body = { data: [{ user: C }, { user: A }] };
  assert.equal(stripHidden(body, hidden), body);
  assert.equal(stripHidden(body, new Set()), body);
  assert.equal(stripHidden(body, undefined), body);
});

test("ObjectIds, dates and primitives pass through untouched", () => {
  const when = new Date();
  const body = { data: [{ user: C, createdAt: when, id: B, n: 1, ok: true, tags: ["x"] }] };
  const out = stripHidden(body, hidden);
  assert.equal(out, body);
  assert.equal(out.data[0].createdAt, when);
});

test("a raw id array (likes: [ids]) is left alone — only entries that are people or made by them go", () => {
  const body = { likes: [B, C] };
  assert.equal(stripHidden(body, hidden), body);
});
