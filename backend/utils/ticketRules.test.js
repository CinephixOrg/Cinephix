import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import sift from "sift";
import Ticket from "../models/Ticket.js";
import {
  MAX_DESCRIPTION,
  MAX_SOURCE,
  MAX_TITLE,
  TICKETS_PER_DAY,
  appTicketFilter,
  dailyLimitFilter,
  forUser,
  hasUnreadReply,
  manualTicketDoc,
  parseAdminTicketInput,
  parseTicketExportQuery,
  parseTicketInput,
  parseTicketQuery,
  parseTicketUpdate,
  shouldPushTicketUpdate,
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

// ─── Manual tickets ──────────────────────────────────────────────────────────

const adminId = new mongoose.Types.ObjectId();
const manual = { type: "Feature Request", title: "  Liste sıralaması  ", description: "Arkadaş geri bildirimi: çğıöşü ÇĞİÖŞÜ" };

test("a manual ticket needs a bug/idea type, a title and a description; status defaults to Open", () => {
  const { value, error } = parseAdminTicketInput(manual);
  assert.equal(error, undefined);
  assert.deepEqual(value, { type: "Feature Request", title: "Liste sıralaması", description: manual.description, status: "Open" });
  assert.ok(parseAdminTicketInput({ ...manual, type: "General Support" }).error, "only Bug Report / Feature Request");
  assert.ok(parseAdminTicketInput({ ...manual, title: "   " }).error);
  assert.ok(parseAdminTicketInput({ ...manual, description: undefined }).error);
  assert.ok(parseAdminTicketInput(null).error);
  assert.equal(parseAdminTicketInput({ ...manual, status: "Resolved" }).value.status, "Resolved");
  assert.ok(parseAdminTicketInput({ ...manual, status: "Deleted" }).error);
});

test("a manual ticket's text is refused past its limit, not cut", () => {
  assert.ok(parseAdminTicketInput({ ...manual, title: "ş".repeat(MAX_TITLE) }).value, "exactly at the limit, in Turkish letters");
  assert.ok(parseAdminTicketInput({ ...manual, title: "t".repeat(MAX_TITLE + 1) }).error);
  assert.ok(parseAdminTicketInput({ ...manual, description: "d".repeat(MAX_DESCRIPTION + 1) }).error);
  assert.ok(parseAdminTicketInput({ ...manual, source: "s".repeat(MAX_SOURCE + 1) }).error);
});

test("a manual ticket's reporter and source are optional, and only plain values pass", () => {
  const { value } = parseAdminTicketInput({ ...manual, reporterId: id, source: " Friend feedback " });
  assert.equal(value.reporterId, id);
  assert.equal(value.source, "Friend feedback");
  assert.equal(parseAdminTicketInput({ ...manual, reporterId: "", source: "" }).value.reporterId, undefined);
  assert.ok(parseAdminTicketInput({ ...manual, reporterId: "nobody" }).error);
  assert.ok(parseAdminTicketInput({ ...manual, reporterId: { $ne: null } }).error, "no operator injection");
  assert.ok(parseAdminTicketInput({ ...manual, title: { $gt: "" } }).error);
});

test("a manual ticket is saved marked manual, with who added it", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const withReporter = manualTicketDoc(parseAdminTicketInput({ ...manual, reporterId: id, source: "Friend feedback" }).value, adminId, now);
  assert.deepEqual(withReporter, {
    type: "Feature Request",
    title: "Liste sıralaması",
    description: manual.description,
    status: "Open",
    manual: true,
    createdByAdmin: adminId,
    userId: new mongoose.Types.ObjectId(id),
    source: "Friend feedback",
  });
  const bare = manualTicketDoc(parseAdminTicketInput({ ...manual, status: "In Progress" }).value, adminId, now);
  assert.equal(bare.userId, undefined, "no reporter at all");
  assert.equal(bare.statusChangedAt, now);
});

// sift is the matcher Mongoose itself uses, so these are MongoDB's own query semantics.
const matches = (filter, docs) => docs.filter(sift(filter));

