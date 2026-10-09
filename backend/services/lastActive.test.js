// lastActiveAt through the real auth middleware, with the database stood
// in for: written once per interval per user, never holding up a request,
// and never failing one.

import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { resetLastActiveTracking, touchLastActive } from "./lastActive.js";

process.env.JWT_SECRET ||= "test-secret";
const oid = () => new mongoose.Types.ObjectId();
const users = new Map();
const writes = [];
let writeBehaviour = "ok"; // "ok" | "hang" | "fail"
const original = { findById: User.findById, find: User.find, updateOne: User.updateOne };
const chain = (value) => {
  const query = { select: () => query, lean: () => query, then: (ok, ko) => Promise.resolve(value).then(ok, ko) };
  return query;
};

before(() => {
  User.findById = (id) => chain(users.get(String(id)) ?? null);
  User.find = () => chain([]);
  User.updateOne = (filter, update, options) => {
    writes.push({ filter, update, options });
    if (writeBehaviour === "hang") return new Promise(() => {});
    if (writeBehaviour === "fail") return Promise.reject(new Error("db down"));
    return Promise.resolve({ modifiedCount: 1 });
  };
});
after(() => Object.assign(User, original));
beforeEach(() => {
  users.clear();
  writes.length = 0;
  writeBehaviour = "ok";
  resetLastActiveTracking();
});

let server;
let base;
before(async () => {
  const app = express();
  app.get("/api/ping", authMiddleware, (_req, res) => res.json({ ok: true }));
  await new Promise((resolve) => (server = app.listen(0, resolve)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

const addUser = (fields = {}) => {
  const user = { _id: oid(), username: `u${users.size}`, accountTier: "free", ...fields };
  users.set(String(user._id), user);
  return user;
};
const ping = (user) => fetch(`${base}/api/ping`, { headers: { authorization: `Bearer ${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}` } });

test("a burst of requests records lastActiveAt once, without touching updatedAt", async () => {
  const user = addUser();
  for (let i = 0; i < 5; i++) assert.equal((await ping(user)).status, 200);
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].update.$set), ["lastActiveAt"]);
  assert.equal(String(writes[0].filter._id), String(user._id));
  assert.deepEqual(writes[0].options, { timestamps: false });
});

test("a recent lastActiveAt in the database means no write; an old one means one", async () => {
  addUser({ lastActiveAt: new Date(Date.now() - 60_000) });
  const recent = [...users.values()][0];
  await ping(recent);
  assert.equal(writes.length, 0);

  const stale = addUser({ lastActiveAt: new Date(Date.now() - 6 * 60_000) });
  await ping(stale);
  assert.equal(writes.length, 1);
});

test("the request never waits on the write, and a failed write doesn't fail it", async () => {
  writeBehaviour = "hang";
  const slow = addUser();
  const res = await Promise.race([ping(slow), new Promise((resolve) => setTimeout(() => resolve("timed out"), 2000))]);
  assert.notEqual(res, "timed out");
  assert.equal(res.status, 200);

  writeBehaviour = "fail";
  const failing = addUser();
  assert.equal((await ping(failing)).status, 200);
  assert.equal(writes.length, 2);
});

test("touchLastActive: per user, and due again after the interval", () => {
  const a = { _id: oid() };
  const b = { _id: oid() };
  const t0 = new Date("2026-10-09T12:00:00Z");
  assert.equal(touchLastActive(a, t0), true);
  assert.equal(touchLastActive(a, new Date(t0.getTime() + 4 * 60_000)), false);
  assert.equal(touchLastActive(b, t0), true, "another user isn't throttled by a");
  assert.equal(touchLastActive(a, new Date(t0.getTime() + 5 * 60_000)), true);
  assert.equal(touchLastActive(null), false);
});
