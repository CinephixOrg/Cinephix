import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getConversations } from "../api/conversationService";
import { clearRooms } from "../api/chatCache";
import type { Conversation, GroupConversationRow, Message, RoomType, RoomUpdatedPayload } from "../types";

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:5000";

interface ChatContextValue {
  conversations: Conversation[];
  groupConversations: GroupConversationRow[];
  /** False until the inbox has been fetched once for this sign-in — the only time it's worth a skeleton. */
  inboxLoaded: boolean;
  totalUnread: number;
  connected: boolean;
  refreshConversations: () => Promise<void>;
  joinRoom: (roomType: RoomType, roomId: string) => void;
  leaveRoom: (roomType: RoomType, roomId: string) => void;
  sendMessage: (roomType: RoomType, roomId: string, text: string, clientTempId: string) => void;
  onNewMessage: (roomId: string, handler: (msg: Message) => void) => () => void;
  markReadLocally: (conversationId: string) => void;
  markGroupReadLocally: (groupId: string) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const latestFirst = (a: { lastMessageAt: string | null }, b: { lastMessageAt: string | null }) =>
  new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();

/**
 * A room's new last message, applied to its row. Unread goes up unless the
 * room is open on screen or the message is your own. Returns null for a room
 * the inbox doesn't have yet.
 */
function withRoomUpdate<T extends { _id: string; lastMessage: string; lastMessageAt: string | null; unreadCount: number }>(
  rows: T[],
  roomId: string,
  payload: RoomUpdatedPayload,
  countsAsUnread: boolean
): T[] | null {
  const index = rows.findIndex((row) => row._id === roomId);
  if (index === -1) return null;
  const next = rows.slice();
  next[index] = {
    ...next[index],
    lastMessage: payload.lastMessage,
    lastMessageAt: payload.lastMessageAt,
    unreadCount: countsAsUnread ? next[index].unreadCount + 1 : next[index].unreadCount,
  };
  return next.sort(latestFirst);
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groupConversations, setGroupConversations] = useState<GroupConversationRow[]>([]);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const messageHandlersRef = useRef<Map<string, (msg: Message) => void>>(new Map());
  const inFlightRef = useRef<Promise<void> | null>(null);
  // Bumped on sign-in and sign-out, so an inbox fetched for the previous
  // account never lands in the next one.
  const sessionRef = useRef(0);
  // The rows as last rendered, for the socket handler to check against
  // without going through a state updater.
  const dmRowsRef = useRef(conversations);
  const groupRowsRef = useRef(groupConversations);
  dmRowsRef.current = conversations;
  groupRowsRef.current = groupConversations;

  // Callers racing each other (the socket connecting, the inbox gaining
  // focus, a send finishing) share one request.
  const refreshConversations = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;
    const session = sessionRef.current;
    const request = getConversations()
      .then(({ dm, groups }) => {
        if (session !== sessionRef.current) return;
        setConversations(dm);
        setGroupConversations(groups);
      })
      .catch(() => {
        // Background refresh — the inbox keeps what it had.
      })
      .finally(() => {
        if (inFlightRef.current === request) inFlightRef.current = null;
        if (session === sessionRef.current) setInboxLoaded(true);
      });
    inFlightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    sessionRef.current += 1;
    inFlightRef.current = null;
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConversations([]);
      setGroupConversations([]);
      setInboxLoaded(false);
      clearRooms();
      return;
    }

    refreshConversations();

    const socket = io(SOCKET_URL, {
      auth: { token: user.token },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      refreshConversations();
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      setConnected(false);
      console.error("Chat socket connect_error:", err?.message);
    });

    socket.on("conversation-updated", (payload: RoomUpdatedPayload) => {
      const isGroup = "groupId" in payload;
      const roomId = isGroup ? payload.groupId : payload.conversationId;
      const countsAsUnread = activeRoomIdRef.current !== roomId && payload.senderId !== user._id;
      const known = (isGroup ? groupRowsRef.current : dmRowsRef.current).some((row) => row._id === roomId);
      if (!known) {
        // Activity in a room the inbox hasn't seen yet: the payload can't
        // build that row by itself, so fetch the inbox rather than guess.
        refreshConversations();
        return;
      }
      if (isGroup) {
        // The preview's "ana: …" label follows the new message's sender. With
        // no name to go on (an older server), the label is dropped rather
        // than left naming whoever spoke before.
        const senderName = payload.senderUsername ?? (payload.senderId === user._id ? user.username : undefined);
        setGroupConversations((prev) => {
          const next = withRoomUpdate(prev, roomId, payload, countsAsUnread);
          if (!next) return prev;
          return next.map((row) =>
            row._id === roomId
              ? { ...row, lastMessageSenderId: senderName ? { _id: payload.senderId, username: senderName } : undefined }
              : row
          );
        });
        return;
      }
      setConversations((prev) => withRoomUpdate(prev, roomId, payload, countsAsUnread) ?? prev);
    });

    socket.on("new-message", (message: Message) => {
      messageHandlersRef.current.get(message.roomId)?.(message);
    });

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        socket.disconnect();
      } else if (state === "active" && !socket.connected) {
        // The connect handler refreshes the inbox.
        socket.connect();
      }
    };
    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?._id]);

  const totalUnread = useMemo(
    () =>
      conversations.reduce((sum, c) => sum + c.unreadCount, 0) +
      groupConversations.reduce((sum, g) => sum + g.unreadCount, 0),
    [conversations, groupConversations]
  );

  const joinRoom = useCallback((roomType: RoomType, roomId: string) => {
    activeRoomIdRef.current = roomId;
    socketRef.current?.emit("join-room", { roomType, roomId });
  }, []);

  const leaveRoom = useCallback((roomType: RoomType, roomId: string) => {
    if (activeRoomIdRef.current === roomId) activeRoomIdRef.current = null;
    socketRef.current?.emit("leave-room", { roomType, roomId });
  }, []);

  const sendMessage = useCallback((roomType: RoomType, roomId: string, text: string, clientTempId: string) => {
    socketRef.current?.emit("send-message", { roomType, roomId, text, clientTempId });
  }, []);

  const onNewMessage = useCallback((roomId: string, handler: (msg: Message) => void) => {
    messageHandlersRef.current.set(roomId, handler);
    return () => {
      if (messageHandlersRef.current.get(roomId) === handler) messageHandlersRef.current.delete(roomId);
    };
  }, []);

  const markReadLocally = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.some((c) => c._id === conversationId && c.unreadCount > 0)
        ? prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
        : prev
    );
  }, []);

  const markGroupReadLocally = useCallback((groupId: string) => {
    setGroupConversations((prev) =>
      prev.some((g) => g._id === groupId && g.unreadCount > 0)
        ? prev.map((g) => (g._id === groupId ? { ...g, unreadCount: 0 } : g))
        : prev
    );
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      groupConversations,
      inboxLoaded,
      totalUnread,
      connected,
      refreshConversations,
      joinRoom,
      leaveRoom,
      sendMessage,
      onNewMessage,
      markReadLocally,
      markGroupReadLocally,
    }),
    [
      conversations,
      groupConversations,
      inboxLoaded,
      totalUnread,
      connected,
      refreshConversations,
      joinRoom,
      leaveRoom,
      sendMessage,
      onNewMessage,
      markReadLocally,
      markGroupReadLocally,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
