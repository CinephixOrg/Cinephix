import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, Favorites } from "../types";

// Standard {success,data} envelope, auto-unwrapped by client.ts.
export async function getFavorites(id: string): Promise<Favorites> {
  const res = await API.get(API_ROUTES.USERS.GET_FAVORITES(id));
  return res.data;
}

// PUT /users/me/favorites is a full-array replace, not add/remove-single-item
// — callers must always submit the complete desired list of ids. Response is
// entirely RAW (res.json(list), no {success,data} envelope), but the caller
// already has the exact list it just saved, so there's nothing worth reading
// back — resolves void rather than re-parsing the raw echo.
export async function updateFavorites(type: ContentType, list: string[]): Promise<void> {
  await API.put(API_ROUTES.USERS.UPDATE_FAVORITES, { type, list });
}
