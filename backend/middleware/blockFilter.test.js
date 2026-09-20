// The block filter end to end, through real Express middleware: the global
// response filter, the not-found guard, the admin gate and the hidden-set
// builder, against the response shapes the real endpoints return. No
// database — the auth step is stood in for by setting req.user/hiddenUsers
// exactly as middleware/authMiddleware.js does.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import { blockedProfileStub, hideBlockedContent, notHiddenUser } from "./blockFilter.js";
import requireAdmin from "./requireAdmin.js";
import User from "../models/User.js";
import { blockedByMeFromRows, hiddenFromRows } from "../services/blockService.js";

const oid = () => new mongoose.Types.ObjectId();
const ME = oid();
const BLOCKED = oid(); // I blocked them
const BLOCKER = oid(); // they blocked me
const FRIEND = oid();
const person = (id, username) => ({ _id: id, username, profile_pic_url: null, accountTier: "free" });

// The viewer's hidden set, built the way blockService builds it from its query.
const ROWS = [
  { _id: ME, blockedUsers: [BLOCKED] },
  { _id: BLOCKER, blockedUsers: [ME] },
];
const HIDDEN = hiddenFromRows(ME, ROWS);
const BLOCKED_BY_ME = blockedByMeFromRows(ME, ROWS);

// Response bodies shaped like the real endpoints'.
const fixtures = {
  "/reviews/feed": { success: true, data: [{ _id: oid(), user: person(BLOCKED, "b"), text: "x" }, { _id: oid(), user: person(FRIEND, "f"), text: "y" }] },
  "/shares/feed": {
    success: true,
    data: {
      items: [
        { _id: oid(), user: person(BLOCKER, "k"), type: "review", topViewers: [] },
        { _id: oid(), user: person(FRIEND, "f"), type: "list", topViewers: [person(BLOCKED, "b"), person(FRIEND, "f")] },
      ],
      hasMore: false,
    },
  },
  "/feed/activity": { success: true, data: { items: [{ type: "rated", actor: person(BLOCKED, "b") }, { type: "followed", actor: person(FRIEND, "f"), targetUser: person(BLOCKER, "k") }, { type: "rated", actor: person(FRIEND, "f") }] } },
  "/feed/people-leaderboard": { success: true, data: { mostFollowed: [{ user: { id: String(BLOCKED), _id: BLOCKED, username: "b" }, count: 9 }, { user: person(FRIEND, "f"), count: 3 }] } },
  "/conversations": { success: true, data: [{ _id: oid(), type: "dm", otherUser: person(BLOCKER, "k") }, { _id: oid(), type: "dm", otherUser: person(FRIEND, "f") }, { _id: oid(), type: "group", name: "Noir" }] },
  "/notifications": { success: true, data: { items: [{ _id: oid(), user: ME, sender: person(BLOCKED, "b"), type: "follow" }, { _id: oid(), user: ME, sender: person(FRIEND, "f"), type: "follow" }] } },
  "/users/search": { success: true, data: { items: [person(BLOCKED, "b"), person(BLOCKER, "k"), person(FRIEND, "f")] } },
  "/groups/noir/members": { success: true, data: [{ user: person(BLOCKED, "b"), joinedAt: new Date() }, { user: person(ME, "me") }] },
  "/match/sync/candidates": { success: true, data: { items: [{ user: person(BLOCKER, "k"), score: 90 }, { user: person(FRIEND, "f"), score: 70 }] } },
  "/groups/noir/messages": { success: true, data: [{ _id: oid(), sender: person(BLOCKED, "b"), text: "hi" }, { _id: oid(), sender: person(ME, "me"), text: "yo" }] },
  "/lists/discover": { success: true, data: [{ _id: oid(), owner: person(BLOCKER, "k"), name: "L1" }, { _id: oid(), owner: person(FRIEND, "f"), name: "L2" }] },
  // A single object: never removed by the filter, whoever it's about.
  "/single": { success: true, data: person(BLOCKED, "b") },
  // A Mongoose-document-like body (class instance with toJSON).
  "/mongoose-like": {
    success: true,
    data: [
      new (class Doc {
        toJSON() {
          return { user: String(BLOCKED), text: "hidden" };
        }
      })(),
      { user: String(FRIEND), text: "kept" },
    ],
  },
};

let server;
let base;

