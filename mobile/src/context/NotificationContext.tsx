import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { getUnreadCount } from "../api/notificationService";

interface NotificationContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  decrementUnreadCount: (by?: number) => void;
  clearUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const POLL_INTERVAL_MS = 10000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshUnreadCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Background poll — swallow errors, matches web's NotificationContext.
    }
  };

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!user) {
      setUnreadCount(0);
      return;
    }

    refreshUnreadCount();
    intervalRef.current = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?._id]);

  const decrementUnreadCount = (by = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - by));
  };

  const clearUnreadCount = () => setUnreadCount(0);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, refreshUnreadCount, decrementUnreadCount, clearUnreadCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
