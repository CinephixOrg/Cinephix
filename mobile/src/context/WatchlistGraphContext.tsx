import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { getToWatchList } from "../api/toWatchService";
import type { ContentType, WatchlistItem } from "../types";

function itemKey(itemId: string, itemType: ContentType) {
  return `${itemType}:${itemId}`;
}

interface WatchlistGraphContextValue {
  itemIds: Set<string>;
  ensureLoaded: () => void;
  applyAdd: (itemId: string, itemType: ContentType) => void;
  applyRemove: (itemId: string, itemType: ContentType) => void;
  // ToWatchListView.tsx already refetches the full list on every screen
  // focus (its own `load()`) — reusing that same result to keep this
  // shared set authoritative too, rather than a second independent fetch.
  replaceAll: (items: WatchlistItem[]) => void;
}

const WatchlistGraphContext = createContext<WatchlistGraphContextValue | undefined>(undefined);

// App-wide "what's already in my Watchlist (the to-watch queue)" membership
// set — same shared-Set-in-a-context shape as FollowGraphContext.tsx, built
// for the identical reason: ShareCard.tsx's recommendation posts each own a
// local "did I add this" flag with no way to know the *real* watchlist
// state, so adding a title from one post left every other already-mounted
// post recommending that same title still showing its own "+" — tapping it
// there hit the backend's own duplicate-add rejection and surfaced as a
// confusing "something went wrong". Acting on any one card now updates this
// shared set, which every other card reads from directly.
export function WatchlistGraphProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [itemIds, setItemIds] = useState<Set<string>>(new Set());
  const loadedRef = useRef(false);
  const loadingRef = useRef(false);

  const ensureLoaded = useCallback(() => {
    if (loadedRef.current || loadingRef.current || !user) return;
    loadingRef.current = true;
    getToWatchList()
      .then((items) => {
        setItemIds(new Set(items.map((w) => itemKey(w.itemId, w.itemType))));
        loadedRef.current = true;
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false;
      });
  }, [user?._id]);

  const applyAdd = useCallback((itemId: string, itemType: ContentType) => {
    setItemIds((prev) => {
      const k = itemKey(itemId, itemType);
      if (prev.has(k)) return prev;
      return new Set(prev).add(k);
    });
  }, []);

  const applyRemove = useCallback((itemId: string, itemType: ContentType) => {
    setItemIds((prev) => {
      const k = itemKey(itemId, itemType);
      if (!prev.has(k)) return prev;
      const next = new Set(prev);
      next.delete(k);
      return next;
    });
  }, []);

  const replaceAll = useCallback((items: WatchlistItem[]) => {
    setItemIds(new Set(items.map((w) => itemKey(w.itemId, w.itemType))));
    loadedRef.current = true;
  }, []);

  return (
    <WatchlistGraphContext.Provider value={{ itemIds, ensureLoaded, applyAdd, applyRemove, replaceAll }}>
      {children}
    </WatchlistGraphContext.Provider>
  );
}

export function useWatchlistGraph() {
  const ctx = useContext(WatchlistGraphContext);
  if (!ctx) throw new Error("useWatchlistGraph must be used within a WatchlistGraphProvider");
  return ctx;
}

export function isInWatchlistGraph(itemIds: Set<string>, itemId: string, itemType: ContentType) {
  return itemIds.has(itemKey(itemId, itemType));
}
