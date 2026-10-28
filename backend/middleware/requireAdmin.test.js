// The admin API's gate, end to end: the real router (routes/adminRoute.js)
// behind the real authMiddleware and requireAdmin, over real Express. No
// database — the few model calls the auth step and these routes make are
// stood in for, the way blockFilter.test.js does.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import requireAdmin from "./requireAdmin.js";
import authMiddleware from "./authMiddleware.js";
import adminRoute from "../routes/adminRoute.js";
import User from "../models/User.js";
import Ticket from "../models/Ticket.js";

const SECRET = "test-secret";
const oid = () => new mongoose.Types.ObjectId();
const ADMIN = { _id: oid(), username: "mod", isAdmin: true, lastActiveAt: new Date() };
const MEMBER = { _id: oid(), username: "şule", isAdmin: false, accountTier: "plus", lastActiveAt: new Date() };
const PEOPLE = { [ADMIN._id]: ADMIN, [MEMBER._id]: MEMBER };

const stubbed = [];
function stub(model, name, fn) {
  stubbed.push([model, name, model[name]]);
  model[name] = fn;
}

// What the routes under test asked the database for.
let created = null;
let searchSelect = null;

let server;
let base;
let previousSecret;

before(async () => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = SECRET;

  // The auth step: the caller by id, their (empty) block lists.
  stub(User, "findById", (id) => Promise.resolve(PEOPLE[String(id)] ?? null));
  stub(User, "find", (filter) => {
    const rows = filter.username ? [{ _id: MEMBER._id, username: MEMBER.username, accountTier: MEMBER.accountTier }] : [];
    const chain = {
      select: (fields) => {
        if (filter.username) searchSelect = fields;
        return chain;
      },
      sort: () => chain,
      limit: () => chain,
      lean: async () => rows,
    };
    return chain;
  });
  stub(User, "exists", async (filter) => (PEOPLE[String(filter._id)] ? { _id: filter._id } : null));
  stub(User, "updateOne", async () => ({}));
  // Saving a manual ticket and reading it back.
  stub(Ticket, "create", async (doc) => {
    created = { _id: oid(), ...doc };
    return created;
  });
  stub(Ticket, "findById", () => {
    const chain = { populate: () => chain, lean: async () => created };
    return chain;
  });

  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoute);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api/admin`;
});

after(() => {
  server.close();
  for (const [model, name, original] of stubbed.reverse()) model[name] = original;
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

const tokenFor = (user) => jwt.sign({ id: String(user._id) }, SECRET);

async function call(method, path, { as, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (as) headers.authorization = `Bearer ${tokenFor(as)}`;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const manualTicket = { type: "Bug Report", title: "Çöküyor", description: "İzleme listesinde ğ, ş, ı" };

test("requireAdmin refuses anyone who isn't an admin, and lets an admin through", () => {
  for (const user of [undefined, {}, { isAdmin: false }]) {
    let status;
    let nextCalled = false;
    const res = { status: (code) => ((status = code), { json: () => {} }) };
    requireAdmin({ user }, res, () => (nextCalled = true));
    assert.equal(status, 403, JSON.stringify(user));
    assert.equal(nextCalled, false);
  }
  const req = { user: { isAdmin: true } };
  let nextCalled = false;
  requireAdmin(req, {}, () => (nextCalled = true));
  assert.equal(nextCalled, true);
});

test("the admin router puts sign-in and the admin check in front of every route", () => {
  const layers = adminRoute.stack;
  assert.equal(layers[0].handle, authMiddleware);
  assert.equal(layers[1].handle, requireAdmin);
  assert.ok(layers.slice(2).every((layer) => layer.route), "no route registered before the gate");
  const routes = layers.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
  for (const route of ["post /tickets", "get /tickets", "get /tickets/export", "patch /tickets/:id", "get /users/search"]) {
    assert.ok(routes.includes(route), route);
  }
  assert.ok(routes.indexOf("get /users/search") < routes.indexOf("get /users/:id"), "search isn't taken for a user id");
});

test("no token, or a member's token, never reaches the ticket or user-search routes", async () => {
  const routes = [
    ["POST", "/tickets", manualTicket],
    ["GET", "/tickets"],
    ["GET", "/tickets/export"],
    ["PATCH", `/tickets/${oid()}`, { status: "Closed" }],
    ["GET", "/users/search?q=s"],
  ];
  for (const [method, path, body] of routes) {
    assert.equal((await call(method, path, { body })).status, 401, `${method} ${path} without a token`);
    const asMember = await call(method, path, { as: MEMBER, body });
    assert.equal(asMember.status, 403, `${method} ${path} as a member`);
    assert.deepEqual(asMember.body, { success: false, message: "Admins only" });
  }
  assert.equal(created, null, "nothing was saved");
});

test("an admin adds a manual ticket: marked manual, with who added it and the reporter", async () => {
  const res = await call("POST", "/tickets", {
    as: ADMIN,
    body: { ...manualTicket, reporterId: String(MEMBER._id), source: "Friend feedback" },
  });
  assert.equal(res.status, 201);
  assert.equal(created.manual, true);
  assert.equal(String(created.createdByAdmin), String(ADMIN._id));
  assert.equal(String(created.userId), String(MEMBER._id));
  assert.equal(created.source, "Friend feedback");
  assert.equal(created.status, "Open");
  assert.equal(res.body.data.title, "Çöküyor", "Turkish text intact through the request");
  assert.equal(res.body.data.description, "İzleme listesinde ğ, ş, ı");
});

test("an admin's manual ticket is validated on the server", async () => {
  created = null;
  const refused = [
    [{ ...manualTicket, title: "" }, "Title is required"],
    [{ ...manualTicket, description: "x".repeat(4001) }, "Description can be at most 4000 characters"],
    [{ ...manualTicket, type: "Other" }, "Type must be Bug Report or Feature Request"],
    [{ ...manualTicket, reporterId: String(oid()) }, "Reporter not found"],
  ];
  for (const [body, message] of refused) {
    const res = await call("POST", "/tickets", { as: ADMIN, body });
    assert.equal(res.status, 400, message);
    assert.equal(res.body.message, message);
  }
  assert.equal(created, null, "nothing was saved");
});

test("the admin user search returns only id, username and tier", async () => {
  const res = await call("GET", "/users/search?q=%C5%9Fu", { as: ADMIN });
  assert.equal(res.status, 200);
  assert.equal(searchSelect, "_id username accountTier");
  assert.deepEqual(res.body.data.items, [{ _id: String(MEMBER._id), username: "şule", accountTier: "plus" }]);
  assert.equal((await call("GET", "/users/search?q=", { as: ADMIN })).status, 400);
});
