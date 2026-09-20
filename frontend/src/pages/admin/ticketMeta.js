// The ticket vocabulary the queue, its rows and the detail panel share, so
// one ticket reads the same everywhere. Mirrors backend/models/Ticket.js.

export const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
export const TICKET_TYPES = ["Bug Report", "Feature Request", "General Support", "Other"];

export const STATUS_STYLE = {
  Open: "bg-amber-400/15 text-amber-300",
  "In Progress": "bg-sky-400/15 text-sky-300",
  Resolved: "bg-emerald-400/15 text-emerald-300",
  Closed: "bg-zinc-700/60 text-zinc-300",
};

export const TYPE_STYLE = {
  "Bug Report": "bg-red-500/10 text-red-300",
  "Feature Request": "bg-violet-500/15 text-violet-300",
  "General Support": "bg-sky-500/10 text-sky-300",
  Other: "bg-zinc-700/50 text-zinc-300",
};
