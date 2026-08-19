import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ContentType, Group, GroupMember, Message, MessagePagination, ProfileAnalysis } from "../types";

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
  return res.data;
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
  return { items: res.data, pagination: (res as any).pagination };
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
): Promise<Message> {
  const res = await API.post(API_ROUTES.GROUPS.SEND_MESSAGE(groupId), payload);
  return res.data;
}
