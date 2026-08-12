import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { getFollowing, getSentRequests } from "../api/userService";
import type { FollowActionType } from "../types";

interface FollowGraphContextValue {
  followingIds: Set<string>;
  sentRequestIds: Set<string>;
  ensureLoaded: () => void;
  refresh: () => Promise<void>;
  applyFollow: (targetId: string, type: FollowActionType) => void;
  applyUnfollow: (targetId: string) => void;
}

const FollowGraphContext = createContext<FollowGraphContextValue | undefined>(undefined);

// App-wide "who do I follow / who have I sent a request to" membership set,
// backing every unseeded FollowButton (Network rows, Suggestions) so acting
// in one place (e.g. Suggestions) is reflected everywhere else (e.g.
// Network) without a refetch. limit=1000 mirrors web's own pragmatic
// shortcut for "just get me the membership set" — there's no dedicated
// IDs-only endpoint on the backend.
export function FollowGraphProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());
  const loadedRef = useRef(false);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    loadingRef.current = true;
    try {
      const [followingRes, sentIds] = await Promise.all([
        getFollowing(1, 1000),
        getSentRequests(),
      ]);
      setFollowingIds(new Set(followingRes.items.map((u) => u._id)));
      setSentRequestIds(new Set(sentIds));
      loadedRef.current = true;
    } finally {
      loadingRef.current = false;
    }
  }, [user?._id]);

  const ensureLoaded = useCallback(() => {
    if (loadedRef.current || loadingRef.current) return;
    refresh();
  }, [refresh]);

  const applyFollow = useCallback((targetId: string, type: FollowActionType) => {
    if (type === "following") {
      setFollowingIds((prev) => new Set(prev).add(targetId));
      setSentRequestIds((prev) => {
        if (!prev.has(targetId)) return prev;
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    } else {
      setSentRequestIds((prev) => new Set(prev).add(targetId));
    }
  }, []);

  const applyUnfollow = useCallback((targetId: string) => {
    setFollowingIds((prev) => {
      if (!prev.has(targetId)) return prev;
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
    setSentRequestIds((prev) => {
      if (!prev.has(targetId)) return prev;
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  }, []);

  return (
    <FollowGraphContext.Provider
      value={{ followingIds, sentRequestIds, ensureLoaded, refresh, applyFollow, applyUnfollow }}
    >
      {children}
    </FollowGraphContext.Provider>
  );
}

export function useFollowGraph() {
  const ctx = useContext(FollowGraphContext);
  if (!ctx) throw new Error("useFollowGraph must be used within a FollowGraphProvider");
  return ctx;
}
