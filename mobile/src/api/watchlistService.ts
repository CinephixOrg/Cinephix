import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, NewlyEarnedBadge, WatchlistItem } from "../types";

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
export async function addToWatchlist(
  itemId: string,
  itemType: ContentType
): Promise<{ watchlist: WatchlistItem[]; newlyEarnedBadges: NewlyEarnedBadge[] }> {
  const res = await API.post(API_ROUTES.WATCHLIST.ADD, { itemId, itemType });
  return { watchlist: res.data.watchlist, newlyEarnedBadges: res.data.newlyEarnedBadges ?? [] };
}

export async function removeFromWatchlist(
  itemId: string,
  itemType: ContentType
): Promise<WatchlistItem[]> {
  const res = await API.delete(API_ROUTES.WATCHLIST.REMOVE(itemId, itemType));
  return res.data.watchlist;
}
