// How a chat's message list changes: a refreshed first page landing on top
// of a cached one, a message arriving over the socket, and what's worth
// keeping in the cache. Messages are held oldest first.
//
// Pure and React-free so it runs under `node --test` (chatMessages.test.mts).

import type { Message } from "../types";

const isPending = (message: Message) => message.status === "pending";

/** Oldest first by send time, falling back to id so equal times keep a stable order. */
function olderFirst(a: Message, b: Message): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
}

/**
 * A freshly fetched newest page over what's already on screen.
 *
 * When the fresh page is the whole conversation it replaces the list. When
 * older messages remain on the server, the ones already loaded below the
 * fresh page are kept, so reopening a chat you'd scrolled back through
 * doesn't throw that history away. Messages still sending are kept either
 * way — the server doesn't know about them yet.
 */
export function mergeLatestPage(existing: readonly Message[], fresh: readonly Message[], freshHasMore: boolean): Message[] {
  const freshIds = new Set(fresh.map((message) => message._id));
  const freshTempIds = new Set(fresh.map((message) => message.clientTempId).filter(Boolean));
  const pending = existing.filter(
    (message) => isPending(message) && !freshIds.has(message._id) && !freshTempIds.has(message._id)
  );

  let older: Message[] = [];
  if (freshHasMore && fresh.length > 0) {
    const oldestFresh = [...fresh].sort(olderFirst)[0];
    older = existing.filter(
      (message) => !isPending(message) && !freshIds.has(message._id) && olderFirst(message, oldestFresh) < 0
    );
  }
  return [...older, ...fresh, ...pending];
}

/**
 * A message from the socket: replaces its own optimistic copy (matched by
 * the temporary id it was sent with), is ignored when already present, and
 * is otherwise added at the end.
 */
export function upsertMessage(existing: Message[], incoming: Message): Message[] {
  if (incoming.clientTempId) {
    const index = existing.findIndex((message) => message._id === incoming.clientTempId);
    if (index !== -1) {
      const next = existing.slice();
      next[index] = incoming;
      return next;
    }
  }
  if (existing.some((message) => message._id === incoming._id)) return existing;
  return [...existing, incoming];
}

/** What a cache should hold: only messages the server has confirmed. */
export function confirmedOnly(messages: readonly Message[]): Message[] {
  return messages.some(isPending) ? messages.filter((message) => !isPending(message)) : (messages as Message[]);
}

/**
 * The inbox's timestamp: the time for today's messages, the weekday within
 * the last week, and a short date before that.
 */
export function inboxTimeKind(iso: string, now: Date): "time" | "weekday" | "date" {
  const time = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (time.getTime() >= startOfToday) return "time";
  const sixDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  return time.getTime() >= sixDaysAgo ? "weekday" : "date";
}

export function formatInboxTime(iso: string, now: Date, locale?: string): string {
  const date = new Date(iso);
  switch (inboxTimeKind(iso, now)) {
    case "time":
      return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    case "weekday":
      return date.toLocaleDateString(locale, { weekday: "short" });
    default:
      return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
  }
}

/** Past this gap, a message starts a new run even from the same sender. */
export const RUN_BREAK_MS = 5 * 60_000;

export interface MessageRun {
  /** Starts a run: the sender's name goes above it. */
  first: boolean;
  /** Ends a run: the avatar and the time go beside and under it. */
  last: boolean;
}

/**
 * Consecutive messages from one person, a few minutes apart at most, read as
 * one run: the name once at the top, the avatar and the time once at the
 * bottom, instead of repeating on every bubble. Expects oldest-first input
 * and returns one entry per message, in the same order.
 */
export function messageRuns(messages: readonly Message[]): MessageRun[] {
  const joined = (a: Message | undefined, b: Message | undefined) =>
    Boolean(a && b) &&
    a!.sender._id === b!.sender._id &&
    Math.abs(new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime()) <= RUN_BREAK_MS &&
    // A date separator sits between days, so a run never crosses one.
    dayKey(a!.createdAt) === dayKey(b!.createdAt);
  return messages.map((message, i) => ({
    first: !joined(messages[i - 1], message),
    last: !joined(message, messages[i + 1]),
  }));
}

/** The calendar day a message was sent on, in the device's time zone ("2026-9-18"). */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export type DayLabel =
  | { kind: "today" }
  | { kind: "yesterday" }
  /** Earlier this week: the weekday's name. */
  | { kind: "weekday" }
  /** Older: the date, with the year only when it isn't this year. */
  | { kind: "date"; withYear: boolean };

/** How a day separator names its day, WhatsApp-style. */
export function dayLabel(iso: string, now: Date): DayLabel {
  const date = new Date(iso);
  const startOf = (daysAgo: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo).getTime();
  const time = date.getTime();
  if (time >= startOf(0)) return { kind: "today" };
  if (time >= startOf(1)) return { kind: "yesterday" };
  if (time >= startOf(6)) return { kind: "weekday" };
  return { kind: "date", withYear: date.getFullYear() !== now.getFullYear() };
}

export type ChatRow =
  | { kind: "day"; key: string; iso: string }
  | { kind: "message"; key: string; message: Message; first: boolean; last: boolean };

/**
 * The chat's rows, oldest first: each day's messages behind a separator
 * naming the day, and each message marked with where it falls in its run.
 */
export function chatRows(messages: readonly Message[]): ChatRow[] {
  const runs = messageRuns(messages);
  const rows: ChatRow[] = [];
  let currentDay: string | null = null;
  messages.forEach((message, i) => {
    const day = dayKey(message.createdAt);
    if (day !== currentDay) {
      rows.push({ kind: "day", key: `day:${day}`, iso: message.createdAt });
      currentDay = day;
    }
    rows.push({ kind: "message", key: message._id, message, first: runs[i].first, last: runs[i].last });
  });
  return rows;
}

/**
 * A day as a heading: the caller's words for today and yesterday, the
 * weekday within the last week, then the date (with the year only when it
 * isn't this year) — shared by chat separators and the Activity page.
 */
export function dayHeading(iso: string, now: Date, locale: string | undefined, words: { today: string; yesterday: string }): string {
  const label = dayLabel(iso, now);
  const date = new Date(iso);
  switch (label.kind) {
    case "today":
      return words.today;
    case "yesterday":
      return words.yesterday;
    case "weekday":
      return date.toLocaleDateString(locale, { weekday: "long" });
    default:
      return date.toLocaleDateString(locale, { day: "numeric", month: "long", ...(label.withYear ? { year: "numeric" } : {}) });
  }
}
