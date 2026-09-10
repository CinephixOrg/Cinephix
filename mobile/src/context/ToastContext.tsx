import React, { createContext, useContext, useRef, useState } from "react";

// "success" is opt-in per call — every existing showToast(msg) call site
// (38 of them across the app) keeps the plain neutral look unchanged;
// passing "success" is a deliberate per-message choice for a real
// confirmation worth standing out (e.g. ShareCard.tsx's "Added to
// Watchlist"), not a blanket restyle of every toast in the app.
export type ToastType = "default" | "success";

interface ToastContextValue {
  message: string | null;
  type: ToastType;
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_DURATION_MS = 2500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<ToastType>("default");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, msgType: ToastType = "default") => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage(msg);
    setType(msgType);
    timeoutRef.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
  };

  return (
    <ToastContext.Provider value={{ message, type, showToast }}>{children}</ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
