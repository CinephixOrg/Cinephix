import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  MAX_DESCRIPTION,
  MAX_TITLE,
  hasUnreadReply,
  parseTicketExportQuery,
  parseTicketInput,
  parseTicketQuery,
  parseTicketUpdate,
} from "./ticketRules.js";

const id = new mongoose.Types.ObjectId().toString();
const valid = { type: "Bug Report", title: "  Feed won't scroll  ", description: "It freezes after I open a chat." };

test("a valid ticket is accepted and its text tidied", () => {
  const { value, error } = parseTicketInput(valid);
  assert.equal(error, undefined);
  assert.deepEqual(value, { type: "Bug Report", title: "Feed won't scroll", description: "It freezes after I open a chat." });
});

test("every type the app offers is accepted; anything else is refused", () => {
  for (const type of ["Bug Report", "Feature Request", "General Support", "Other"]) {
    assert.equal(parseTicketInput({ ...valid, type }).error, undefined, type);
  }
  assert.ok(parseTicketInput({ ...valid, type: "Complaint" }).error);
  assert.ok(parseTicketInput(undefined).error);
});

test("a ticket needs a real title and a real description", () => {
  assert.ok(parseTicketInput({ ...valid, title: "  a " }).error);
  assert.ok(parseTicketInput({ ...valid, description: "broken" }).error);
  assert.ok(parseTicketInput({ ...valid, title: 42 }).error);
});

test("over-long text is cut rather than refused", () => {
  const { value } = parseTicketInput({ ...valid, title: "t".repeat(400), description: "d".repeat(9000) });
  assert.equal(value.title.length, MAX_TITLE);
  assert.equal(value.description.length, MAX_DESCRIPTION);
});

test("the admin queue filters safely and pages within bounds", () => {
  assert.deepEqual(parseTicketQuery({}).filter, {}, "no filters means every ticket");
  const q = parseTicketQuery({ status: "In Progress", type: "Feature Request", userId: id, page: "2", limit: "500" });
  assert.deepEqual(q.filter, { status: "In Progress", type: "Feature Request", userId: new mongoose.Types.ObjectId(id) });
  assert.equal(q.page, 2);
  assert.equal(q.limit, 100);
  assert.deepEqual(parseTicketQuery({ status: { $ne: "Closed" }, type: "Nope", userId: { $gt: "" } }).filter, {}, "no operator injection");
});

test("an export with no filters is every ticket, as CSV", () => {
  assert.deepEqual(parseTicketExportQuery({}).value, { filter: {}, applied: {}, format: "csv", tzOffset: 0 });
  assert.equal(parseTicketExportQuery({ format: "zip" }).value.format, "zip");
  assert.ok(parseTicketExportQuery({ format: "xlsx" }).error);
});

test("an export keeps the queue's filters, without paging, and no operator injection", () => {
  const { value } = parseTicketExportQuery({ status: "Open", type: "Bug Report", userId: id, page: "3", limit: "5" });
  assert.deepEqual(value.filter, { status: "Open", type: "Bug Report", userId: new mongoose.Types.ObjectId(id) });
  assert.deepEqual(value.applied, { status: "Open", type: "Bug Report", userId: id });
  assert.deepEqual(parseTicketExportQuery({ status: { $ne: "x" } }).value.filter, {});
});

test("an export's date range: whole days in the admin's timezone, or exact instants", () => {
  // Istanbul (UTC+3): 1 Oct starts 30 Sep 21:00 UTC; "to 2 Oct" runs to the end of 2 Oct.
  const days = parseTicketExportQuery({ from: "2026-10-01", to: "2026-10-02", tz: "-180" }).value;
  assert.deepEqual(days.filter.createdAt, { $gte: new Date("2026-09-30T21:00:00Z"), $lt: new Date("2026-10-02T21:00:00Z") });
  assert.deepEqual(days.applied, { from: "2026-10-01", to: "2026-10-02" });

  const exact = parseTicketExportQuery({ from: "2026-10-01T08:00:00Z", to: "2026-10-01T09:00:00Z" }).value;
  assert.deepEqual(exact.filter.createdAt, { $gte: new Date("2026-10-01T08:00:00Z"), $lte: new Date("2026-10-01T09:00:00Z") });

  assert.ok(parseTicketExportQuery({ from: "2026-10-01", to: "2026-10-01" }).value, "one whole day");
  assert.ok(parseTicketExportQuery({ from: "yesterday" }).error);
  assert.ok(parseTicketExportQuery({ from: "2026-10-05", to: "2026-10-01" }).error);
  assert.equal(parseTicketExportQuery({ tz: "99999" }).value.tzOffset, 0, "an impossible offset is ignored");
});

test("an update needs a known status, a reply, or both", () => {
  assert.deepEqual(parseTicketUpdate({ status: "Resolved" }).value, { status: "Resolved", reply: undefined });
  assert.deepEqual(parseTicketUpdate({ reply: "  fixed in the next build  " }).value, { status: undefined, reply: "fixed in the next build" });
  assert.ok(parseTicketUpdate({ status: "Deleted" }).error);
  assert.ok(parseTicketUpdate({}).error, "an empty update would still notify the person");
  assert.ok(parseTicketUpdate({ reply: "   " }).error);
});

test("a reply counts as unread until the person opens the ticket again", () => {
  const repliedAt = new Date("2026-01-02T10:00:00Z");
  assert.equal(hasUnreadReply({ repliedAt }), true, "never opened since the reply");
  assert.equal(hasUnreadReply({ repliedAt, userReadAt: new Date("2026-01-01T10:00:00Z") }), true);
  assert.equal(hasUnreadReply({ repliedAt, userReadAt: new Date("2026-01-03T10:00:00Z") }), false);
  assert.equal(hasUnreadReply({ userReadAt: new Date() }), false, "no reply yet");
  assert.equal(hasUnreadReply(null), false);
});
