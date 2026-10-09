// Admin-granted tiers through the real middleware and routes, with the
// database stood in for: who may use the admin endpoints, a grant that has
// run out ending on the next request or login, and the tier the existing
// clients read (req.user.accountTier, the login response's accountTier).

import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import TierGrantLog from "../models/TierGrantLog.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminRoute from "../routes/adminRoute.js";
import { loginUser } from "../controllers/userController.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { expireDueTierGrants, expireTierGrantIfDue } from "./tierGrants.js";

process.env.JWT_SECRET ||= "test-secret";
const DAY = 24 * 60 * 60 * 1000;
const oid = () => new mongoose.Types.ObjectId();
const tokenFor = (id) => jwt.sign({ id: String(id) }, process.env.JWT_SECRET);

// --- The database, stood in for -------------------------------------------

const users = new Map(); // id -> user
const updates = []; // [filter, update]
const logs = [];
const original = {
  findById: User.findById,
  find: User.find,
  findOne: User.findOne,
  updateOne: User.updateOne,
  create: TierGrantLog.create,
};

const chain = (value) => {
  const query = { select: () => query, lean: () => query, sort: () => query, populate: () => query, then: (ok, ko) => Promise.resolve(value).then(ok, ko) };
  return query;
};

before(() => {
  User.findById = (id) => chain(users.get(String(id)) ?? null);
  // blockSets (no blocks), and the hourly sweep's query for ended grants.
  User.find = (filter) => {
    const cutoff = filter?.["tierGrant.expiresAt"]?.$lte;
    if (!cutoff) return chain([]);
    return chain([...users.values()].filter((u) => u.tierGrant && new Date(u.tierGrant.expiresAt) <= cutoff));
  };
  User.findOne = ({ email }) => chain([...users.values()].find((u) => u.email === email) ?? null);
  User.updateOne = async (filter, update) => {
    // "Last active" writes (services/lastActive.js) aren't tier changes.
    if (Object.keys(update.$set ?? {}).join() === "lastActiveAt") return { modifiedCount: 1 };
    updates.push([filter, update]);
    const user = users.get(String(filter._id));
    const matches = user && (!filter["tierGrant.expiresAt"] || user.tierGrant?.expiresAt === filter["tierGrant.expiresAt"]);
    if (!matches) return { modifiedCount: 0 };
    Object.assign(user, update.$set);
    for (const key of Object.keys(update.$unset ?? {})) delete user[key];
    return { modifiedCount: 1 };
  };
  TierGrantLog.create = async (entry) => {
    logs.push(entry);
    return entry;
  };
});

after(() => Object.assign(User, { findById: original.findById, find: original.find, findOne: original.findOne, updateOne: original.updateOne }) && (TierGrantLog.create = original.create));

beforeEach(() => {
  users.clear();
  updates.length = 0;
  logs.length = 0;
});

function addUser(fields) {
  const user = { _id: oid(), username: `u${users.size}`, accountTier: "free", isAdmin: false, ...fields };
  users.set(String(user._id), user);
  return user;
}

const expiredGrant = (previousTier = "free") => ({ tier: "premium", expiresAt: new Date(Date.now() - DAY), previousTier, grantedAt: new Date(Date.now() - 8 * DAY) });
const runningGrant = (previousTier = "free") => ({ tier: "premium", expiresAt: new Date(Date.now() + 5 * DAY), previousTier, grantedAt: new Date() });

// --- A server ------------------------------------------------------------------

let server;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoute);
  // What any authenticated endpoint sees as the caller's tier.
  app.get("/api/whoami", authMiddleware, (req, res) => res.json({ accountTier: req.user.accountTier }));
  app.post("/api/users/login", loginUser);
  app.use(errorHandler);
  await new Promise((resolve) => (server = app.listen(0, resolve)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

const call = (path, { method = "GET", token, body } = {}) =>
  fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body && method !== "GET" ? JSON.stringify(body) : undefined,
  });

// --- Admin-only ----------------------------------------------------------------

