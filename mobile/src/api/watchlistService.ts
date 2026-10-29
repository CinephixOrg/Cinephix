import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, CurrentlyWatching, NewlyEarnedBadge, WatchlistItem } from "../types";

// Watchlist responses are raw { message, watchlist } / { message } — no
// success/data envelope — so client.ts's unwrap interceptor leaves them
// untouched and we read res.data.watchlist directly here.

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const res = await API.get(API_ROUTES.WATCHLIST.GET);
  return res.data.watchlist;
}

// This add is the one real place a genre badge can be newly earned (see
// NewlyEarnedBadge's own comment on why it's here and not rateContent) —
// the full response is returned now, not just the watchlist array, so
// callers can report it to BadgeEarnedContext.
// `currentlyWatching` reflects the backend's own auto-clear (this same
// item leaving "Currently Watching" the moment it's marked watched) — see
// userWatchlistRoute.js's own comment on that hook. Always present (null
// when nothing was cleared), so callers can unconditionally sync it into
// AuthContext without checking whether a clear actually happened.
export async function addToWatchlist(
  itemId: string,
  itemType: ContentType
): Promise<{ watchlist: WatchlistItem[]; newlyEarnedBadges: NewlyEarnedBadge[]; currentlyWatching: CurrentlyWatching | null }> {
  const res = await API.post(API_ROUTES.WATCHLIST.ADD, { itemId, itemType });
  return {
    watchlist: res.data.watchlist,
    newlyEarnedBadges: res.data.newlyEarnedBadges ?? [],
    currentlyWatching: res.data.currentlyWatching ?? null,
  };
}

// TC-133's onboarding wizard is the only real caller — writes to BOTH the
// Watched List and Favorites server-side (direct product decision: a title
// picked during onboarding, whether from the suggested grid or the user's
// own search, counts as a favorite too), unlike the singular addToWatchlist
// above which only ever touches the Watched List. One request for the
// whole batch, not addToWatchlist called N times — see the backend route's
// own comment on why (one CineGraph rebuild instead of N, and badge
// thresholds a multi-item jump can skip clean over with N separate calls).
export async function addToWatchlistBulk(
  items: { itemId: string; itemType: ContentType }[]
): Promise<{
  watchlist: WatchlistItem[];
  favoriteMovies: string[];
  favoriteSeries: string[];
  addedCount: number;
  skippedCount: number;
  newlyEarnedBadges: NewlyEarnedBadge[];
  currentlyWatching: CurrentlyWatching | null;
}> {
  const res = await API.post(API_ROUTES.WATCHLIST.BULK_ADD, { items });
  return {
    watchlist: res.data.watchlist,
    favoriteMovies: res.data.favoriteMovies ?? [],
    favoriteSeries: res.data.favoriteSeries ?? [],
    addedCount: res.data.addedCount ?? 0,
    skippedCount: res.data.skippedCount ?? 0,
    newlyEarnedBadges: res.data.newlyEarnedBadges ?? [],
    currentlyWatching: res.data.currentlyWatching ?? null,
  };
}

export async function removeFromWatchlist(
  itemId: string,
  itemType: ContentType
): Promise<WatchlistItem[]> {
  const res = await API.delete(API_ROUTES.WATCHLIST.REMOVE(itemId, itemType));
  return res.data.watchlist;
}
