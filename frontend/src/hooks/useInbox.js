import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

/**
 * Lightweight hook that keeps a persistent socket connection open
 * for the user's personal inbox room (`user:<userId>`).
 *
 * The server auto-joins every authenticated socket to `user:<userId>` on
 * connection, so this hook just needs to stay connected and forward events.
 *
 * @param {string|null} token  - JWT auth token
 * @param {function} onConversationUpdated  - called with conversation-updated payload
 */
export function useInbox(token, onConversationUpdated) {
  const socketRef = useRef(null);
  const callbackRef = useRef(onConversationUpdated);
  callbackRef.current = onConversationUpdated; // always up to date without re-subscribing

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('conversation-updated', (payload) => {
      callbackRef.current?.(payload);
    });

    socket.on('connect_error', (err) => {
      console.error('[useInbox] connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);
}
