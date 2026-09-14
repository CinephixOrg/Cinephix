import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { getFollowing } from "../api/userService";

interface FollowGraphContextValue {
  followingIds: Set<string>;
  ensureLoaded: () => void;
  refresh: () => Promise<void>;
  applyFollow: (targetId: string) => void;
  applyUnfollow: (targetId: string) => void;
}

const FollowGraphContext = createContext<FollowGraphContextValue | undefined>(undefined);

// App-wide "who do I follow" membership set, backing every unseeded
// FollowButton (Network rows, Suggestions) so acting in one place (e.g.
// Suggestions) is reflected everywhere else (e.g. Network) without a refetch.
// limit=1000 mirrors web's own pragmatic shortcut for "just get me the
// membership set" — there's no dedicated IDs-only endpoint on the backend.
export function FollowGraphProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const loadedRef = useRef(false);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    loadingRef.current = true;
    try {
      const following = await getFollowing(1, 1000);
      setFollowingIds(new Set(following.items.map((u) => u._id)));
      loadedRef.current = true;
    } finally {
      loadingRef.current = false;
    }
  }, [user?._id]);

  const ensureLoaded = useCallback(() => {
    if (loadedRef.current || loadingRef.current) return;
    refresh();
  }, [refresh]);

  const applyFollow = useCallback((targetId: string) => {
    setFollowingIds((prev) => (prev.has(targetId) ? prev : new Set(prev).add(targetId)));
  }, []);

  const applyUnfollow = useCallback((targetId: string) => {
    setFollowingIds((prev) => {
      if (!prev.has(targetId)) return prev;
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ followingIds, ensureLoaded, refresh, applyFollow, applyUnfollow }),
    [followingIds, ensureLoaded, refresh, applyFollow, applyUnfollow]
  );

  return <FollowGraphContext.Provider value={value}>{children}</FollowGraphContext.Provider>;
}

export function useFollowGraph() {
  const ctx = useContext(FollowGraphContext);
  if (!ctx) throw new Error("useFollowGraph must be used within a FollowGraphProvider");
  return ctx;
}
