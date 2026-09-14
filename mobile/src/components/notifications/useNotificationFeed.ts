import { useSyncExternalStore } from "react";
import { bindFeedOwner, getFeed, subscribeFeeds, type FeedFilter, type FeedState } from "../../api/notificationFeedStore";

/**
 * One notification feed from the app-wide store: null until its first page
 * has loaded, then the cached list, updated in place by every action.
 */
export function useNotificationFeed(filter: FeedFilter, userId: string): FeedState | null {
  // Idempotent — it only resets the store when the signed-in account changed,
  // so a feed from the previous account can never render for this one.
  bindFeedOwner(userId);
  return useSyncExternalStore(subscribeFeeds, () => getFeed(filter));
}
