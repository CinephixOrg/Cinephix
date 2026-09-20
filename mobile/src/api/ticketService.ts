import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { Ticket, TicketType } from "../types";

// Help & Feedback. Everything here is about the signed-in person's own
// tickets; answering them happens in the web dashboard.

export interface TicketPage {
  items: Ticket[];
  page: number;
  total: number;
  hasMore: boolean;
  /** How many carry an answer they haven't opened yet. */
  unread: number;
}

export async function createTicket(input: { type: TicketType; title: string; description: string }): Promise<Ticket> {
  const res = await API.post(API_ROUTES.TICKETS.CREATE, input);
  return res.data;
}

export async function getMyTickets(page = 1, limit = 20): Promise<TicketPage> {
  const res = await API.get(API_ROUTES.TICKETS.MINE, { params: { page, limit } });
  return res.data;
}

export async function getTicket(id: string): Promise<Ticket> {
  const res = await API.get(API_ROUTES.TICKETS.GET(id));
  return res.data;
}

/** Opening a ticket clears its "new answer" dot, here and on the server. */
export async function markTicketRead(id: string): Promise<Ticket> {
  const res = await API.patch(API_ROUTES.TICKETS.READ(id));
  return res.data;
}
