import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { Conversation, ContentType, GroupConversationRow, Message, MessagePagination } from "../types";
import { createPrefetcher } from "../utils/prefetch";

interface RecommendationPayload {
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

interface AnalysisSharePayload {
  text: string;
  type: "analysis_share";
  analysisData: unknown;
}

interface ProfileSharePayload {
  text: string;
  type: "profile_share";
  profileData: {
    userId: string;
    username: string;
    profile_pic_url?: string | null;
    accountTier?: string | null;
    bio?: string;
    followersCount?: number;
    topGenres?: string[];
  };
}

interface ListSharePayload {
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

// GET /conversations returns BOTH dm and group rows merged — split by type
// here rather than discarding groups, so the Messages inbox can show both
// while every DM-only consumer (RecipientPickerModal, etc.) keeps reading
// plain Conversation[] unaffected.
export async function getConversations(): Promise<{
  dm: Conversation[];
  groups: GroupConversationRow[];
}> {
  const res = await API.get(API_ROUTES.CONVERSATIONS.GET_ALL);
  const all = res.data as Array<Conversation | GroupConversationRow>;
  return {
    dm: all.filter((c): c is Conversation => c.type === "dm"),
    groups: all.filter((c): c is GroupConversationRow => c.type === "group"),
  };
}

export async function getOrCreateConversation(participantId: string): Promise<Conversation> {
  const res = await API.post(API_ROUTES.CONVERSATIONS.GET_OR_CREATE, { participantId });
  return res.data;
}

// The DM with a person, started by a tap that's about to open it (a message
// notification) and taken by the chat screen once it mounts. Keyed by the
// other person's id.
export const conversationPrefetch = createPrefetcher(getOrCreateConversation);

// This endpoint's envelope is {data, pagination:{hasMore,limit,before}} — a
// different, cursor-based pagination shape than ListResult<T>'s
// {total,page,limit,pages} used elsewhere (Movies/Match/Notifications).
export async function getMessages(
  conversationId: string,
  before?: string,
  limit = 50
): Promise<{ items: Message[]; pagination: MessagePagination }> {
  const res = await API.get(API_ROUTES.CONVERSATIONS.GET_MESSAGES(conversationId), {
    params: { before, limit },
  });
  return { items: res.data, pagination: (res as any).pagination };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await API.post(API_ROUTES.CONVERSATIONS.MARK_READ(conversationId));
}

// REST send fallback — used only when the socket is disconnected at send
// time; the primary send path is ChatContext.sendMessage over the socket.
export async function sendMessageRest(conversationId: string, text: string): Promise<Message> {
  const res = await API.post(API_ROUTES.CONVERSATIONS.SEND_MESSAGE(conversationId), {
    text,
    type: "text",
  });
  return res.data;
}

// Recommendation/analysis-share/profile-share sends are one-off actions
// triggered outside any open chat room (a gift-icon picker, AnalyzeModal's
// Share button, Public Profile's photo-viewer Share action) — REST only, no
// socket path, matching how web itself sends these types.
export async function sendRichMessage(
  conversationId: string,
  payload: RecommendationPayload | AnalysisSharePayload | ProfileSharePayload | ListSharePayload
): Promise<Message> {
  const res = await API.post(API_ROUTES.CONVERSATIONS.SEND_MESSAGE(conversationId), payload);
  return res.data;
}
