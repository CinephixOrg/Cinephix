import API, { API_BASE_URL } from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import { withSenders } from "../utils/chatMessages";
import type {
  ContentType,
  Group,
  GroupAnnouncementCategory,
  GroupChallenge,
  GroupChallengeDetail,
  GroupLeaderboardEntry,
  GroupListSummary,
  GroupMember,
  GroupWatchParty,
  Message,
  MessagePagination,
  ProfileAnalysis,
} from "../types";

export async function getAllGroups(): Promise<Group[]> {
  const res = await API.get(API_ROUTES.GROUPS.GET_ALL);
  return res.data;
}

export async function getGroupBySlug(slug: string): Promise<Group> {
  const res = await API.get(API_ROUTES.GROUPS.GET_BY_SLUG(slug));
  return res.data;
}

export async function joinGroup(slug: string): Promise<void> {
  await API.post(API_ROUTES.GROUPS.JOIN(slug));
}

export async function leaveGroup(slug: string): Promise<void> {
  await API.post(API_ROUTES.GROUPS.LEAVE(slug));
}

export async function getGroupMembers(slug: string): Promise<GroupMember[]> {
  const res = await API.get(API_ROUTES.GROUPS.GET_MEMBERS(slug));
  // A member whose account has since been deleted comes back with no user.
  return ((res.data ?? []) as (GroupMember | { user: null })[]).filter((member): member is GroupMember => !!member.user);
}

// ── Partner-community admin actions — every one of these 403s server-side
// unless the caller is that group's own `owner`. ──────────────────────────

export async function updateGroupIdentity(
  slug: string,
  payload: Partial<{
    name: string;
    description: string;
    coverImage: string;
    accentColor: string | null;
    socialLinks: Partial<{ instagram: string | null; tiktok: string | null; youtube: string | null }>;
  }>
): Promise<Pick<Group, "name" | "description" | "accentColor" | "socialLinks"> & { coverImage: string }> {
  const res = await API.patch(API_ROUTES.GROUPS.UPDATE(slug), payload);
  return res.data;
}

// Opt-in to Discover's "Community Announcements" rail — GroupAnnouncement's
// own doc comment has the full picture. Same partial-update shape as
// updateGroupIdentity above.
export async function updateGroupFeedSettings(
  slug: string,
  payload: Partial<{ enabled: boolean; categories: GroupAnnouncementCategory[] }>
): Promise<{ feedAnnouncements: { enabled: boolean; categories: GroupAnnouncementCategory[] } }> {
  const res = await API.patch(API_ROUTES.GROUPS.UPDATE_FEED_SETTINGS(slug), payload);
  return res.data;
}

