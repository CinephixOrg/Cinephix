import { createLruCache } from "../utils/cache";
import type { Connection } from "../types";

export interface ConnectionsPage {
  items: Connection[];
  hasMore: boolean;
  counts?: { followers: number; following: number };
}

// Keyed by whose list and which list, so a user's followers and following
// don't evict each other and two people's lists coexist.
const pages = createLruCache<ConnectionsPage>(24);

const key = (userId: string, tab: "followers" | "following") => `${userId}:${tab}`;

export function getCachedConnections(userId: string, tab: "followers" | "following"): ConnectionsPage | undefined {
  return pages.get(key(userId, tab));
}

export function setCachedConnections(
  userId: string,
  tab: "followers" | "following",
  page: ConnectionsPage
) {
  pages.set(key(userId, tab), page);
}

// Following or unfollowing from anywhere changes both lists' membership and
// their counts, so the cached first pages are wrong rather than merely old.
export function invalidateConnections(userId: string) {
  pages.delete(key(userId, "followers"));
  pages.delete(key(userId, "following"));
}

/** All cached pages, e.g. on sign-out. */
export function clearConnections() {
  pages.clear();
}
