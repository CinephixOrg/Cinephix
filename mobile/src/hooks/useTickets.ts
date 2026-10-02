import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import {
  cachedTicket,
  isTicketsStale,
  refreshTicket,
  refreshTickets,
  setTicketsOwner,
  subscribeTickets,
  ticketsSnapshot,
  unreadTicketCount,
} from "../api/ticketStore";
import type { Ticket } from "../types";

/**
 * Their support tickets, cached across screens (api/ticketStore.ts). The hub
 * renders the cached list straight away and refreshes it in the background
 * when it's old; `failed` is only set when there's nothing to show instead.
 */
export function useTickets() {
  const { user } = useAuth();
  setTicketsOwner(user?._id);
  const tickets = useSyncExternalStore(subscribeTickets, ticketsSnapshot);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // On every visit: coming back after an answer arrived shows it.
  useFocusEffect(
    useCallback(() => {
      if (!isTicketsStale()) return;
      refreshTickets()
        .then(() => setFailed(false))
        .catch(() => setFailed(ticketsSnapshot() === null));
    }, [user?._id])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTickets();
      setFailed(false);
    } catch {
      setFailed(ticketsSnapshot() === null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { tickets, failed, refreshing, refresh };
}

/**
 * One ticket: the list's copy on the first frame (so a ticket opens with its
 * text already there), then the server's.
 */
export function useTicket(id: string) {
  const { user } = useAuth();
  setTicketsOwner(user?._id);
  useSyncExternalStore(subscribeTickets, ticketsSnapshot);
  const ticket = cachedTicket(id);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    refreshTicket(id)
      .then(() => setFailed(false))
      .catch(() => setFailed(cachedTicket(id) === undefined));
  }, [id]);

  return { ticket, failed };
}

/**
 * How many answers are waiting to be read — the dot on Settings' Help &
 * Feedback row. Reads what's cached; the hub is what loads it.
 */
export function useUnreadTickets(): number {
  useSyncExternalStore(subscribeTickets, ticketsSnapshot);
  return unreadTicketCount();
}
