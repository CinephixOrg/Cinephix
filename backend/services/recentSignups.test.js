// The admin "Recent signups" endpoints through the real router and auth
// middleware, with the database stood in for: who may call them, the query
// they send to the database (date range, filters, pagination), and that no
// sensitive field reaches the response.

import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Group from "../models/Group.js";
import adminRoute from "../routes/adminRoute.js";
import { errorHandler } from "../middleware/errorHandler.js";

process.env.JWT_SECRET ||= "test-secret";
const oid = () => new mongoose.Types.ObjectId();
const tokenFor = (id) => jwt.sign({ id: String(id) }, process.env.JWT_SECRET);

const users = new Map();
const pipelines = []; // every User.aggregate pipeline
const counts = []; // every User.countDocuments filter
let pageDocs = []; // what the list aggregate "finds"
const original = {
  findById: User.findById,
  find: User.find,
  aggregate: User.aggregate,
  countDocuments: User.countDocuments,
  ratingAggregate: Rating.aggregate,
  groupAggregate: Group.aggregate,
};
const chain = (value) => {
  const query = { select: () => query, lean: () => query, then: (ok, ko) => Promise.resolve(value).then(ok, ko) };
  return query;
};

before(() => {
  User.findById = (id) => chain(users.get(String(id)) ?? null);
  User.find = () => chain([]); // blockSets: nobody blocked
  User.aggregate = async (pipeline) => {
    pipelines.push(pipeline);
    if (pipeline.some((stage) => stage.$facet)) {
      const { $skip, $limit } = Object.assign({}, ...pipeline.find((s) => s.$facet).$facet.items);
      return [{ items: pageDocs.slice($skip, $skip + $limit), total: [{ n: pageDocs.length }] }];
    }
    return [{ _id: "2026-10-09", count: 2 }]; // the daily buckets
  };
  User.countDocuments = async (filter) => {
    counts.push(filter);
    return 5;
  };
  // Four ratings for everyone the query asks about.
  Rating.aggregate = async (pipeline) => pipeline[0].$match.user.$in.map((id) => ({ _id: id, count: 4 }));
  Group.aggregate = async () => [];
});

after(() => {
  Object.assign(User, { findById: original.findById, find: original.find, aggregate: original.aggregate, countDocuments: original.countDocuments });
  Rating.aggregate = original.ratingAggregate;
  Group.aggregate = original.groupAggregate;
});

beforeEach(() => {
  users.clear();
  pipelines.length = 0;
  counts.length = 0;
  pageDocs = [];
});

const addUser = (fields) => {
  const user = { _id: oid(), username: `u${users.size}`, accountTier: "free", isAdmin: false, ...fields };
  users.set(String(user._id), user);
  return user;
};

// A projected document as the list aggregate returns it, plus raw secrets
// that must never get through even if the projection let them.
const projected = (i) => ({
  _id: oid(),
  username: `new${i}`,
  email: `person${i}@example.com`,
  password: "$2a$10$secrethash",
  googleId: "google-sub-123",
  emailVerificationCode: "123456",
  passwordResetCode: "654321",
  pushTokens: [{ token: "ExponentPushToken[xyz]" }],
  hasPassword: i % 2 === 0,
  hasGoogle: i % 2 === 1,
  isEmailVerified: true,
  createdAt: new Date(Date.now() - i * 3600 * 1000),
  accountTier: "free",
  followingCount: i,
  followersCount: 0,
  watchlistCount: 0,
  pushTokenCount: 1,
  lastAppOpenAt: new Date(),
});

