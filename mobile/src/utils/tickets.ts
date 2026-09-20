import type { Ionicons } from "@expo/vector-icons";
import type { Ticket, TicketStatus, TicketType } from "../types";

// How Help & Feedback words and colours a ticket.
//
// The type and status values are the server's own enums
// (backend/models/Ticket.js) and travel unchanged; these are only their
// labels, which go through t() like everything else the app says.
// Pure (no React Native) so it runs under `node --test` (tickets.test.mts).

export interface TicketTypeOption {
  value: TicketType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const TICKET_TYPE_OPTIONS: TicketTypeOption[] = [
  { value: "Bug Report", label: "Bug report", description: "Something is broken or behaves oddly", icon: "bug-outline" },
  { value: "Feature Request", label: "Feature request", description: "An idea for something new", icon: "bulb-outline" },
  { value: "General Support", label: "Support", description: "A question about your account or the app", icon: "help-buoy-outline" },
  { value: "Other", label: "Other", description: "Anything that doesn't fit the rest", icon: "chatbubble-ellipses-outline" },
];

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  "Bug Report": "Bug report",
  "Feature Request": "Feature request",
  "General Support": "Support",
  Other: "Other",
};

/**
 * A status's label and which palette colour carries it: waiting on us is
 * warm, being worked on is informative, done is green, closed is quiet.
 */
export const TICKET_STATUS_META: Record<TicketStatus, { label: string; tone: "warning" | "info" | "success" | "neutral" }> = {
  Open: { label: "Open", tone: "warning" },
  "In Progress": { label: "In progress", tone: "info" },
  Resolved: { label: "Resolved", tone: "success" },
  Closed: { label: "Closed", tone: "neutral" },
};

/** Whether a ticket can still be answered — a closed one is done with. */
export function isTicketActive(status: TicketStatus): boolean {
  return status === "Open" || status === "In Progress";
}

/** Newest first, with anything carrying an unread answer lifted to the top. */
export function sortTickets(tickets: readonly Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    if (a.hasUnreadReply !== b.hasUnreadReply) return a.hasUnreadReply ? -1 : 1;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
}
