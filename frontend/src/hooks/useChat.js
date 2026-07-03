import { useEffect, useRef, useState, useCallback, useContext } from 'react';
import { io } from 'socket.io-client';
import API from '../api/axios';
import { NotificationContext } from '../context/NotificationContext';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const DEFAULT_MESSAGE_PAGE = 50;
const MAX_MESSAGES = 120;

/**
 * Generic real-time chat hook.
 * Works for any room type — group chats today, DMs in the future.
 *
 * @param {string|null} roomType  - 'group' | 'dm' | null (null = no connection)
 * @param {string|null} roomId   - The MongoDB _id of the group or conversation
 * @param {string|null} token    - JWT auth token
 *
 * @returns {{
 *   messages: array,
 *   setMessages: function,   // seed initial messages from REST response
 *   connected: boolean,
 *   sendMessage: function,   // sendMessage(text, clientTempId)
 *   loadOlderMessages: function,
 *   hasMoreMessages: boolean,
 *   loadingOlderMessages: boolean,
 * }}
 */
export function useChat(roomType, roomId, token) {
  const socketRef = useRef(null);
  const pendingMessagesRef = useRef([]);
  const [messages, setMessagesInternal] = useState([]);
  const [connected, setConnected] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [oldestMessageAt, setOldestMessageAt] = useState(null);
  const notificationContext = useContext(NotificationContext);

  const setMessages = useCallback((next) => {
    if (typeof next === 'function') {
      setMessagesInternal((prev) => {
        const updated = next(prev) || [];
        setOldestMessageAt(updated[0]?.createdAt || null);
        return updated;
      });
    } else {
      const array = Array.isArray(next) ? next : [];
      setMessagesInternal(array);
      setOldestMessageAt(array[0]?.createdAt || null);
      setHasMoreMessages(array.length === DEFAULT_MESSAGE_PAGE);
    }
  }, []);

  const fetchMessagesPage = useCallback(
    async (before) => {
      if (!roomType || !roomId) return { data: [], pagination: { hasMore: false } };

      const endpoint =
        roomType === 'group'
          ? `/groups/${roomId}/messages`
          : `/conversations/${roomId}/messages`;

      const response = await API.get(endpoint, {
        params: {
          before,
          limit: DEFAULT_MESSAGE_PAGE,
        },
      });

      return {
        data: Array.isArray(response.data) ? response.data : [],
        pagination: response.pagination || { hasMore: false },
      };
    },
    [roomType, roomId]
  );

  const loadOlderMessages = useCallback(async () => {
    if (!hasMoreMessages || loadingOlderMessages || !oldestMessageAt) return [];
    setLoadingOlderMessages(true);
    try {
      const { data, pagination } = await fetchMessagesPage(oldestMessageAt);
      if (data.length > 0) {
        setMessages((prev) => [...data, ...prev]);
      }
      setHasMoreMessages(Boolean(pagination.hasMore));
      return data;
    } catch (err) {
      console.error('[useChat] failed to load older messages:', err);
      return [];
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [fetchMessagesPage, hasMoreMessages, loadingOlderMessages, oldestMessageAt, setMessages]);

  useEffect(() => {
    setMessagesInternal([]);
    setHasMoreMessages(false);
    setLoadingOlderMessages(false);
    setOldestMessageAt(null);
    pendingMessagesRef.current = [];
  }, [roomType, roomId]);

  useEffect(() => {
    if (!roomType || !roomId || !token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-room', { roomType, roomId });
      if (pendingMessagesRef.current.length > 0) {
        pendingMessagesRef.current.forEach((message) => {
          socket.emit('send-message', message);
        });
        pendingMessagesRef.current = [];
      }
    });

    socket.on('new-message', (message) => {
      setMessages((prev) => {
        if (message?.clientTempId) {
          const tempIndex = prev.findIndex((item) => item._id === message.clientTempId);
          if (tempIndex >= 0) {
            const next = [...prev];
            next[tempIndex] = message;
            return next;
          }
        }

        const isDuplicate = prev.some((item) => item._id === message._id);
        if (isDuplicate) {
          return prev;
        }

        const next = [...prev, message];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    });

    // Listen for new notifications (message notifications)
    socket.on('new-notification', (notification) => {
      if (notificationContext) {
        notificationContext.incrementMessageUnread(notification.conversationId);
      }
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('connect_error', (err) => {
      console.error('[useChat] connection error:', err.message);
    });

    socket.on('error', (err) => {
      console.error('[useChat] server error:', err.message);
    });

    return () => {
      socket.emit('leave-room', { roomType, roomId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomType, roomId, token, notificationContext, setMessages]);

  const sendMessage = useCallback(
    (text, clientTempId) => {
      if (!text?.trim()) return;

      const messagePayload = {
        roomType,
        roomId,
        text: text.trim(),
        clientTempId,
      };

      if (!socketRef.current?.connected) {
        pendingMessagesRef.current.push(messagePayload);
        return;
      }

      socketRef.current.emit('send-message', messagePayload);
    },
    [roomType, roomId]
  );

  return {
    messages,
    setMessages,
    connected,
    sendMessage,
    loadOlderMessages,
    hasMoreMessages,
    loadingOlderMessages,
  };
}
