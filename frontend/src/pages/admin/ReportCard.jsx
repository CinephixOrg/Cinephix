import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { FiCheck, FiCopy, FiRotateCcw, FiTrash2, FiX } from "react-icons/fi";
import { deleteContent } from "../../api/adminService.js";
import SuspendControl from "./SuspendControl.jsx";
import { DELETABLE } from "./moderationMeta.js";
import DangerButton from "./DangerButton.jsx";

// Mirrors backend models/Report.js REPORT_REASONS, worded as the app words them.
const REASON_LABEL = {
  spam: "Spam",
  harassment: "Harassment or hate speech",
  inappropriate: "Inappropriate content",
  spoiler: "Spoiler without warning",
  impersonation: "Impersonation",
  other: "Something else",
};
const TYPE_LABEL = { User: "Profile", Review: "Review", Share: "Media post", List: "List", Message: "Message", Comment: "Comment" };
const STATUS_STYLE = {
  pending: "bg-amber-400/15 text-amber-300",
  resolved: "bg-emerald-400/15 text-emerald-300",
  dismissed: "bg-zinc-700/60 text-zinc-300",
};

const ago = (date) => (date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : "");

// One report: what was reported (the snapshot taken when it was filed, so
// it's readable even if the thing was since edited or deleted), who reported
// whom and why, and the decision buttons. `compact` is the narrow column of
// a person's own page (ModerationPanel.jsx).
export default function ReportCard({ report, onDecide, onRemoved, onSuspended, compact = false }) {
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [gone, setGone] = useState(false);

  const decide = async (status) => {
    setBusy(status);
    try {
      await onDecide(report, status, note.trim() || undefined);
    } catch {
      setBusy(null);
    }
  };

  // Removing the content or suspending the author also resolves this
  // report server-side, so the card reports back and lets its queue update.
  const removeContent = async () => {
    setBusy("delete");
    try {
      const result = await deleteContent(DELETABLE[report.entityType], report.reportedEntityId, report.reason);
      setGone(true);
      toast.success(result.reportsResolved > 1 ? `Content removed, ${result.reportsResolved} reports closed` : "Content removed");
      onRemoved?.(report, result);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't remove that content");
    } finally {
      setBusy(null);
    }
  };

  // entityExists comes from the API; `gone` covers a removal just made here.
  const alreadyGone = gone || report.entityExists === false;
  const reported = report.reportedUserId;
  const reporter = report.reporterId;
  const pending = report.status === "pending";

  return (
    <article className={`rounded-2xl border border-zinc-800 bg-zinc-900/50 ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-violet-500/15 px-2 py-0.5 font-semibold text-violet-300">{TYPE_LABEL[report.entityType] ?? report.entityType}</span>
        <span className="rounded-md bg-red-500/10 px-2 py-0.5 font-medium text-red-300">{REASON_LABEL[report.reason] ?? report.reason}</span>
        <span className={`rounded-md px-2 py-0.5 font-medium capitalize ${STATUS_STYLE[report.status] ?? ""}`}>{report.status}</span>
        <span className="ml-auto text-zinc-500" title={new Date(report.createdAt).toLocaleString()}>
          {ago(report.createdAt)}
        </span>
      </div>

      {/* Reported user */}
      <div className="mb-3 flex items-center gap-3">
        <Avatar person={reported} compact={compact} />
        <div className="min-w-0">
          <div className="truncate font-semibold">
            {reported ? <UserLink person={reported} /> : <span className="text-zinc-500">Deleted account</span>}
          </div>
          <div className="text-xs text-zinc-500">
            Reported by {reporter ? <UserLink person={reporter} className="text-zinc-300" /> : "a deleted account"}
          </div>
        </div>
      </div>

      <Snapshot type={report.entityType} snapshot={report.snapshot} />

      {report.description && (
        <div className="mt-3 rounded-lg border-l-2 border-zinc-600 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-300">
          <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Reporter's note</div>
          <p className="whitespace-pre-wrap break-words">{report.description}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <IdLine label={`${report.entityType} id`} value={report.reportedEntityId} />
        {!compact && reported?._id && <IdLine label="User id" value={reported._id} />}
      </div>

      {!pending && (
        <div className="mt-3 rounded-lg bg-zinc-800/40 px-3 py-2 text-xs text-zinc-400">
          <span className="capitalize">{report.status}</span>
          {report.reviewedBy?.username ? ` by @${report.reviewedBy.username}` : ""} {ago(report.reviewedAt)}
          {report.resolutionNote && <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{report.resolutionNote}</p>}
        </div>
      )}

      {/* Decision */}
      <div className="mt-4 border-t border-zinc-800 pt-4">
        {noteOpen && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Note for the record (optional) — what you did and why"
            className="textarea textarea-bordered mb-3 w-full bg-zinc-900 text-sm"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {pending ? (
            <>
              <button disabled={!!busy} onClick={() => decide("resolved")} className="btn btn-sm gap-1.5 border-0 bg-emerald-600 text-white hover:bg-emerald-500">
                {busy === "resolved" ? <span className="loading loading-spinner loading-xs" /> : <FiCheck />} Resolve
              </button>
              <button disabled={!!busy} onClick={() => decide("dismissed")} className="btn btn-sm gap-1.5">
                {busy === "dismissed" ? <span className="loading loading-spinner loading-xs" /> : <FiX />} Dismiss
              </button>
            </>
          ) : (
            <button disabled={!!busy} onClick={() => decide("pending")} className="btn btn-sm gap-1.5">
              {busy === "pending" ? <span className="loading loading-spinner loading-xs" /> : <FiRotateCcw />} Reopen
            </button>
          )}
          {!noteOpen && (
            <button onClick={() => setNoteOpen(true)} className="btn btn-sm btn-ghost text-zinc-400">
              Add note
            </button>
          )}
        </div>

        {/* The actions that change the app itself, kept apart from the
            verdict buttons and asking twice (DangerButton.jsx). */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800/70 pt-3">
          {DELETABLE[report.entityType] &&
            (alreadyGone ? (
              // The content is gone — removed here, or by an earlier
              // decision. Reopening a report about it is still fine.
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <FiTrash2 className="h-3 w-3" /> Content already removed
              </span>
            ) : (
              <DangerButton
                label={`Delete ${TYPE_LABEL[report.entityType].toLowerCase()}`}
                confirmLabel="Delete for good?"
                icon={<FiTrash2 />}
                busy={busy === "delete"}
                onConfirm={removeContent}
              />
            ))}
          {reported && !reported.isSuspended && (
            <SuspendControl
              userId={reported._id}
              defaultReason={`Reported for ${report.reason}`}
              compact
              onChanged={(result) => onSuspended?.(report, result)}
            />
          )}
          {reported?.isSuspended && <span className="text-xs font-medium text-red-300">Account suspended</span>}
        </div>
      </div>
    </article>
  );
}

// What the reported thing said when it was reported.
function Snapshot({ type, snapshot }) {
  const s = snapshot ?? {};
  let title = null;
  let body = null;
  let meta = null;
  switch (type) {
    case "User":
      title = s.username ? `@${s.username}` : null;
      body = s.bio;
      meta = s.profile_pic_url ? (
        <a href={s.profile_pic_url} target="_blank" rel="noreferrer" className="link">
          Profile picture
        </a>
      ) : null;
      break;
    case "List":
      title = s.name;
      body = s.description;
      break;
    case "Review":
      body = s.text;
      meta = s.contentId ? `${s.contentType === "series" ? "Series" : "Movie"} · TMDB ${s.contentId}` : null;
      break;
    case "Share":
      title = s.title;
      body = s.text;
      meta = s.type ? `Post type: ${s.type}` : null;
      break;
    case "Message":
      body = s.text || (s.type && s.type !== "text" ? `[${s.type} card]` : null);
      meta = s.roomType ? (s.roomType === "dm" ? "Direct message" : "Community chat") : null;
      break;
    default:
      break;
  }
  if (!title && !body && !meta) return <p className="text-sm italic text-zinc-500">No snapshot was saved for this report.</p>;
  return (
    <div className="rounded-xl bg-zinc-950/60 px-4 py-3 ring-1 ring-zinc-800">
      {title && <div className="mb-1 font-semibold text-zinc-100">{title}</div>}
      {body ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">{body}</p> : <p className="text-sm italic text-zinc-500">No text</p>}
      {meta && <div className="mt-2 text-xs text-zinc-500">{meta}</div>}
    </div>
  );
}

// A person's moderation record (/admin/users/:id), in a new tab so the
// queue keeps its place.
export function UserLink({ person, className = "" }) {
  return (
    <a
      href={`/admin/users/${person._id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`hover:text-violet-300 hover:underline underline-offset-2 ${className}`}
      title={`Open @${person.username}`}
    >
      @{person.username}
    </a>
  );
}

function Avatar({ person, compact }) {
  const size = compact ? "h-8 w-8" : "h-10 w-10";
  if (person?.profile_pic_url) return <img src={person.profile_pic_url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-violet-300`}>
      {(person?.username ?? "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

function IdLine({ label, value }) {
  const copy = () => {
    navigator.clipboard?.writeText(String(value)).catch(() => {});
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 font-mono hover:text-zinc-300" title="Copy">
      {label}: {String(value)} <FiCopy className="h-3 w-3" />
    </button>
  );
}
