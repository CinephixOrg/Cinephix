import { watchedCache } from "../api/collectionCache";
import { WATCHED_SORT_GROUPS } from "../components/collection/filterLabels";
import CollectionScreen, { type CollectionConfig } from "./CollectionScreen";

const WATCHED_LIST: CollectionConfig = {
  cache: watchedCache,
  basePath: "/watchlist",
  sortGroups: WATCHED_SORT_GROUPS,
  showRatedFilter: true,
  strings: {
    searchPlaceholder: "Search your watched list",
    removed: "Removed from your watched list",
    loadFailed: "Failed to load watched list.",
    emptyTitle: "Your watched list is empty.",
    emptyText: "Titles you mark as watched will appear here.",
  },
};

// The Watched List (route: /watchlist — the route name predates the Watchlist
// feature, which lives at /to-watch).
export default function WatchedListScreen() {
  return <CollectionScreen config={WATCHED_LIST} />;
}