// Same multipart pattern as userService.ts's own uploadAvatar.
export async function uploadGroupCoverImage(slug: string, imageUri: string): Promise<{ coverImage: string }> {
  const formData = new FormData();
  formData.append("coverImage", { uri: imageUri, name: "cover.jpg", type: "image/jpeg" } as any);
  const res = await API.post(API_ROUTES.GROUPS.UPLOAD_COVER_IMAGE(slug), formData, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}

// Creates a brand-new list that belongs to the COMMUNITY, not the admin
// personally (CustomList.groupId's own comment) — persists as its own
// list regardless of whether it ends up featured on Overview (auto-added
// to the featured set only while there's still room, <3).
export async function createGroupList(
  slug: string,
  payload: { name: string; description?: string; isPublic?: boolean; items?: { itemId: string; itemType: ContentType }[]; allowMemberAdd?: boolean }
): Promise<void> {
  await API.post(API_ROUTES.GROUPS.CREATE_LIST(slug), payload);
}

// Every list this community has (not just the featured ones) — backs the
// "See all" page under Overview's Featured Lists rail.
export async function listGroupLists(slug: string): Promise<GroupListSummary[]> {
  const res = await API.get(API_ROUTES.GROUPS.LIST_LISTS(slug));
  return res.data;
}

// Replaces the whole featured set — up to 3 ids, every one already
// belonging to this community (listGroupLists's own isFeatured flag is
// what the mobile selection mode toggles before calling this once).
export async function setFeaturedLists(slug: string, listIds: string[]): Promise<void> {
  await API.patch(API_ROUTES.GROUPS.SET_FEATURED_LISTS(slug), { listIds });
}

// 2-5 titles, straight from the catalog — unlike Media's personal "what
// should I watch" poll, these don't need to already be on the admin's own
// Watchlist.
// Each item is either a catalog pick or the admin's own free text —
// direct ask: a community poll shouldn't be limited to "pick a title."
export type GroupPollItemInput = { contentId: string; contentType: ContentType } | { text: string };

// durationDays: the admin's own chosen lifespan, or null/omitted for "no end date".
export async function createGroupPoll(slug: string, items: GroupPollItemInput[], question?: string, durationDays?: number | null): Promise<void> {
  await API.post(API_ROUTES.GROUPS.CREATE_POLL(slug), { items, question, durationDays });
}

export async function createGroupChallenge(
  slug: string,
  payload: { title: string; items: { contentId: string; contentType: ContentType }[]; deadline: string }
): Promise<void> {
  await API.post(API_ROUTES.GROUPS.CREATE_CHALLENGE(slug), payload);
}

// null when the community has no active challenge.
export async function getGroupChallenge(slug: string): Promise<GroupChallenge | null> {
  const res = await API.get(API_ROUTES.GROUPS.GET_CHALLENGE(slug));
  return res.data;
}

// The same challenge, with every item and a per-member breakdown — backs
// the Challenge detail screen (CommunityHubTab's own card stays on the
// lighter getGroupChallenge above).
export async function getGroupChallengeDetail(slug: string): Promise<GroupChallengeDetail | null> {
  const res = await API.get(API_ROUTES.GROUPS.GET_CHALLENGE_DETAIL(slug));
  return res.data;
}

export async function getGroupLeaderboard(slug: string): Promise<{ leaderboard: GroupLeaderboardEntry[]; resetsAt: string }> {
  const res = await API.get(API_ROUTES.GROUPS.GET_LEADERBOARD(slug));
  return res.data;
}

// ── Watch parties — a community's own scheduled companion chat. ───────────

// Same fixed-menu convention as CreatePollScreen's own DURATION_OPTIONS —
// matches groupController.js's WATCH_PARTY_DURATION_OPTIONS (the backend
// validates against this exact list regardless of what the client sends).
export const WATCH_PARTY_DURATION_OPTIONS = [120, 240, 360, 480, 720];

export async function createWatchParty(
  slug: string,
  payload: { contentId: string; contentType: ContentType; scheduledAt: string; durationMinutes?: number }
): Promise<GroupWatchParty> {
  const res = await API.post(API_ROUTES.GROUPS.CREATE_WATCH_PARTY(slug), payload);
  return res.data;
}

export async function listWatchParties(slug: string): Promise<{ upcoming: GroupWatchParty[]; past: GroupWatchParty[] }> {
  const res = await API.get(API_ROUTES.GROUPS.LIST_WATCH_PARTIES(slug));
  return res.data;
}

export async function getWatchParty(slug: string, id: string): Promise<GroupWatchParty> {
  const res = await API.get(API_ROUTES.GROUPS.GET_WATCH_PARTY(slug, id));
  return res.data;
}

export async function toggleWatchPartyRsvp(slug: string, id: string): Promise<{ isRsvped: boolean; rsvpCount: number }> {
  const res = await API.post(API_ROUTES.GROUPS.RSVP_WATCH_PARTY(slug, id));
  return res.data;
}

export async function getWatchPartyMessages(
  slug: string,
  id: string,
  before?: string,
  limit = 50
): Promise<{ items: Message[]; pagination: MessagePagination }> {
  const res = await API.get(API_ROUTES.GROUPS.GET_WATCH_PARTY_MESSAGES(slug, id), { params: { before, limit } });
  return { items: withSenders(res.data), pagination: (res as any).pagination };
}

// Slug-free twin of the above — chatCache.ts's fetchFirstPage only ever has
// a room's bare id (its cache key carries no slug), so it needs a fetch
// that works from that alone.
export async function getWatchPartyMessagesById(id: string, before?: string, limit = 50): Promise<{ items: Message[]; pagination: MessagePagination }> {
  const res = await API.get(API_ROUTES.GROUPS.GET_WATCH_PARTY_MESSAGES_BY_ID(id), { params: { before, limit } });
  return { items: withSenders(res.data), pagination: (res as any).pagination };
}

export async function sendWatchPartyMessageRest(slug: string, id: string, text: string): Promise<Message> {
  const res = await API.post(API_ROUTES.GROUPS.SEND_WATCH_PARTY_MESSAGE(slug, id), { text });
  return res.data;
}

// ── Shareable highlight images — no auth required to fetch (see the
// backend route's own comment), so these are plain absolute URLs rather
// than API calls: handed straight to the OS share sheet (RN's own Share
// API), which can't carry a bearer token. ─────────────────────────────────

export function pollHighlightCardUrl(slug: string): string {
  return `${API_BASE_URL}${API_ROUTES.GROUPS.POLL_HIGHLIGHT_CARD(slug)}`;
}

export function watchPartyHighlightCardUrl(slug: string, id: string): string {
  return `${API_BASE_URL}${API_ROUTES.GROUPS.WATCH_PARTY_HIGHLIGHT_CARD(slug, id)}`;
}

// Unlike every other group route, this one is ObjectId-only — always pass
// group._id here, never group.slug.
export async function markGroupRead(groupId: string): Promise<void> {
  await API.post(API_ROUTES.GROUPS.MARK_READ(groupId));
}

// Mirrors conversationService.getMessages's cursor shape. Web's
// communityService.getMessages discards the pagination metadata (no working
// "load older" for groups on web at all) — return both parts here instead.
export async function getGroupMessages(
  slugOrId: string,
  before?: string,
  limit = 50
): Promise<{ items: Message[]; pagination: MessagePagination }> {
  const res = await API.get(API_ROUTES.GROUPS.GET_MESSAGES(slugOrId), {
    params: { before, limit },
  });
  return { items: withSenders(res.data), pagination: (res as any).pagination };
}

// REST send fallback for a disconnected socket — same role as
// conversationService.sendMessageRest.
export async function sendGroupMessageRest(slugOrId: string, text: string): Promise<Message> {
  const res = await API.post(API_ROUTES.GROUPS.SEND_MESSAGE(slugOrId), { text, type: "text" });
  return res.data;
}

// Mirrors conversationService.sendRichMessage's union shape — the backend's
// sendGroupMessage handler supports both type:"recommendation" and
// type:"analysis_share" the same way the DM one does. No socket path,
// matching sendRichMessage's own reasoning (one-off sends outside any open
// chat room).
export async function sendGroupRichMessage(
  groupId: string,
  payload:
    | {
        text: string;
        type: "recommendation";
        contentType: ContentType;
        contentId: string;
        contentData: {
          title?: string;
          posterUrl?: string;
          genres?: string[];
          releaseYear?: number;
          overview?: string;
          rating?: number;
        };
      }
    | { text: string; type: "analysis_share"; analysisData: ProfileAnalysis }
    | {
        text: string;
        type: "list_share";
        listData: {
          listId: string;
          name: string;
          itemCount: number;
          previewPosters: string[];
          description?: string;
          ownerUsername?: string;
        };
      }
): Promise<Message> {
  const res = await API.post(API_ROUTES.GROUPS.SEND_MESSAGE(groupId), payload);
  return res.data;
}
