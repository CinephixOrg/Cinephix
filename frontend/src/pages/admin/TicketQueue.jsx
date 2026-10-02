import { useCallback, useEffect, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { getTicketStats, getTickets } from "../../api/adminService.js";
import AdminNav from "./AdminNav.jsx";
import TicketDetail from "./TicketDetail.jsx";
import TicketRow from "./TicketRow.jsx";
import { TICKET_STATUSES, TICKET_TYPES } from "./ticketMeta.js";

const PAGE_SIZE = 20;

// Support tickets: the queue on the left, the ticket you're answering on the
// right. Separate from the reports queue — these are people asking for help,
// not content to judge.
export default function TicketQueue({ me, onSignOut }) {
  const [status, setStatus] = useState("Open");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const loadStats = useCallback(() => {
    getTicketStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    getTickets({ status, type, page, limit: PAGE_SIZE })
      .then((next) => {
        setData(next);
        // Keep a ticket open across a refresh, or open the first one.
        setSelectedId((current) => (next.items.some((t) => t._id === current) ? current : (next.items[0]?._id ?? null)));
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [status, type, page]);

  useEffect(load, [load]);
  useEffect(loadStats, [loadStats]);

  const pick = (next) => {
    setPage(1);
    next();
  };

  // An answered ticket stays where it is, updated — the moderator is still
  // reading it — but the counts and its badge move.
  const onUpdated = (ticket) => {
    setData((d) => d && { ...d, items: d.items.map((item) => (item._id === ticket._id ? ticket : item)) });
    loadStats();
  };

  const selected = data?.items.find((ticket) => ticket._id === selectedId) ?? null;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 sm:px-6">
      <AdminNav
        me={me}
        onSignOut={onSignOut}
        right={
          <button onClick={() => { load(); loadStats(); }} className="btn btn-sm btn-ghost" aria-label="Refresh" title="Refresh">
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
        }
      />

      {/* Counts per status — also the status tabs. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        <StatusCard label="All" count={stats ? Object.values(stats.byStatus).reduce((a, b) => a + b, 0) : null} active={status === ""} onClick={() => pick(() => setStatus(""))} />
        {TICKET_STATUSES.map((s) => (
          <StatusCard
            key={s}
            label={s}
            count={stats?.byStatus?.[s] ?? null}
            highlight={s === "Open"}
            active={status === s}
            onClick={() => pick(() => setStatus(s))}
          />
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Chip active={!type} onClick={() => pick(() => setType(""))}>
          All types
        </Chip>
        {TICKET_TYPES.map((t) => (
          <Chip key={t} active={type === t} onClick={() => pick(() => setType(t))}>
            {t}
            {stats?.byType?.[t] ? <span className="ml-1.5 text-xs opacity-70">{stats.byType[t]}</span> : null}
          </Chip>
        ))}
      </div>

      {failed ? (
        <Empty>
          Couldn't load tickets.{" "}
          <button onClick={load} className="link text-violet-300">
            Try again
          </button>
        </Empty>
      ) : !data ? (
        <Empty>
          <span className="loading loading-spinner loading-md" />
        </Empty>
      ) : data.items.length === 0 ? (
        <Empty>{status === "Open" ? "No open tickets. Everything has been answered." : "No tickets match these filters."}</Empty>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className={`space-y-2 transition-opacity ${loading ? "opacity-60" : ""}`}>
            {data.items.map((ticket) => (
              <TicketRow key={ticket._id} ticket={ticket} active={ticket._id === selectedId} onClick={() => setSelectedId(ticket._id)} />
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-3 text-sm">
                <button className="btn btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span className="tabular-nums text-zinc-400">
                  {page} / {totalPages}
                </span>
                <button className="btn btn-sm" disabled={!data.hasMore || loading} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-6">
            {selected ? (
              <TicketDetail key={selected._id} ticket={selected} onUpdated={onUpdated} />
            ) : (
              <Empty>Pick a ticket to read it.</Empty>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({ label, count, active, highlight, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
        active ? "border-violet-500/60 bg-violet-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      }`}
    >
      <div className={`text-2xl font-bold tabular-nums ${highlight && count ? "text-amber-300" : ""}`}>{count ?? "–"}</div>
      <div className={`text-xs font-medium ${active ? "text-violet-300" : "text-zinc-400"}`}>{label}</div>
    </button>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active ? "border-zinc-200 bg-zinc-100 text-zinc-900" : "border-zinc-800 text-zinc-300 hover:border-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-16 text-center text-sm text-zinc-400">{children}</div>;
}
