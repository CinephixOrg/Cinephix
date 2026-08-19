import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getConversations } from "../api/conversationService";
import type { Conversation, GroupConversationRow, Message, RoomType, RoomUpdatedPayload } from "../types";

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:5000";

interface ChatContextValue {
  conversations: Conversation[];
  groupConversations: GroupConversationRow[];
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

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groupConversations, setGroupConversations] = useState<GroupConversationRow[]>([]);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const messageHandlersRef = useRef<Map<string, (msg: Message) => void>>(new Map());

  const refreshConversations = async () => {
    try {
      const { dm, groups } = await getConversations();
      setConversations(dm);
      setGroupConversations(groups);
    } catch {
      // Swallow — matches NotificationContext's background-refresh handling.
    }
  };

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConversations([]);
      setGroupConversations([]);
      return;
    }

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
      if ("groupId" in payload) {
        setGroupConversations((prev) => {
          const idx = prev.findIndex((g) => g._id === payload.groupId);
          if (idx === -1) {
            // Brand-new group activity the client hasn't seen yet — refetch
            // rather than synthesize a partial row (mirrors the DM branch).
            refreshConversations();
            return prev;
          }
          const isActive = activeRoomIdRef.current === payload.groupId;
          const isOwnSend = payload.senderId === user._id;
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            lastMessage: payload.lastMessage,
            lastMessageAt: payload.lastMessageAt,
            unreadCount: isActive || isOwnSend ? next[idx].unreadCount : next[idx].unreadCount + 1,
          };
          next.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
          return next;
        });
        return;
      }
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === payload.conversationId);
        if (idx === -1) {
          // Brand-new inbound DM — payload doesn't carry otherUser, so fetch
          // the full row instead of synthesizing a partial one.
          refreshConversations();
          return prev;
        }
        const isActive = activeRoomIdRef.current === payload.conversationId;
        const isOwnSend = payload.senderId === user._id;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          lastMessage: payload.lastMessage,
          lastMessageAt: payload.lastMessageAt,
          unreadCount: isActive || isOwnSend ? next[idx].unreadCount : next[idx].unreadCount + 1,
        };
        next.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
        return next;
      });
    });

    socket.on("new-message", (message: Message) => {
      const handler = messageHandlersRef.current.get(message.roomId);
      handler?.(message);
    });

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        socket.disconnect();
      } else if (state === "active" && !socket.connected) {
        socket.connect();
        refreshConversations();
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

  const joinRoom = (roomType: RoomType, roomId: string) => {
    activeRoomIdRef.current = roomId;
    socketRef.current?.emit("join-room", { roomType, roomId });
  };

  const leaveRoom = (roomType: RoomType, roomId: string) => {
    if (activeRoomIdRef.current === roomId) {
      activeRoomIdRef.current = null;
    }
    socketRef.current?.emit("leave-room", { roomType, roomId });
  };

  const sendMessage = (roomType: RoomType, roomId: string, text: string, clientTempId: string) => {
    socketRef.current?.emit("send-message", { roomType, roomId, text, clientTempId });
  };

  const onNewMessage = (roomId: string, handler: (msg: Message) => void) => {
    messageHandlersRef.current.set(roomId, handler);
    return () => {
      if (messageHandlersRef.current.get(roomId) === handler) {
        messageHandlersRef.current.delete(roomId);
      }
    };
  };

  const markReadLocally = (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
  };

  const markGroupReadLocally = (groupId: string) => {
    setGroupConversations((prev) =>
      prev.map((g) => (g._id === groupId ? { ...g, unreadCount: 0 } : g))
    );
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        groupConversations,
        totalUnread,
        connected,
        refreshConversations,
        joinRoom,
        leaveRoom,
        sendMessage,
        onNewMessage,
        markReadLocally,
        markGroupReadLocally,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
