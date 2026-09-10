import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, CustomList, CustomListDetail, DiscoverListItem } from "../types";

// Reads res.data.lists / res.data.list directly rather than relying on the
// generic envelope-unwrap — works the same whether or not this endpoint
// happens to be sendSuccess-wrapped, same defensive pattern as
// watchlistService.ts.

export async function getMyLists(): Promise<CustomList[]> {
  const res = await API.get(API_ROUTES.LISTS.GET_MY_LISTS);
  return res.data.lists;
}

export async function createList(fields: {
  name: string;
  description?: string;
  isPublic?: boolean;
}): Promise<CustomList> {
  const res = await API.post(API_ROUTES.LISTS.CREATE, fields);
  return res.data.list;
}

export async function getListById(
  id: string
): Promise<{ list: CustomListDetail; isOwner: boolean; hasLiked: boolean }> {
  const res = await API.get(API_ROUTES.LISTS.GET_BY_ID(id));
  return { list: res.data.list, isOwner: res.data.isOwner, hasLiked: res.data.hasLiked };
}

export async function updateList(
  id: string,
  fields: { name?: string; description?: string; isPublic?: boolean }
): Promise<CustomList> {
  const res = await API.patch(API_ROUTES.LISTS.UPDATE(id), fields);
  return res.data.list;
}

export async function deleteList(id: string): Promise<void> {
  await API.delete(API_ROUTES.LISTS.DELETE(id));
}

export async function reorderLists(orderedIds: string[]): Promise<void> {
  await API.patch(API_ROUTES.LISTS.REORDER, { orderedIds });
}

export async function addItem(
  id: string,
  itemId: string,
  itemType: ContentType
): Promise<CustomList> {
  const res = await API.post(API_ROUTES.LISTS.ADD_ITEM(id), { itemId, itemType });
  return res.data.list;
}

export async function removeItem(
  id: string,
  itemId: string,
  itemType: ContentType
): Promise<CustomList> {
  const res = await API.delete(API_ROUTES.LISTS.REMOVE_ITEM(id, itemId, itemType));
  return res.data.list;
}

export async function discoverLists(limit = 20): Promise<DiscoverListItem[]> {
  const res = await API.get(API_ROUTES.LISTS.DISCOVER, { params: { limit } });
  return res.data.lists;
}

export type ListSort = "liked" | "items" | "newest";
export type ListMode = "all" | "friends" | "liked";

export async function getPopularLists(limit = 20, q?: string, sort?: ListSort): Promise<DiscoverListItem[]> {
  const res = await API.get(API_ROUTES.LISTS.POPULAR, { params: { limit, q, sort } });
  return res.data.lists;
}

// Same endpoint as getPopularLists, but a real paginated browse rather than
// a fixed "top N" — the backend now returns `page`/`hasMore` alongside
// `lists` regardless of caller, this just also reads them. Kept as a
// separate function instead of adding a `page` param to getPopularLists
// itself: that one's 3 existing callers (Home's Keşfet/Lists rails) want a
// bare array and a fixed count, not a page to manage — Search's own infinite
// scroll and Discover's own Popular Lists "See all" filter page are the
// only callers that need this shape. `mode` is the same All/Friends/Liked
// filter reviewController.js's getReviewsFeed also now supports.
export async function getPopularListsPaginated(
  page = 1,
  limit = 20,
  q?: string,
  sort?: ListSort,
  mode?: ListMode
): Promise<{ items: DiscoverListItem[]; page: number; hasMore: boolean }> {
  const res = await API.get(API_ROUTES.LISTS.POPULAR, { params: { page, limit, q, sort, mode } });
  return { items: res.data.lists, page: res.data.page, hasMore: res.data.hasMore };
}

export async function toggleListLike(id: string): Promise<{ likeCount: number; hasLiked: boolean }> {
  const res = await API.post(API_ROUTES.LISTS.TOGGLE_LIKE(id));
  return res.data;
}

export async function getListsForContent(
  contentType: ContentType,
  contentId: string,
  page = 1,
  limit = 20
): Promise<{ lists: DiscoverListItem[]; page: number; hasMore: boolean }> {
  const res = await API.get(API_ROUTES.LISTS.FOR_CONTENT(contentType, contentId), { params: { page, limit } });
  return res.data;
}
