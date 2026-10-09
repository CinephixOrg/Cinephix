// When a signed-in person was last active, kept without a database write on
// every request: services/lastActive.js writes it at most once per interval.
// Pure, so tested without a database (lastActive.test.js).

/** How stale lastActiveAt may get: one write per user per five minutes at most. */
export const LAST_ACTIVE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Whether it's time to record activity again: nothing recorded yet, or the
 * last record (the database's lastActiveAt or this server's own last write,
 * whichever is later) is at least an interval old.
 */
export function lastActiveDue(lastMs, now = new Date(), intervalMs = LAST_ACTIVE_INTERVAL_MS) {
  if (!Number.isFinite(lastMs) || lastMs <= 0) return true;
  return now.getTime() - lastMs >= intervalMs;
}
