import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "./AuthContext";
import { getUnreadCount } from "../api/notificationService";

interface NotificationContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  decrementUnreadCount: (by?: number) => void;
  clearUnreadCount: () => void;
  /** Sets the count from a response that already carries it (the notification list). */
  syncUnreadCount: (count: number) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const POLL_INTERVAL_MS = 10000;

// The unread badge. Polls while the app is in the foreground — a
// backgrounded app polling every 10 seconds was network and battery for a
// badge no one could see — and refreshes the moment the app comes back.
//
// The value and every function in it keep their identity between renders,
// so the bells in every screen header only re-render when the count itself
// changes.
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?._id ?? null;
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      setUnreadCount(await getUnreadCount());
    } catch {
      // Background poll — swallow errors, matches web's NotificationContext.
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    refreshUnreadCount();
    const interval = setInterval(() => {
      if (AppState.currentState === "active") refreshUnreadCount();
    }, POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshUnreadCount();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [userId, refreshUnreadCount]);

  const decrementUnreadCount = useCallback((by = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - by));
  }, []);

  const clearUnreadCount = useCallback(() => setUnreadCount(0), []);

  const syncUnreadCount = useCallback((count: number) => setUnreadCount(Math.max(0, count)), []);

  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount, decrementUnreadCount, clearUnreadCount, syncUnreadCount }),
    [unreadCount, refreshUnreadCount, decrementUnreadCount, clearUnreadCount, syncUnreadCount]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
