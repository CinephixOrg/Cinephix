import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

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
 *   sendMessage: function,   // sendMessage(text)
 * }}
 */
export function useChat(roomType, roomId, token) {
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);

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
    });

    socket.on('new-message', (message) => {
      setMessages((prev) => [...prev, message]);
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
  }, [roomType, roomId, token]);

  const sendMessage = useCallback(
    (text) => {
      if (!socketRef.current?.connected || !text?.trim()) return;
      socketRef.current.emit('send-message', {
        roomType,
        roomId,
        text: text.trim(),
      });
    },
    [roomType, roomId]
  );

  return { messages, setMessages, connected, sendMessage };
}