const ADMIN_ENDPOINTS = (id) => [
  ["GET", "/api/admin/tier-grants"],
  ["GET", "/api/admin/tier-grants/users?q=a"],
  ["GET", "/api/admin/tier-grants/log"],
  ["POST", `/api/admin/users/${id}/tier-grant`],
  ["PATCH", `/api/admin/users/${id}/tier-grant`],
  ["DELETE", `/api/admin/users/${id}/tier-grant`],
];

test("the grant endpoints refuse anyone signed out (401) or not an admin (403)", async () => {
  const someone = addUser({});
  for (const [method, path] of ADMIN_ENDPOINTS(someone._id)) {
    assert.equal((await call(path, { method })).status, 401, `${method} ${path} signed out`);
    const res = await call(path, { method, token: tokenFor(someone._id), body: { tier: "premium", days: 30 } });
    assert.equal(res.status, 403, `${method} ${path} as a non-admin`);
  }
  assert.equal(updates.length, 0, "nothing was written");
  assert.equal(logs.length, 0);
});

test("an admin gets through to the validation", async () => {
  const admin = addUser({ isAdmin: true });
  const target = addUser({});
  const bad = await call(`/api/admin/users/${target._id}/tier-grant`, { method: "POST", token: tokenFor(admin._id), body: { tier: "pro", days: 7 } });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).message, /plus or premium/);
  const noQuery = await call("/api/admin/tier-grants/users?q=%20", { token: tokenFor(admin._id) });
  assert.equal(noQuery.status, 400);
});

// --- Expiry, and what the existing clients read ---------------------------------

test("a grant that ran out ends on the next request: req.user.accountTier is the tier from before", async () => {
  const user = addUser({ accountTier: "premium", tierGrant: expiredGrant("free") });
  const res = await call("/api/whoami", { token: tokenFor(user._id) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { accountTier: "free" });
  assert.equal(users.get(String(user._id)).accountTier, "free", "written back");
  assert.equal(users.get(String(user._id)).tierGrant, undefined);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "expire");
  assert.equal(logs[0].tierAfter, "free");
});

test("a running grant is untouched: req.user.accountTier is the granted tier", async () => {
  const user = addUser({ accountTier: "premium", tierGrant: runningGrant("free") });
  assert.deepEqual(await (await call("/api/whoami", { token: tokenFor(user._id) })).json(), { accountTier: "premium" });
  assert.equal(updates.length, 0);
});

test("the login response carries the effective tier (what the app's ad check reads)", async () => {
  const password = "correct horse";
  const user = addUser({
    email: "friend@example.com",
    password: await bcrypt.hash(password, 4),
    accountTier: "premium",
    tierGrant: expiredGrant("plus"),
  });
  const res = await call("/api/users/login", { method: "POST", body: { email: user.email, password } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.accountTier, "plus");
});

test("expireTierGrantIfDue: only ended grants, and a re-grant made meanwhile is kept", async () => {
  const running = addUser({ accountTier: "premium", tierGrant: runningGrant() });
  assert.equal(await expireTierGrantIfDue(running), false);
  assert.equal(updates.length, 0);

  const ended = addUser({ accountTier: "premium", tierGrant: expiredGrant("free") });
  const stale = { ...ended, tierGrant: { ...ended.tierGrant } };
  // Re-granted after `stale` was read.
  users.get(String(ended._id)).tierGrant = runningGrant();
  assert.equal(await expireTierGrantIfDue(stale), false, "the newer grant's end date doesn't match");
  assert.equal(users.get(String(ended._id)).accountTier, "premium");
  assert.equal(logs.length, 0);
});

test("the hourly sweep ends every grant that ran out, and only those", async () => {
  const a = addUser({ accountTier: "premium", tierGrant: expiredGrant("free") });
  const b = addUser({ accountTier: "plus", tierGrant: { ...expiredGrant("free"), tier: "plus" } });
  const c = addUser({ accountTier: "premium", tierGrant: runningGrant() });
  assert.equal(await expireDueTierGrants(), 2);
  assert.equal(users.get(String(a._id)).accountTier, "free");
  assert.equal(users.get(String(b._id)).accountTier, "free");
  assert.equal(users.get(String(c._id)).accountTier, "premium");
  assert.deepEqual(logs.map((l) => l.action), ["expire", "expire"]);
});
