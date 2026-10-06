import { getMessages } from "./conversationService";
import { getGroupMessages, getWatchPartyMessagesById } from "./groupService";
import { createLruCache } from "../utils/cache";
import { confirmedOnly } from "../utils/chatMessages";
import { createPrefetcher } from "../utils/prefetch";
import type { Message, MessagePagination, RoomType } from "../types";

// The messages of recently opened chats, so reopening one shows its
// conversation on the first frame (then refreshes underneath) instead of a
// skeleton. Keyed by room ("dm:<conversationId>" / "group:<groupId>").
//
// Held in memory only, and cleared on sign-out (see ChatContext).

export interface RoomPage {
  items: Message[];
  pagination: MessagePagination;
}

const rooms = createLruCache<RoomPage>(30);

export function roomKey(roomType: RoomType, roomId: string): string {
  return `${roomType}:${roomId}`;
}

export function cachedRoom(key: string): RoomPage | undefined {
  return rooms.get(key);
}

/** Only messages the server has confirmed are kept — one still sending belongs to the screen that sent it. */
export function rememberRoom(key: string, page: RoomPage) {
  rooms.set(key, { items: confirmedOnly(page.items), pagination: page.pagination });
}

export function clearRooms() {
  rooms.clear();
}

function fetchFirstPage(key: string): Promise<RoomPage> {
  const split = key.indexOf(":");
  const roomType = key.slice(0, split) as RoomType;
  const roomId = key.slice(split + 1);
  // Was missing a "watchparty" case entirely — fell through to the DM
  // fetch below with a watch party's own id, which that endpoint neither
  // recognizes nor returns a conversation for (the room's real bug behind
  // "Couldn't load messages.": every watch party's first open hit this,
  // not just an occasional flaky one).
  if (roomType === "group") return getGroupMessages(roomId);
  if (roomType === "watchparty") return getWatchPartyMessagesById(roomId);
  return getMessages(roomId);
}

/**
 * A chat's newest page, started by a touch on its row in the inbox and taken
 * by the chat once it mounts, so the round trip overlaps the transition.
 */
export const roomPrefetch = createPrefetcher(fetchFirstPage);
