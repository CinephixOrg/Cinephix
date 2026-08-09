import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { Conversation, Message, MessagePagination } from "../types";

// GET /conversations returns BOTH dm and group rows merged — mobile has no
// group chat support yet, filter here so nothing downstream ever sees one.
export async function getConversations(): Promise<Conversation[]> {
  const res = await API.get(API_ROUTES.CONVERSATIONS.GET_ALL);
  return (res.data as Conversation[]).filter((c) => c.type === "dm");
}

export async function getOrCreateConversation(participantId: string): Promise<Conversation> {
  const res = await API.post(API_ROUTES.CONVERSATIONS.GET_OR_CREATE, { participantId });
  return res.data;
}

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
