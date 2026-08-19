import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type {
  AccountTier,
  CineGraphData,
  Connection,
  FeedUserRef,
  FollowActionType,
  FollowRequestUser,
  GenreDetailData,
  Pagination,
  ProfileAnalysis,
  ProfileAnalysisHistoryEntry,
  PublicProfile,
  SuggestedUser,
  UserProfile,
  UserSearchResult,
} from "../types";
import type { ListResult } from "./contentService";

// GET /users/profile/:id is NOT wrapped in the {success,data} envelope
// (raw JSON on both the authorized and masked branches) — same quirk as
// watchlist. client.ts's unwrap interceptor only fires when
// res.data.success !== undefined, so it leaves this response untouched and
// res.data already IS the profile object. Named getUserProfile (not
// getMyProfile) since it's called with any user's id, not just your own —
// the backend has no separate "my profile" route, this is the one endpoint.
export async function getUserProfile(id: string): Promise<PublicProfile> {
  const res = await API.get(API_ROUTES.USERS.GET_PROFILE(id));
  return res.data;
}

// No rate limit, no caching on the backend — regenerates (LLM or mock
// fallback) on every call, so this can take a few seconds.
export async function getProfileAnalysis(): Promise<ProfileAnalysis> {
  const res = await API.get(API_ROUTES.USERS.GET_PROFILE_ANALYSIS);
  return res.data;
}

// Pro/Premium/Dev only — the backend returns an empty array for Free rather
// than an error, so this never needs its own tier check on the client.
export async function getProfileAnalysisHistory(): Promise<ProfileAnalysisHistoryEntry[]> {
  const res = await API.get(API_ROUTES.USERS.GET_PROFILE_ANALYSIS_HISTORY);
  return res.data;
}

export async function getCineGraph(id: string): Promise<CineGraphData> {
  const res = await API.get(API_ROUTES.USERS.GET_CINEGRAPH(id));
  return res.data;
}

export async function getGenreDetail(
  id: string,
  type: "movie" | "series",
  genre: string
): Promise<GenreDetailData> {
  const res = await API.get(API_ROUTES.USERS.GET_GENRE_DETAIL(id, type, genre));
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

// DEV-ONLY: simulates a tier purchase by setting your own account tier
// directly. The backend route 404s outside development.
export async function setOwnAccountTier(tier: AccountTier): Promise<AccountTier> {
  const res = await API.patch(API_ROUTES.USERS.UPDATE_TIER, { tier });
  return res.data.accountTier;
}

export async function deleteAccount(): Promise<void> {
  await API.delete(API_ROUTES.USERS.DELETE_ACCOUNT);
}

interface ConnectionsResult {
  items: Connection[];
  pagination?: Pagination;
}

// userId omitted = your own list (axios drops undefined params, reproducing
// the previous own-list-only behavior exactly). Passing another user's id
// now requires the backend to authorize the view (private accounts you
// don't follow 403 instead of leaking the list).
export async function getFollowing(page = 1, limit = 20, userId?: string): Promise<ConnectionsResult> {
  const res = await API.get(API_ROUTES.USERS.GET_FOLLOWING, { params: { page, limit, userId } });
  return { items: res.data, pagination: (res as any).pagination };
}

export async function getFollowers(page = 1, limit = 20, userId?: string): Promise<ConnectionsResult> {
  const res = await API.get(API_ROUTES.USERS.GET_FOLLOWERS, { params: { page, limit, userId } });
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

// Standard {success,data:{type}} envelope, auto-unwrapped.
export async function followTargetUser(targetId: string): Promise<{ type: FollowActionType }> {
  const res = await API.post(API_ROUTES.USERS.FOLLOW, { targetId });
  return res.data;
}

// Standard envelope, data:null. Also cancels any pending sent request
// server-side — there's no dedicated "cancel request" endpoint, this is it.
export async function unfollowTargetUser(targetId: string): Promise<void> {
  await API.post(API_ROUTES.USERS.UNFOLLOW, { targetId });
}

// RAW {success,message} — no `data` key, NOT auto-unwrapped by client.ts.
export async function removeFollower(followerId: string): Promise<void> {
  await API.post(API_ROUTES.USERS.REMOVE_FOLLOWER, { followerId });
}

// RAW {success,message}. myUserId must be the CALLER's own id — the backend
// route is POST /users/:targetId/follow-request/accept where :targetId means
// "the target of this accept action", i.e. you, not the requester.
export async function acceptFollowRequest(myUserId: string, requesterId: string): Promise<void> {
  await API.post(API_ROUTES.USERS.ACCEPT_FOLLOW_REQUEST(myUserId), { requesterId });
}

export async function rejectFollowRequest(myUserId: string, requesterId: string): Promise<void> {
  await API.post(API_ROUTES.USERS.REJECT_FOLLOW_REQUEST(myUserId), { requesterId });
}

// RAW bare array (no envelope at all) of populated requester objects.
export async function getPendingRequests(): Promise<FollowRequestUser[]> {
  const res = await API.get(API_ROUTES.USERS.GET_PENDING_REQUESTS);
  return res.data;
}

// RAW bare array of target-id STRINGS (not populated objects).
export async function getSentRequests(): Promise<string[]> {
  const res = await API.get(API_ROUTES.USERS.GET_SENT_REQUESTS);
  return res.data;
}

export async function getSuggestions(limit = 5): Promise<SuggestedUser[]> {
  const res = await API.get(API_ROUTES.USERS.GET_SUGGESTIONS, { params: { limit } });
  return res.data;
}

// Currently-connected (Socket.io) users from the caller's own `following`
// list — backed by an in-memory presence map, not a persisted field.
export async function getOnlineFriends(): Promise<FeedUserRef[]> {
  const res = await API.get(API_ROUTES.USERS.GET_ONLINE_FRIENDS);
  return res.data;
}
