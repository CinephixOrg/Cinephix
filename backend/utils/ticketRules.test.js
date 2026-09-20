import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MAX_DESCRIPTION, MAX_TITLE, hasUnreadReply, parseTicketInput, parseTicketQuery, parseTicketUpdate } from "./ticketRules.js";

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
