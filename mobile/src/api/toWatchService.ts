import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, WatchlistItem } from "../types";

// Same raw { message, toWatchList } / { message } shape as watchlistService —
// no success/data envelope, and note the different response field name
// (toWatchList, not watchlist).

export async function getToWatchList(): Promise<WatchlistItem[]> {
  const res = await API.get(API_ROUTES.TO_WATCH.GET);
  return res.data.toWatchList;
}

export async function addToToWatchList(
  itemId: string,
  itemType: ContentType
): Promise<WatchlistItem[]> {
  const res = await API.post(API_ROUTES.TO_WATCH.ADD, { itemId, itemType });
  return res.data.toWatchList;
}

export async function removeFromToWatchList(
  itemId: string,
  itemType: ContentType
): Promise<WatchlistItem[]> {
  const res = await API.delete(API_ROUTES.TO_WATCH.REMOVE(itemId, itemType));
  return res.data.toWatchList;
}
