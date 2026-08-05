import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, WatchlistItem } from "../types";

// Watchlist responses are raw { message, watchlist } / { message } — no
// success/data envelope — so client.ts's unwrap interceptor leaves them
// untouched and we read res.data.watchlist directly here.

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const res = await API.get(API_ROUTES.WATCHLIST.GET);
  return res.data.watchlist;
}

export async function addToWatchlist(
  itemId: string,
  itemType: ContentType
): Promise<WatchlistItem[]> {
  const res = await API.post(API_ROUTES.WATCHLIST.ADD, { itemId, itemType });
  return res.data.watchlist;
}

export async function removeFromWatchlist(
  itemId: string,
  itemType: ContentType
): Promise<WatchlistItem[]> {
  const res = await API.delete(API_ROUTES.WATCHLIST.REMOVE(itemId, itemType));
  return res.data.watchlist;
}
