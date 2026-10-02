import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiLogOut, FiRefreshCw } from "react-icons/fi";
import AdminNav from "./AdminNav.jsx";
import { decideReport, getReportStats, getReports } from "../../api/adminService.js";
import ReportCard from "./ReportCard.jsx";

const STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];
// Mirrors backend models/Report.js REPORT_ENTITY_TYPES ("Comment" is reserved
// for a feature that doesn't exist yet, so it isn't offered).
const TYPES = ["User", "Review", "Share", "List", "Message"];
const TYPE_LABEL = { User: "Profiles", Review: "Reviews", Share: "Media posts", List: "Lists", Message: "Messages" };
const PAGE_SIZE = 20;

// The report queue: counts up top, a status tab and a type filter, then the
// reports newest first. A decision takes the report out of the tab it no
// longer belongs to and refreshes the counts.
export default function ReportQueue({ me, onSignOut }) {
  const [status, setStatus] = useState("pending");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null); // { items, total, hasMore }
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [stats, setStats] = useState(null);

  const loadStats = useCallback(() => {
    getReportStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    getReports({ status, entityType, page, limit: PAGE_SIZE })
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [status, entityType, page]);

  useEffect(load, [load]);
  useEffect(loadStats, [loadStats]);

  const refresh = () => {
    load();
    loadStats();
  };

  const pick = (next) => {
    setPage(1);
    next();
  };

  const decide = async (report, nextStatus, note) => {
    try {
      await decideReport(report._id, nextStatus, note);
      toast.success(nextStatus === "pending" ? "Report reopened" : `Report ${nextStatus}`);
      // It no longer belongs in this tab.
      setData((d) => d && { ...d, items: d.items.filter((r) => r._id !== report._id), total: Math.max(0, d.total - 1) });
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't update the report");
      throw err;
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <AdminNav
        me={me}
        onSignOut={onSignOut}
        right={
          <button onClick={refresh} className="btn btn-sm btn-ghost" aria-label="Refresh" title="Refresh">
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
        }
      />

      {/* Counts per status — also the status tabs. */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {STATUSES.map((s) => {
          const active = status === s.key;
          return (
            <button
              key={s.key}
              onClick={() => pick(() => setStatus(s.key))}
              className={`rounded-xl border px-3 py-3 text-left transition-colors sm:px-4 ${
                active ? "border-violet-500/60 bg-violet-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
              }`}
            >
              <div className={`text-2xl font-bold tabular-nums ${s.key === "pending" && stats?.byStatus?.pending ? "text-amber-300" : ""}`}>
                {stats ? (stats.byStatus?.[s.key] ?? 0) : "–"}
              </div>
              <div className={`text-xs font-medium ${active ? "text-violet-300" : "text-zinc-400"}`}>{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Type filter; pending counts only mean something on the Pending tab. */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Chip active={!entityType} onClick={() => pick(() => setEntityType(""))}>
          All types
        </Chip>
        {TYPES.map((type) => (
          <Chip key={type} active={entityType === type} onClick={() => pick(() => setEntityType(type))}>
            {TYPE_LABEL[type]}
            {status === "pending" && stats?.pendingByType?.[type] ? (
              <span className="ml-1.5 rounded-full bg-amber-400/20 px-1.5 text-[11px] font-semibold text-amber-300">{stats.pendingByType[type]}</span>
            ) : null}
          </Chip>
        ))}
      </div>

      {failed ? (
        <Empty>
          Couldn't load reports.{" "}
          <button onClick={load} className="link text-violet-300">
            Try again
          </button>
        </Empty>
      ) : !data ? (
        <Empty>
          <span className="loading loading-spinner loading-md" />
        </Empty>
      ) : data.items.length === 0 ? (
        <Empty>{status === "pending" ? "Nothing to review. The queue is clear." : `No ${status} reports${entityType ? ` for ${TYPE_LABEL[entityType].toLowerCase()}` : ""}.`}</Empty>
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {data.items.map((report) => (
            <ReportCard
              key={report._id}
              report={report}
              onDecide={decide}
              onRemoved={refresh}
              onSuspended={refresh}
            />
          ))}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button className="btn btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="tabular-nums text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button className="btn btn-sm" disabled={!data.hasMore || loading} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
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

export function SignOutButton({ onClick, className = "w-full" }) {
  return (
    <button onClick={onClick} className={`btn btn-sm btn-ghost gap-2 text-zinc-300 ${className}`}>
      <FiLogOut /> Sign out
    </button>
  );
}
