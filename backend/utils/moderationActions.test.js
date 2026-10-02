import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  DELETABLE_TYPES,
  ENTITY_TYPE_OF,
  MAX_REASON,
  SUSPENSION_DURATIONS,
  parseDeleteTarget,
  parseSuspension,
  resolutionNote,
  suspendedUntil,
  suspensionActive,
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
  assert.deepEqual(parseSuspension({ suspended: true, reason: " harassment " }).value, { suspended: true, reason: "harassment", hours: null });
  assert.deepEqual(parseSuspension({ suspended: false }).value, { suspended: false, reason: undefined, hours: null });
  assert.ok(parseSuspension({}).error);
  assert.ok(parseSuspension({ suspended: "yes" }).error);
});

test("a suspension can be temporary, and no length means permanent", () => {
  for (const duration of SUSPENSION_DURATIONS) {
    const { value, error } = parseSuspension({ suspended: true, reason: "spam", durationHours: duration.hours });
    assert.equal(error, undefined, duration.key);
    assert.equal(value.hours, duration.hours, duration.key);
  }
  assert.equal(parseSuspension({ suspended: true, reason: "spam" }).value.hours, null, "absent means permanent");
  // A web form's select sends its value as a string.
  assert.equal(parseSuspension({ suspended: true, reason: "spam", durationHours: "24" }).value.hours, 24);
  for (const bad of [0, -5, 1.5, "abc", 99999, Infinity]) {
    assert.ok(parseSuspension({ suspended: true, reason: "spam", durationHours: bad }).error, String(bad));
  }
});

test("a length becomes an end date; permanent has none", () => {
  const now = new Date("2026-09-20T12:00:00Z");
  assert.equal(suspendedUntil(24, now).toISOString(), "2026-09-21T12:00:00.000Z");
  assert.equal(suspendedUntil(168, now).toISOString(), "2026-09-27T12:00:00.000Z");
  assert.equal(suspendedUntil(null, now), null);
});

test("a temporary suspension stops standing once it runs out", () => {
  const now = new Date("2026-09-20T12:00:00Z");
  assert.equal(suspensionActive({ isSuspended: true }, now), true, "no end date is permanent");
  assert.equal(suspensionActive({ isSuspended: true, suspendedUntil: new Date("2026-09-21T12:00:00Z") }, now), true);
  assert.equal(suspensionActive({ isSuspended: true, suspendedUntil: new Date("2026-09-19T12:00:00Z") }, now), false, "expired");
  assert.equal(suspensionActive({ isSuspended: false, suspendedUntil: new Date("2026-12-01T00:00:00Z") }, now), false);
  assert.equal(suspensionActive(null, now), false);
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
