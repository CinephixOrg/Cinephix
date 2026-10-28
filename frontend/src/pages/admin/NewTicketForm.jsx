import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiPlus, FiSearch, FiX } from "react-icons/fi";
import { createTicket, searchUsers } from "../../api/adminService.js";
import { TICKET_STATUSES } from "./ticketMeta.js";

// The limits the server holds a manual ticket to (backend utils/ticketRules.js).
const MANUAL_TYPES = ["Bug Report", "Feature Request"];
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4000;
const MAX_SOURCE = 200;

const EMPTY = { type: "Bug Report", title: "", description: "", status: "Open", source: "" };

// Adding a ticket by hand: a bug or an idea that came in some other way — a
// friend, a message, a call. It joins the queue like any other ticket but
// stays internal: the reporter, if one is picked, never sees it in their app
// and is never notified about it.
export default function NewTicketForm({ open, onClose, onCreated }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [reporter, setReporter] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setReporter(null);
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const canSave = form.title.trim() && form.description.trim() && !busy;

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    try {
      const ticket = await createTicket({
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        ...(reporter ? { reporterId: reporter._id } : {}),
        ...(form.source.trim() ? { source: form.source.trim() } : {}),
      });
      toast.success("Ticket added");
      onCreated(ticket);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't add the ticket");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="modal" onClose={onClose}>
      <form onSubmit={save} className="modal-box max-w-xl border border-zinc-800 bg-zinc-900 text-zinc-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">New ticket</h2>
          <button type="button" onClick={onClose} className="btn btn-sm btn-ghost" aria-label="Close">
            <FiX />
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Internal: the reporter never sees it in the app and isn't notified.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <select value={form.type} onChange={set("type")} className="select select-sm select-bordered w-full bg-zinc-900">
              {MANUAL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set("status")} className="select select-sm select-bordered w-full bg-zinc-900">
              {TICKET_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Title" className="mt-3">
          <input value={form.title} onChange={set("title")} maxLength={MAX_TITLE} required className="input input-sm input-bordered w-full bg-zinc-900" />
        </Field>

        <Field label="Description" className="mt-3">
          <textarea
            value={form.description}
            onChange={set("description")}
            maxLength={MAX_DESCRIPTION}
            required
            rows={6}
            className="textarea textarea-bordered w-full bg-zinc-900 text-sm"
          />
        </Field>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Reporter (optional)" as="div">
            <ReporterPicker value={reporter} onChange={setReporter} />
          </Field>
          <Field label="Source (optional)">
            <input
              value={form.source}
              onChange={set("source")}
              maxLength={MAX_SOURCE}
              placeholder="e.g. Friend feedback"
              className="input input-sm input-bordered w-full bg-zinc-900"
            />
          </Field>
        </div>

        <div className="modal-action">
          <button type="button" onClick={onClose} className="btn btn-sm btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="btn btn-sm gap-1.5 border-0 bg-violet-600 text-white hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {busy ? <span className="loading loading-spinner loading-xs" /> : <FiPlus />}
            Add ticket
          </button>
        </div>
      </form>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close">close</button>
      </form>
    </dialog>
  );
}

// A labelled field. `as="div"` for one holding buttons, which a <label>
// would click on any click inside it.
function Field({ label, as = "label", className = "", children }) {
  const caption = <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>;
  return as === "div" ? (
    <div className={`block ${className}`}>
      {caption}
      {children}
    </div>
  ) : (
    <label className={`block ${className}`}>
      {caption}
      {children}
    </label>
  );
}

// Finding the reporter by username, as you type.
function ReporterPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      setSearching(true);
      searchUsers(q)
        .then((items) => live && setResults(items))
        .catch(() => live && setResults([]))
        .finally(() => live && setSearching(false));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex h-8 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm">
        <span className="truncate">@{value.username}</span>
        <span className="text-xs capitalize text-zinc-500">{value.accountTier ?? "free"}</span>
        <button type="button" onClick={() => onChange(null)} className="ml-auto text-zinc-400 hover:text-zinc-100" aria-label="Remove reporter">
          <FiX />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="input input-sm input-bordered flex items-center gap-2 bg-zinc-900">
        {searching ? <span className="loading loading-spinner loading-xs" /> : <FiSearch className="text-zinc-500" />}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username" maxLength={50} className="grow" />
      </div>
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-xl">
          {results.map((user) => (
            <li key={user._id}>
              <button
                type="button"
                onClick={() => {
                  onChange(user);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-800"
              >
                @{user.username}
                <span className="ml-auto text-xs capitalize text-zinc-500">{user.accountTier ?? "free"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
