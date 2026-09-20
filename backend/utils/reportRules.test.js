import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MAX_DESCRIPTION, parseDecision, parseQueueQuery, parseReportInput } from "./reportRules.js";

const id = new mongoose.Types.ObjectId().toString();

test("a valid report is accepted and its description tidied", () => {
  const { value, error } = parseReportInput({ entityType: "Review", entityId: id, reason: "spoiler", description: "  ruined the ending  " });
  assert.equal(error, undefined);
  assert.deepEqual(value, { entityType: "Review", entityId: id, reason: "spoiler", description: "ruined the ending" });
  assert.equal(parseReportInput({ entityType: "User", entityId: id, reason: "spam", description: "   " }).value.description, undefined);
  assert.equal(parseReportInput({ entityType: "List", entityId: id, reason: "other", description: "x".repeat(5000) }).value.description.length, MAX_DESCRIPTION);
});

test("unknown types, reasons and bad ids are refused", () => {
  assert.ok(parseReportInput({ entityType: "Movie", entityId: id, reason: "spam" }).error);
  assert.ok(parseReportInput({ entityType: "User", entityId: "nope", reason: "spam" }).error);
  assert.ok(parseReportInput({ entityType: "User", entityId: id, reason: "boredom" }).error);
  assert.ok(parseReportInput(undefined).error);
});

test("every content type the app can report is accepted", () => {
  for (const entityType of ["User", "List", "Review", "Comment", "Share", "Message"]) {
    assert.equal(parseReportInput({ entityType, entityId: id, reason: "inappropriate" }).error, undefined, entityType);
  }
});

test("the moderation queue defaults to pending, filters safely and pages within bounds", () => {
  assert.deepEqual(parseQueueQuery({}).filter, { status: "pending" });
  const q = parseQueueQuery({ status: "resolved", entityType: "Share", reportedUserId: id, page: "3", limit: "500" });
  assert.equal(q.filter.status, "resolved");
  assert.equal(q.filter.entityType, "Share");
  assert.equal(String(q.filter.reportedUserId), id);
  assert.equal(q.page, 3);
  assert.equal(q.limit, 100);
  const bad = parseQueueQuery({ status: { $ne: "x" }, entityType: "Nope", reportedUserId: { $gt: "" } });
  assert.deepEqual(bad.filter, { status: "pending" }, "operator injection falls back to defaults");
});

test("a user's history: every status, reports about them or by them", () => {
  assert.deepEqual(parseQueueQuery({ status: "all", reportedUserId: id }).filter, { reportedUserId: new mongoose.Types.ObjectId(id) });
  assert.deepEqual(parseQueueQuery({ status: "all", reporterId: id }).filter, { reporterId: new mongoose.Types.ObjectId(id) });
  assert.deepEqual(parseQueueQuery({ status: "all", reporterId: { $ne: null } }).filter, {}, "no operator injection");
});

test("decisions: known statuses only, with an optional note", () => {
  assert.deepEqual(parseDecision({ status: "resolved", resolutionNote: " removed " }).value, { status: "resolved", resolutionNote: "removed" });
  assert.deepEqual(parseDecision({ status: "pending" }).value, { status: "pending", resolutionNote: undefined });
  assert.ok(parseDecision({ status: "deleted" }).error);
});
