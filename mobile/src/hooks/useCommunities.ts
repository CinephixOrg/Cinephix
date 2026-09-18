import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import {
  cachedGroup,
  communitiesSnapshot,
  isCommunitiesStale,
  refreshCommunities,
  refreshGroup,
  setCommunitiesOwner,
  subscribeCommunities,
} from "../api/communitiesStore";
import type { Group } from "../types";

/**
 * Every community, cached across screens (communitiesStore.ts). Renders the
 * cached list straight away and refreshes it in the background when it's
 * old. `failed` is only set when there's nothing cached to show instead.
 */
export function useCommunities() {
  const { user } = useAuth();
  setCommunitiesOwner(user?._id);
  const groups = useSyncExternalStore(subscribeCommunities, communitiesSnapshot);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // On every visit, not just the first: coming back from a community's page
  // after a while refreshes the list, while a quick back-and-forth doesn't.
  useFocusEffect(
    useCallback(() => {
      if (!isCommunitiesStale()) return;
      refreshCommunities()
        .then(() => setFailed(false))
        .catch(() => setFailed(communitiesSnapshot() === null));
    }, [user?._id])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCommunities();
      setFailed(false);
    } catch {
      setFailed(communitiesSnapshot() === null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { groups, failed, refreshing, refresh };
}

/**
 * One community: the cached copy (from the list, when it has loaded) on the
 * first frame, then the server's. `failed` is only set when there's no copy
 * to show.
 */
export function useCommunity(slug: string) {
  const { user } = useAuth();
  setCommunitiesOwner(user?._id);
  const getSnapshot = useCallback(() => cachedGroup(slug), [slug]);
  const group: Group | undefined = useSyncExternalStore(subscribeCommunities, getSnapshot);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    setFailed(false);
    refreshGroup(slug).catch(() => setFailed(cachedGroup(slug) === undefined));
  }, [slug]);

  useEffect(reload, [reload, user?._id]);

  return { group, failed, reload };
}
