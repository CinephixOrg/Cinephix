import { useMemo, useSyncExternalStore } from "react";
import { blockedSnapshot, subscribeBlocked } from "../api/blockStore";
import { withoutBlocked } from "../utils/safety";

/** The ids of everyone you've blocked, kept current. */
export function useBlockedIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeBlocked, blockedSnapshot);
}

/**
 * The items not made by anyone you've blocked — a feed already on screen
 * loses a person's things the moment you block them, before any refetch.
 */
export function useWithoutBlocked<T>(items: readonly T[], authorOf: (item: T) => string | null | undefined): T[] {
  const blocked = useBlockedIds();
  // authorOf is expected to be a stable, module-level function.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => withoutBlocked(items, authorOf, blocked), [items, blocked]);
}
