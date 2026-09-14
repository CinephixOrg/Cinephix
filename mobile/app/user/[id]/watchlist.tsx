import PublicCollectionScreen from "../../../src/screens/PublicCollectionScreen";

// This profile's Watchlist, read-only, opened from its drawer.
export default function UserWatchlistRoute() {
  return <PublicCollectionScreen kind="watchlist" />;
}
