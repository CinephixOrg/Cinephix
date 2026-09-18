import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import {
  ACTIVITY_FRESH_MS,
  cachedActivity,
  fetchActivityPage,
  rememberActivity,
  setActivityOwner,
  type ActivityFeed,
} from "../api/personalActivityCache";
import { activityQueryKey, appendActivity, mergeFreshActivity, type ActivityFilters } from "../utils/personalActivity";

const EMPTY: ActivityFeed = { items: [], page: 0, hasMore: false, fetchedAt: 0 };

/**
 * Your activity for the given filters: the cached feed on the first frame
 * (so switching filters back and forth is instant), refreshed in the
 * background when it's older than a few seconds, with paging and
 * pull-to-refresh. `loading` is only true when there's nothing to show yet.
 */
export function useMyActivity(filters: ActivityFilters) {
  const { user } = useAuth();
  setActivityOwner(user?._id);
  const key = activityQueryKey(filters);
  const [feed, setFeed] = useState<ActivityFeed>(() => cachedActivity(filters) ?? EMPTY);
  const [loading, setLoading] = useState(() => !cachedActivity(filters));
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // A filter change swaps in that feed's cache in the same render as the
  // change itself (not an effect later), so the screen's layout animation
  // carries the swap instead of the list snapping a frame after it.
  // Keyed by account too: a different sign-in must not keep the last one's feed.
  const viewKey = `${user?._id ?? ""}|${key}`;
  const [shownKey, setShownKey] = useState(viewKey);
  if (shownKey !== viewKey) {
    const cached = cachedActivity(filters);
    setShownKey(viewKey);
    setFeed(cached ?? EMPTY);
    setLoading(!cached);
    setFailed(false);
  }
  // Which feed the screen is showing now, so an answer for filters the user
  // has already moved on from is dropped.
  const keyRef = useRef(key);
  keyRef.current = key;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const commit = useCallback((forKey: string, next: ActivityFeed) => {
    rememberActivity(filtersRef.current, next);
    if (keyRef.current === forKey) setFeed(next);
  }, []);

  const refresh = useCallback(async () => {
    const forKey = keyRef.current;
    const forFilters = filtersRef.current;
    try {
      const { items, hasMore } = await fetchActivityPage(forFilters, 1);
      if (keyRef.current !== forKey) return;
      const current = cachedActivity(forFilters) ?? EMPTY;
      const merged = mergeFreshActivity(current.items, items, hasMore);
      const fetchedAt = Date.now();
      if (merged === current.items) {
        // Nothing changed: same items, same paging, just fresher.
        commit(forKey, { ...current, fetchedAt });
      } else if (!hasMore || current.page <= 1) {
        // The fresh page is the whole feed, or all that was loaded anyway.
        commit(forKey, { items: merged, page: 1, hasMore, fetchedAt });
      } else {
        // Older pages kept below the fresh one: their paging still applies.
        commit(forKey, { items: merged, page: current.page, hasMore: current.hasMore, fetchedAt });
      }
      setFailed(false);
    } catch {
      if (keyRef.current === forKey) setFailed(!cachedActivity(forFilters));
    } finally {
      if (keyRef.current === forKey) setLoading(false);
    }
  }, [commit]);

  // Each feed refreshes when it's shown, if stale (or there was none).
  useEffect(() => {
    const cached = cachedActivity(filters);
    if (!cached || Date.now() - cached.fetchedAt > ACTIVITY_FRESH_MS) refresh();
    // `filters` is represented by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user?._id, refresh]);

  // Coming back to the page picks up what you've done since.
  useFocusEffect(
    useCallback(() => {
      const cached = cachedActivity(filtersRef.current);
      if (cached && Date.now() - cached.fetchedAt > ACTIVITY_FRESH_MS) refresh();
    }, [refresh])
  );

  const pullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const loadMore = useCallback(async () => {
    const current = cachedActivity(filtersRef.current);
    if (!current || !current.hasMore || loadingMore) return;
    const forKey = keyRef.current;
    setLoadingMore(true);
    try {
      const { items, hasMore } = await fetchActivityPage(filtersRef.current, current.page + 1);
      if (keyRef.current !== forKey) return;
      const latest = cachedActivity(filtersRef.current) ?? current;
      commit(forKey, { items: appendActivity(latest.items, items), page: latest.page + 1, hasMore, fetchedAt: latest.fetchedAt });
    } catch {
      // Scrolling to the end again retries.
    } finally {
      setLoadingMore(false);
    }
  }, [commit, loadingMore]);

  return { items: feed.items, hasMore: feed.hasMore, loading, failed, refreshing, loadingMore, refresh: pullToRefresh, retry: refresh, loadMore };
}
