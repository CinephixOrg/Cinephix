import test from "node:test";
import assert from "node:assert/strict";
import { TICKET_STATUS_META, TICKET_TYPE_LABEL, TICKET_TYPE_OPTIONS, isTicketActive, sortTickets } from "./tickets.ts";
import { resources } from "../locales/index.ts";

const ticket = (id: string, createdAt: string, hasUnreadReply = false) =>
  ({ _id: id, createdAt, hasUnreadReply }) as Parameters<typeof sortTickets>[0][number];

test("an unread answer comes first, then the newest tickets", () => {
  const sorted = sortTickets([
    ticket("old", "2026-01-01T00:00:00Z"),
    ticket("answered", "2025-06-01T00:00:00Z", true),
    ticket("new", "2026-03-01T00:00:00Z"),
  ]);
  assert.deepEqual(
    sorted.map((t) => t._id),
    ["answered", "new", "old"]
  );
});

test("a ticket is active until it's resolved or closed", () => {
  assert.equal(isTicketActive("Open"), true);
  assert.equal(isTicketActive("In Progress"), true);
  assert.equal(isTicketActive("Resolved"), false);
  assert.equal(isTicketActive("Closed"), false);
});

test("every type the server accepts is offered, with a label", () => {
  assert.deepEqual(
    TICKET_TYPE_OPTIONS.map((option) => option.value),
    ["Bug Report", "Feature Request", "General Support", "Other"]
  );
  for (const option of TICKET_TYPE_OPTIONS) assert.equal(TICKET_TYPE_LABEL[option.value], option.label);
});

// Every language, so a ticket doesn't read half-English on a Turkish phone.
test("every label this screen shows is translated in all 12 languages", () => {
  const keys = [
    ...TICKET_TYPE_OPTIONS.flatMap((option) => [option.label, option.description]),
    ...Object.values(TICKET_STATUS_META).map((meta) => meta.label),
  ];
  for (const [language, bundle] of Object.entries(resources as Record<string, { translation: Record<string, string> }>)) {
    for (const key of keys) {
      const value = bundle.translation[key];
      assert.ok(value && value.trim().length > 0, `${language} is missing "${key}"`);
    }
  }
});
