import { useState } from "react";
import toast from "react-hot-toast";
import { format, formatDistanceToNow } from "date-fns";
import { FiExternalLink, FiSend } from "react-icons/fi";
import { updateTicket } from "../../api/adminService.js";
import { STATUS_STYLE, TICKET_STATUSES, TYPE_STYLE } from "./ticketMeta.js";

const ago = (date) => (date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : "");

// The ticket being answered: what they wrote, who they are, every reply so
// far, and the panel that answers it. Saving sends the person a push
// notification, so the panel says so rather than letting it surprise anyone.
export default function TicketDetail({ ticket, onUpdated }) {
  const [status, setStatus] = useState(ticket.status);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const user = ticket.userId;
  const statusChanged = status !== ticket.status;
  const canSave = statusChanged || reply.trim().length > 0;

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      const updated = await updateTicket(ticket._id, {
        ...(statusChanged ? { status } : {}),
        ...(reply.trim() ? { reply: reply.trim() } : {}),
      });
      onUpdated(updated);
      setReply("");
      toast.success(reply.trim() ? "Reply sent" : `Marked ${status}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't update the ticket");
      setStatus(ticket.status);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-md px-2 py-0.5 font-semibold ${TYPE_STYLE[ticket.type] ?? ""}`}>{ticket.type}</span>
        <span className={`rounded-md px-2 py-0.5 font-medium ${STATUS_STYLE[ticket.status] ?? ""}`}>{ticket.status}</span>
        <span className="ml-auto text-zinc-500" title={new Date(ticket.createdAt).toLocaleString()}>
          {format(new Date(ticket.createdAt), "d MMM yyyy, HH:mm")}
        </span>
      </div>

      <h2 className="mt-3 text-xl font-bold">{ticket.title}</h2>

      {/* Who wrote it — their full profile is a click away. */}
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-zinc-950/50 px-3 py-2.5">
        {user?.profile_pic_url ? (
          <img src={user.profile_pic_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-violet-300">
            {(user?.username ?? "?").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          {user ? (
            <a
              href={`/admin/users/${user._id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold hover:text-violet-300 hover:underline underline-offset-2"
              title={`Open @${user.username}'s profile`}
            >
              @{user.username} <FiExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-zinc-500">Deleted account</span>
          )}
          <div className="text-xs capitalize text-zinc-500">{user?.accountTier ?? "free"}</div>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">{ticket.description}</p>

      {ticket.replies?.length > 0 && (
        <div className="mt-5 space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Replies</h3>
          {ticket.replies.map((item, i) => (
            <div key={`${item.createdAt}-${i}`} className="rounded-xl border-l-2 border-emerald-500/50 bg-zinc-800/40 px-3 py-2">
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-200">{item.text}</p>
              <div className="mt-1 text-[11px] text-zinc-500">
                {item.adminId?.username ? `@${item.adminId.username} · ` : ""}
                {ago(item.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Answering it */}
      <div className="mt-5 border-t border-zinc-800 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-zinc-400" htmlFor={`status-${ticket._id}`}>
            Status
          </label>
          <select
            id={`status-${ticket._id}`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="select select-sm select-bordered bg-zinc-900"
          >
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {statusChanged && <span className="text-xs text-amber-300">Unsaved</span>}
        </div>

        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          maxLength={4000}
          rows={4}
          placeholder="Write back to them — this appears in their Help & Feedback screen."
          className="textarea textarea-bordered mt-3 w-full bg-zinc-900 text-sm"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            disabled={!canSave || busy}
            onClick={save}
            className="btn btn-sm gap-1.5 border-0 bg-violet-600 text-white hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {busy ? <span className="loading loading-spinner loading-xs" /> : <FiSend />}
            {reply.trim() ? "Send reply" : "Save status"}
          </button>
          <p className="text-xs text-zinc-500">They get a push notification about this.</p>
        </div>
      </div>
    </article>
  );
}
