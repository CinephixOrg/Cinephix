import { useCallback } from "react";
import { toWatchCache } from "../api/collectionCache";
import { WATCHLIST_SORT_GROUPS } from "../components/collection/filterLabels";
import { useWatchlistGraph } from "../context/WatchlistGraphContext";
import type { CollectionEntry } from "../utils/collectionQuery";
import CollectionScreen, { type CollectionConfig } from "./CollectionScreen";

const WATCHLIST: CollectionConfig = {
  cache: toWatchCache,
  basePath: "/to-watch",
  sortGroups: WATCHLIST_SORT_GROUPS,
  // Nothing here has been watched, so nothing here has a rating.
  showRatedFilter: false,
  // "What should I watch next?" polls only make sense against titles the
  // viewer has actually queued — the Watched List's own config leaves this
  // unset.
  allowPoll: true,
  strings: {
    searchPlaceholder: "Search your watchlist",
    removed: "Removed from your watchlist",
    loadFailed: "Failed to load watchlist.",
    emptyTitle: "Your watchlist is empty.",
    emptyText: "Titles you add to your watchlist will appear here.",
  },
};

// The Watchlist (the to-watch queue, route: /to-watch). A sibling of the
// Watched List built on the same screen.
export default function WatchlistScreen() {
  // replaceAll is a stable callback; the context value object around it isn't.
  const { replaceAll } = useWatchlistGraph();
  // Keeps the app-wide "is this in my Watchlist" set (ShareCard's "+" buttons)
  // in step with what this screen shows, including removals and undos.
  const syncWatchlistGraph = useCallback(
    (entries: CollectionEntry[]) => replaceAll(entries.map((entry) => ({ itemId: entry.id, itemType: entry.type }))),
    [replaceAll]
  );
  return <CollectionScreen config={WATCHLIST} onEntriesChange={syncWatchlistGraph} />;
}