let server;
let base;
before(async () => {
  const app = express();
  app.use("/api/admin", adminRoute);
  app.use(errorHandler);
  await new Promise((resolve) => (server = app.listen(0, resolve)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

const get = (path, token) => fetch(base + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });

test("signed out gets 401, a non-admin 403, on every recent-signups endpoint", async () => {
  const someone = addUser({});
  for (const path of ["/api/admin/users/recent", "/api/admin/users/recent/stats", `/api/admin/users/${someone._id}/email`]) {
    assert.equal((await get(path)).status, 401, `${path} signed out`);
    assert.equal((await get(path, tokenFor(someone._id))).status, 403, `${path} as a non-admin`);
  }
  assert.equal(pipelines.length + counts.length, 0, "the database was never asked");
});

test("the list: newest first, date range from the admin's local day, filters, pagination", async () => {
  const admin = addUser({ isAdmin: true });
  pageDocs = Array.from({ length: 25 }, (_, i) => projected(i));
  const res = await get("/api/admin/users/recent?days=7&tz=-180&method=google&verified=true&q=ne&page=2&limit=10", tokenFor(admin._id));
  assert.equal(res.status, 200);
  const { data } = await res.json();

  const pipeline = pipelines[0];
  const match = pipeline[0].$match;
  assert.ok(match.createdAt.$gte instanceof Date);
  // Istanbul midnight six days back: 21:00 UTC.
  assert.equal(new Date(match.createdAt.$gte).getUTCHours(), 21);
  assert.ok(Date.now() - new Date(match.createdAt.$gte).getTime() <= 7 * 86400000);
  assert.deepEqual(match.password, { $in: [null] }, "google signups");
  assert.equal(match.isEmailVerified, true);
  assert.deepEqual(match.username, { $regex: "ne", $options: "i" });
  assert.deepEqual(pipeline[1], { $sort: { createdAt: -1 } });

  assert.equal(data.items.length, 10);
  assert.equal(data.items[0].username, "new10", "page 2 starts at the 11th");
  assert.deepEqual(data.pagination, { page: 2, limit: 10, total: 25, hasMore: true });
  assert.equal(data.items[0].activity.ratings, 4);
});

test("bad filters are refused before any query", async () => {
  const admin = addUser({ isAdmin: true });
  for (const query of ["days=0", "days=400", "method=facebook"]) {
    assert.equal((await get(`/api/admin/users/recent?${query}`, tokenFor(admin._id))).status, 400, query);
  }
  assert.equal(pipelines.length, 0);
});

test("no sensitive field in the list response: emails masked, no password, Google id, codes or tokens", async () => {
  const admin = addUser({ isAdmin: true });
  pageDocs = [projected(0), projected(1)];
  const body = await (await get("/api/admin/users/recent", tokenFor(admin._id))).text();
  for (const secret of ["person0@", "person1@", "secrethash", "google-sub-123", "123456", "654321", "ExponentPushToken", "\"password\":", "\"email\":", "\"googleId\":", "\"pushTokens\":"]) {
    assert.ok(!body.includes(secret), `response contains ${secret}`);
  }
  assert.ok(body.includes("p***@example.com"));
  // The list query itself never reads the secrets out.
  const projection = pipelines[0].find((s) => s.$facet).$facet.items.find((s) => s.$project).$project;
  for (const field of ["password", "googleId", "pushTokens", "emailVerificationCode", "passwordResetCode", "blockedUsers"]) {
    assert.ok(!(field in projection), `projects ${field}`);
  }
});

test("stats: today / 7 / 30 days from local midnights, and 30 daily counts", async () => {
  const admin = addUser({ isAdmin: true });
  const res = await get("/api/admin/users/recent/stats?tz=-180", tokenFor(admin._id));
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.deepEqual([data.today, data.last7, data.last30], [5, 5, 5]);
  assert.equal(data.daily.length, 30);
  const [today, week, month] = counts.map((f) => new Date(f.createdAt.$gte).getTime());
  assert.ok(today > week && week > month);
  assert.equal(Math.round((today - week) / 86400000), 6);
  assert.equal(Math.round((today - month) / 86400000), 29);
  assert.equal(pipelines[0][1].$group._id.$dateToString.timezone, "+03:00");
});

test("revealing one email is admin-only and returns just that", async () => {
  const admin = addUser({ isAdmin: true });
  const target = addUser({ email: "friend@example.com", password: "hash" });
  const res = await get(`/api/admin/users/${target._id}/email`, tokenFor(admin._id));
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.deepEqual(Object.keys(data).sort(), ["_id", "email"]);
  assert.equal(data.email, "friend@example.com");
});
