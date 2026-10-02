import { createTicket, getMyTickets, getTicket, markTicketRead } from "./ticketService";
import type { Ticket, TicketType } from "../types";

// The signed-in person's support tickets, shared by the Help & Feedback hub,
// a ticket's own page and the Settings row's unread dot.
//
//   * stale-while-revalidate: the hub renders what's cached on its first
//     frame and refreshes underneath once the cache is FRESH_MS old;
//   * one in-flight request, so a screen and a prefetch cost one round trip;
//   * a ticket's page opens from the list's copy, so it's there immediately;
//   * opening a ticket, or writing one, updates every screen at once.
//
// Tickets are per person, so everything is dropped when the signed-in user
// changes (api/sessionReset.ts).

const FRESH_MS = 30_000;

type Listener = () => void;

const listeners = new Set<Listener>();

let tickets: Ticket[] | null = null;
let ownerId: string | null = null;
let fetchedAt = 0;
let inFlight: Promise<Ticket[]> | null = null;
// Bumped on every sign-in change, so a request that outlives its user is ignored.
let generation = 0;

function emit() {
  for (const listener of listeners) listener();
}

/** Call with the signed-in user's id before reading; a different user starts from nothing. */
export function setTicketsOwner(userId: string | null | undefined) {
  const next = userId ?? null;
  if (next === ownerId) return;
  ownerId = next;
  tickets = null;
  fetchedAt = 0;
  inFlight = null;
  generation += 1;
  emit();
}

export function subscribeTickets(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ticketsSnapshot(): Ticket[] | null {
  return tickets;
}

/** How many tickets have an answer that hasn't been opened — the Settings dot. */
export function unreadTicketCount(): number {
  return (tickets ?? []).filter((ticket) => ticket.hasUnreadReply).length;
}

export function isTicketsStale(): boolean {
  return !tickets || Date.now() - fetchedAt > FRESH_MS;
}

/** The list, from the network. Concurrent calls share one request. */
export function refreshTickets(): Promise<Ticket[]> {
  if (inFlight) return inFlight;
  const startedIn = generation;
  const request = getMyTickets()
    .then((page) => {
      if (startedIn !== generation) return page.items;
      fetchedAt = Date.now();
      tickets = page.items;
      emit();
      return page.items;
    })
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });
  inFlight = request;
  return request;
}

/** The cached list when fresh enough, otherwise a refresh. */
export function loadTickets(): Promise<Ticket[]> {
  return tickets && !isTicketsStale() ? Promise.resolve(tickets) : refreshTickets();
}

export function cachedTicket(id: string): Ticket | undefined {
  return tickets?.find((ticket) => ticket._id === id);
}

/** Puts a ticket in the list, newest first, replacing an older copy of it. */
export function applyTicket(next: Ticket) {
  const rest = (tickets ?? []).filter((ticket) => ticket._id !== next._id);
  tickets = [next, ...rest].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  emit();
}

/** Writes a new ticket, which appears at the top of the hub straight away. */
export async function submitTicket(input: { type: TicketType; title: string; description: string }): Promise<Ticket> {
  const ticket = await createTicket(input);
  applyTicket(ticket);
  return ticket;
}

/** One ticket from the network; the list's copy is updated with it. */
export async function refreshTicket(id: string): Promise<Ticket> {
  const startedIn = generation;
  const fresh = await getTicket(id);
  if (startedIn === generation) applyTicket(fresh);
  return fresh;
}

/**
 * Marks an answer as read, clearing its dot here first so the hub updates on
 * the same frame the ticket opens. A failure leaves the dot alone.
 */
export async function readTicket(id: string): Promise<void> {
  const current = cachedTicket(id);
  if (current?.hasUnreadReply) applyTicket({ ...current, hasUnreadReply: false });
  const startedIn = generation;
  try {
    const fresh = await markTicketRead(id);
    if (startedIn === generation) applyTicket(fresh);
  } catch {
    if (current && startedIn === generation) applyTicket(current);
  }
}

/** Everything, e.g. on sign-out (api/sessionReset.ts). */
export function clearTickets() {
  setTicketsOwner(null);
}
