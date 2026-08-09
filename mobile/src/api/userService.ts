import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { CineGraphData, Connection, Pagination, UserProfile, UserSearchResult } from "../types";
import type { ListResult } from "./contentService";

// GET /users/profile/:id is NOT wrapped in the {success,data} envelope
// (raw JSON on both the authorized and masked branches) — same quirk as
// watchlist. client.ts's unwrap interceptor only fires when
// res.data.success !== undefined, so it leaves this response untouched and
// res.data already IS the profile object.
export async function getMyProfile(id: string): Promise<UserProfile> {
  const res = await API.get(API_ROUTES.USERS.GET_PROFILE(id));
  return res.data;
}

export async function getCineGraph(id: string): Promise<CineGraphData> {
  const res = await API.get(API_ROUTES.USERS.GET_CINEGRAPH(id));
  return res.data;
}

export async function updateBio(
  id: string,
  fields: { bio?: string; username?: string }
): Promise<UserProfile> {
  const res = await API.patch(API_ROUTES.USERS.UPDATE_BIO(id), fields);
  return res.data;
}

// imageUri: local file:// uri from expo-image-picker.
export async function uploadAvatar(id: string, imageUri: string): Promise<{ profilePicUrl: string }> {
  const formData = new FormData();
  formData.append("profilePic", {
    uri: imageUri,
    name: "profile.jpg",
    type: "image/jpeg",
  } as any);

  const res = await API.post(API_ROUTES.USERS.UPLOAD_AVATAR(id), formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function updatePassword(oldPassword: string, newPassword: string): Promise<void> {
  await API.put(API_ROUTES.USERS.UPDATE_PASSWORD, { oldPassword, newPassword });
}

export async function updateVisibility(visibility: "public" | "private"): Promise<void> {
  await API.patch(API_ROUTES.USERS.UPDATE_VISIBILITY, { visibility });
}

export async function deleteAccount(): Promise<void> {
  await API.delete(API_ROUTES.USERS.DELETE_ACCOUNT);
}

interface ConnectionsResult {
  items: Connection[];
  pagination?: Pagination;
}

export async function getFollowing(page = 1, limit = 20): Promise<ConnectionsResult> {
  const res = await API.get(API_ROUTES.USERS.GET_FOLLOWING, { params: { page, limit } });
  return { items: res.data, pagination: (res as any).pagination };
}

export async function getFollowers(page = 1, limit = 20): Promise<ConnectionsResult> {
  const res = await API.get(API_ROUTES.USERS.GET_FOLLOWERS, { params: { page, limit } });
  return { items: res.data, pagination: (res as any).pagination };
}

export async function searchUsers(
  query: string,
  page = 1,
  limit = 20
): Promise<ListResult<UserSearchResult>> {
  const res = await API.get(API_ROUTES.USERS.SEARCH, { params: { query, page, limit } });
  return { items: res.data, pagination: (res as any).pagination };
}