test("the app never sees a manual ticket — and still sees tickets from before the field existed", () => {
  const userId = new mongoose.Types.ObjectId();
  const legacy = { _id: 1, userId }; // no `manual` field at all
  const current = { _id: 2, userId, manual: false };
  const manualOne = { _id: 3, ...manualTicketDoc(parseAdminTicketInput({ ...manual, reporterId: String(userId) }).value, adminId) };
  const someoneElse = { _id: 4, userId: new mongoose.Types.ObjectId() };
  const docs = [legacy, current, manualOne, someoneElse];
  assert.deepEqual(matches(appTicketFilter(userId), docs).map((d) => d._id), [1, 2]);
  assert.deepEqual(matches(appTicketFilter(userId, { _id: 3 }), docs), [], "nor open or mark read a manual one by id");
});

test("manual tickets added for someone don't use up their daily limit", () => {
  const userId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-22T12:00:00Z");
  const createdAt = new Date("2026-10-22T09:00:00Z");
  const manualOnes = Array.from({ length: TICKETS_PER_DAY + 5 }, () => ({
    ...manualTicketDoc(parseAdminTicketInput({ ...manual, reporterId: String(userId) }).value, adminId),
    createdAt,
  }));
  const own = [{ userId, createdAt }, { userId, manual: false, createdAt }];
  const yesterday = { userId, createdAt: new Date("2026-10-21T11:00:00Z") };
  const counted = matches(dailyLimitFilter(userId, now), [...manualOnes, ...own, yesterday]);
  assert.equal(counted.length, 2, "only their own tickets from the last 24 hours");
  assert.ok(counted.length < TICKETS_PER_DAY);
});

test("the app's view of a ticket never carries the reporter, the moderators or how it was filed", () => {
  const ticket = {
    _id: new mongoose.Types.ObjectId(),
    userId: { _id: new mongoose.Types.ObjectId(), username: "şule", accountTier: "plus" },
    type: "Bug Report",
    title: "Çöküyor",
    description: "Açılışta çöküyor",
    status: "Open",
    adminReply: "Bakıyoruz",
    replies: [{ text: "Bakıyoruz", adminId: { _id: adminId, username: "mod" }, createdAt: new Date() }],
    manual: true,
    createdByAdmin: { _id: adminId, username: "mod" },
    source: "Friend feedback",
    userReadAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const view = forUser(ticket);
  for (const key of ["userId", "manual", "createdByAdmin", "source", "userReadAt"]) assert.ok(!(key in view), key);
  assert.deepEqual(Object.keys(view.replies[0]).sort(), ["createdAt", "text"]);
  const json = JSON.stringify(view);
  for (const leak of ["şule", "mod", String(adminId), String(ticket.userId._id), "Friend feedback"]) assert.ok(!json.includes(leak), leak);
  assert.equal(view.title, "Çöküyor");
});

test("a moderator's change is pushed only to someone who wrote the ticket themselves", () => {
  const userId = new mongoose.Types.ObjectId();
  assert.equal(shouldPushTicketUpdate({ userId }), true, "a ticket from before `manual` existed");
  assert.equal(shouldPushTicketUpdate({ userId, manual: false }), true);
  assert.equal(shouldPushTicketUpdate({ userId, manual: true }), false, "manual, even with a reporter");
  assert.equal(shouldPushTicketUpdate({ manual: true }), false);
  assert.equal(shouldPushTicketUpdate({ manual: false }), false, "no one to push to");
  assert.equal(shouldPushTicketUpdate(null), false);
});

test("the schema: a manual ticket needs no reporter; every other ticket still does, with no migration", () => {
  const bare = new Ticket(manualTicketDoc(parseAdminTicketInput(manual).value, adminId));
  assert.equal(bare.validateSync(), undefined, "manual, no reporter");
  assert.equal(bare.title, "Liste sıralaması");

  const fromApp = new Ticket({ type: "Bug Report", title: "Çöküyor", description: "Açılışta çöküyor" });
  assert.ok(fromApp.validateSync()?.errors.userId, "an app ticket without a user is refused");
  assert.equal(fromApp.manual, false, "new app tickets default to manual: false");

  const tooLong = new Ticket({ ...manualTicketDoc(parseAdminTicketInput(manual).value, adminId), source: "s".repeat(MAX_SOURCE + 1) });
  assert.ok(tooLong.validateSync()?.errors.source, "the schema holds the source limit too");
});
