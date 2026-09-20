import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  DELETABLE_TYPES,
  ENTITY_TYPE_OF,
  MAX_REASON,
  parseDeleteTarget,
  parseSuspension,
  resolutionNote,
  suspensionRefusal,
} from "./moderationActions.js";

const id = new mongoose.Types.ObjectId().toString();
const admin = new mongoose.Types.ObjectId();

test("every deletable kind maps to the entity type reports use", () => {
  assert.deepEqual(DELETABLE_TYPES, ["review", "share", "list", "message"]);
  for (const type of DELETABLE_TYPES) {
    assert.ok(ENTITY_TYPE_OF[type], type);
    assert.equal(parseDeleteTarget({ type, id }).error, undefined, type);
  }
});

test("a delete needs a known kind and a real id", () => {
  assert.ok(parseDeleteTarget({ type: "user", id }).error, "accounts are suspended, not deleted here");
  assert.ok(parseDeleteTarget({ type: "review", id: "nope" }).error);
  assert.ok(parseDeleteTarget({}).error);
  const { value } = parseDeleteTarget({ type: "share", id }, { reason: "  spam  " });
  assert.deepEqual(value, { type: "share", id, reason: "spam" });
  assert.equal(parseDeleteTarget({ type: "share", id }, { reason: "x".repeat(900) }).value.reason.length, MAX_REASON);
});

test("suspending needs a reason; lifting one doesn't", () => {
  assert.ok(parseSuspension({ suspended: true }).error, "a suspension without a reason can't be appealed");
  assert.ok(parseSuspension({ suspended: true, reason: "   " }).error);
  assert.deepEqual(parseSuspension({ suspended: true, reason: " harassment " }).value, { suspended: true, reason: "harassment" });
  assert.deepEqual(parseSuspension({ suspended: false }).value, { suspended: false, reason: undefined });
  assert.ok(parseSuspension({}).error);
  assert.ok(parseSuspension({ suspended: "yes" }).error);
});

test("some accounts are out of reach", () => {
  const person = { _id: new mongoose.Types.ObjectId() };
  assert.equal(suspensionRefusal(person, admin), null);
  assert.equal(suspensionRefusal(null, admin), "User not found");
  assert.match(suspensionRefusal({ _id: admin }, admin), /your own account/);
  assert.match(suspensionRefusal({ ...person, isOfficial: true }, admin), /official/);
  assert.match(suspensionRefusal({ ...person, isAdmin: true }, admin), /Moderators/);
});

test("the note on a closed report says who acted and why", () => {
  assert.equal(resolutionNote("deleted", "mod", "spam"), "Content removed by @mod — spam");
  assert.equal(resolutionNote("suspended", "mod"), "Account suspended by @mod");
  assert.equal(resolutionNote("deleted", null), "Content removed by a moderator");
});