before(async () => {
  const app = express();
  app.use(hideBlockedContent);
  // Stand-in for authMiddleware: who's asking, and who's hidden from them.
  app.use((req, _res, next) => {
    const as = req.headers["x-as"];
    if (as === "anonymous") return next();
    req.user = { _id: ME, isAdmin: as === "admin" };
    req.hiddenUsers = as === "nobody-blocked" ? new Set() : HIDDEN;
    req.blockedByMe = as === "nobody-blocked" ? new Set() : BLOCKED_BY_ME;
    next();
  });
  // The stub's one lookup, without a database.
  User.findById = (id) => ({ select: () => ({ lean: async () => ({ ...person(id, "b"), bio: "secret", email: "x@y.z" }) }) });
  app.get("/full-profile/:id", blockedProfileStub("id"), notHiddenUser("id"), (req, res) => res.json({ _id: req.params.id, username: "full" }));
  app.get("/profile/:id", notHiddenUser("id"), (req, res) => res.json({ success: true, data: { _id: req.params.id } }));
  app.get("/admin/reports", requireAdmin, (_req, res) => res.json(fixtures["/users/search"]));
  for (const [path, body] of Object.entries(fixtures)) app.get(path, (_req, res) => res.json(body));
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const get = async (path, as = "me") => {
  const res = await fetch(base + path, { headers: { "x-as": as } });
  return { status: res.status, body: await res.json() };
};
const names = (list) => list.map((x) => x.username ?? x.user?.username ?? x.actor?.username ?? x.owner?.username ?? x.sender?.username ?? x.otherUser?.username ?? x.name);

test("the hidden set is both directions: people I blocked and people who blocked me", () => {
  assert.deepEqual([...HIDDEN].sort(), [String(BLOCKED), String(BLOCKER)].sort());
  assert.ok(!HIDDEN.has(String(ME)));
});

test("reviews by blocked people disappear from feeds", async () => {
  const { body } = await get("/reviews/feed");
  assert.deepEqual(names(body.data), ["f"]);
});

test("Media posts by either side disappear, and so do blocked viewers on a post", async () => {
  const { body } = await get("/shares/feed");
  assert.equal(body.data.items.length, 1);
  assert.deepEqual(names(body.data.items[0].topViewers), ["f"]);
});

test("activity: by them, or about them, is gone", async () => {
  const { body } = await get("/feed/activity");
  assert.deepEqual(body.data.items.map((i) => `${i.actor.username}:${i.type}`), ["f:rated"]);
});

test("leaderboards, search, Sync candidates and member lists drop them", async () => {
  assert.deepEqual(names((await get("/feed/people-leaderboard")).body.data.mostFollowed), ["f"]);
  assert.deepEqual(names((await get("/users/search")).body.data.items), ["f"]);
  assert.deepEqual(names((await get("/match/sync/candidates")).body.data.items), ["f"]);
  assert.deepEqual(names((await get("/groups/noir/members")).body.data), ["me"]);
});

test("inbox: their DMs are gone, communities stay; their group messages and notifications too", async () => {
  assert.deepEqual(names((await get("/conversations")).body.data), ["f", "Noir"]);
  assert.deepEqual(names((await get("/groups/noir/messages")).body.data), ["me"]);
  assert.deepEqual(names((await get("/notifications")).body.data.items), ["f"]);
});

test("lists by someone who blocked me disappear from discovery", async () => {
  assert.deepEqual((await get("/lists/discover")).body.data.map((l) => l.name), ["L2"]);
});

test("Mongoose documents are filtered through their JSON form", async () => {
  assert.deepEqual((await get("/mongoose-like")).body.data.map((d) => d.text), ["kept"]);
});

test("a blocked profile reads as not found; others pass", async () => {
  assert.equal((await get(`/profile/${BLOCKED}`)).status, 404);
  assert.equal((await get(`/profile/${BLOCKER}`)).status, 404);
  assert.equal((await get(`/profile/${FRIEND}`)).status, 200);
});

test("someone I blocked opens as a stub I can unblock from; someone who blocked me stays not found", async () => {
  assert.deepEqual([...BLOCKED_BY_ME], [String(BLOCKED)]);
  const mine = await get(`/full-profile/${BLOCKED}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.isBlockedByMe, true);
  assert.equal(mine.body.username, "b");
  assert.equal(mine.body.bio, undefined, "only name, picture and tier");
  assert.equal((await get(`/full-profile/${BLOCKER}`)).status, 404);
  const friend = await get(`/full-profile/${FRIEND}`);
  assert.equal(friend.body.username, "full");
  assert.equal(friend.body.isBlockedByMe, undefined);
});

test("a single object is never removed by the list filter", async () => {
  const { status, body } = await get("/single");
  assert.equal(status, 200);
  assert.equal(body.data.username, "b");
});

test("no blocks, or no signed-in user: responses go out untouched", async () => {
  assert.equal((await get("/users/search", "nobody-blocked")).body.data.items.length, 3);
  assert.equal((await get("/users/search", "anonymous")).body.data.items.length, 3);
});

test("the moderation API is admins only, and admins see everyone", async () => {
  assert.equal((await get("/admin/reports", "me")).status, 403);
  const admin = await get("/admin/reports", "admin");
  assert.equal(admin.status, 200);
  assert.equal(admin.body.data.items.length, 3, "the block filter is off for moderators");
});
