import { formatDistanceToNow } from "date-fns";
import { FiCornerUpLeft } from "react-icons/fi";
import { STATUS_STYLE, TYPE_STYLE } from "./ticketMeta.js";

const ago = (date) => (date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : "");

// One ticket in the queue list: who wrote it, what about, and how it's going.
export default function TicketRow({ ticket, active, onClick }) {
  const user = ticket.userId;
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        active ? "border-violet-500/60 bg-violet-500/10" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <span className={`rounded-md px-2 py-0.5 font-semibold ${TYPE_STYLE[ticket.type] ?? ""}`}>{ticket.type}</span>
        <span className={`rounded-md px-2 py-0.5 font-medium ${STATUS_STYLE[ticket.status] ?? ""}`}>{ticket.status}</span>
        <span className="ml-auto text-zinc-500" title={new Date(ticket.createdAt).toLocaleString()}>
          {ago(ticket.createdAt)}
        </span>
      </div>

      <h3 className="mt-2 truncate font-semibold text-zinc-100">{ticket.title}</h3>
      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-400">{ticket.description}</p>

      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
        {user?.profile_pic_url ? (
          <img src={user.profile_pic_url} alt="" className="h-5 w-5 rounded-full object-cover" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-violet-300">
            {(user?.username ?? "?").slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="truncate">{user ? `@${user.username}` : "Deleted account"}</span>
        {ticket.adminReply && (
          <span className="ml-auto inline-flex items-center gap-1 text-emerald-300/80" title="Answered">
            <FiCornerUpLeft className="h-3 w-3" /> {ticket.replies?.length ?? 1}
          </span>
        )}
      </div>
    </button>
  );
}
