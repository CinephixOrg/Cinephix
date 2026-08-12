import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useFollowGraph } from "../context/FollowGraphContext";
import { useToast } from "../context/ToastContext";
import { followTargetUser, unfollowTargetUser } from "../api/userService";
import type { FollowStatus } from "../types";

interface Options {
  // Pass this when the caller already knows the exact status (e.g. Public
  // Profile, which gets it straight from the profile payload — no extra
  // network call needed). Omit it for rows that should stay reactive to the
  // shared FollowGraphContext (Network list rows, Suggestions).
  initialStatus?: FollowStatus;
}

export function useFollowState(targetUserId: string, options?: Options) {
  const { user } = useAuth();
  const graph = useFollowGraph();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const seeded = options?.initialStatus !== undefined;
  const isSelf = !!user && targetUserId === user._id;

  const deriveFromGraph = useCallback((): FollowStatus => {
    if (graph.followingIds.has(targetUserId)) return "following";
    if (graph.sentRequestIds.has(targetUserId)) return "requested";
    return "not-following";
  }, [graph.followingIds, graph.sentRequestIds, targetUserId]);

  const [localStatus, setLocalStatus] = useState<FollowStatus>(
    () => options?.initialStatus ?? deriveFromGraph()
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seeded) graph.ensureLoaded();
  }, [seeded]);

  // Only unseeded rows track the shared graph — a seeded instance's own
  // follow()/unfollow() result must stay authoritative, not get overwritten
  // back to a stale seed on the next graph-derived render.
  useEffect(() => {
    if (!seeded) setLocalStatus(deriveFromGraph());
  }, [seeded, deriveFromGraph]);

  const follow = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const { type } = await followTargetUser(targetUserId);
      setLocalStatus(type);
      graph.applyFollow(targetUserId, type);
    } catch (e: any) {
      const message = e?.response?.data?.message || t("Something went wrong. Please try again.");
      setError(message);
      showToast(message);
    } finally {
      setPending(false);
    }
  }, [targetUserId, graph]);

  const unfollow = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      await unfollowTargetUser(targetUserId);
      setLocalStatus("not-following");
      graph.applyUnfollow(targetUserId);
    } catch (e: any) {
      const message = e?.response?.data?.message || t("Something went wrong. Please try again.");
      setError(message);
      showToast(message);
    } finally {
      setPending(false);
    }
  }, [targetUserId, graph]);

  return {
    status: isSelf ? ("self" as const) : localStatus,
    pending,
    error,
    follow,
    unfollow,
    // Same call as unfollow — cancelling a sent request has no dedicated endpoint.
    cancelRequest: unfollow,
  };
}
