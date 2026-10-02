import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiFlag } from "react-icons/fi";
import { decideReport, getReports } from "../../api/adminService.js";
import ReportCard from "./ReportCard.jsx";

const PAGE_SIZE = 10;
const SIDES = [
  { key: "against", label: "About them", param: "reportedUserId" },
  { key: "filed", label: "Filed by them", param: "reporterId" },
];

// The moderator's half of /admin/users/:id: this person's report history
// both ways, in any status, decidable without leaving their profile. Sticks
// alongside the profile on a wide screen; stacks under it on a narrow one.
export default function ModerationPanel({ userId, summary, onDecided, onSuspensionChanged }) {
  const [side, setSide] = useState("against");
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  const param = SIDES.find((s) => s.key === side).param;

  const load = useCallback(
    (page = 1) => getReports({ status: "all", [param]: userId, page, limit: PAGE_SIZE }),
    [param, userId]
  );

  useEffect(() => {
    let cancelled = false;
    setState(null);
    load(1)
      .then((data) => !cancelled && setState({ ...data, page: 1 }))
      .catch(() => !cancelled && setState({ items: [], total: 0, hasMore: false, page: 1, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [load]);

  // A removal or a suspension closes reports server-side; re-read rather
  // than guessing which rows changed.
  const reload = () => {
    load(1)
      .then((data) => setState({ ...data, page: 1 }))
      .catch(() => {});
    onDecided?.();
  };

  const more = async () => {
    setBusy(true);
    try {
      const next = await load(state.page + 1);
      setState((cur) => ({ ...next, items: [...cur.items, ...next.items], page: cur.page + 1 }));
    } catch {
      toast.error("Couldn't load more reports");
    } finally {
      setBusy(false);
    }
  };

  // Every status is listed here, so a decided report stays put, updated.
  const decide = async (report, nextStatus, note) => {
    try {
      const updated = await decideReport(report._id, nextStatus, note);
      toast.success(nextStatus === "pending" ? "Report reopened" : `Report ${nextStatus}`);
      setState((cur) => cur && { ...cur, items: cur.items.map((r) => (r._id === report._id ? updated : r)) });
      onDecided?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't update the report");
      throw err;
    }
  };

  const against = summary?.reportsAgainst ?? {};

  return (
    <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          <FiFlag className="h-4 w-4 text-red-400" /> Moderation
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Pending" value={against.pending ?? 0} highlight={(against.pending ?? 0) > 0} />
          <Stat label="Resolved" value={against.resolved ?? 0} />
          <Stat label="Dismissed" value={against.dismissed ?? 0} />
          <Stat label="They filed" value={summary?.reportsFiled ?? 0} />
        </div>

        <div className="mt-4 flex gap-2">
          {SIDES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSide(s.key)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                side === s.key ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-3">
          {!state ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-sm" />
            </div>
          ) : state.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-8 text-center text-xs text-zinc-500">
              {state.failed
                ? "Couldn't load reports."
                : side === "against"
                  ? "Nobody has reported this account."
                  : "This account hasn't reported anyone."}
            </p>
          ) : (
            <>
              {state.items.map((report) => (
                <ReportCard
                  key={report._id}
                  report={report}
                  onDecide={decide}
                  onRemoved={reload}
                  onSuspended={(_report, result) => {
                    reload();
                    onSuspensionChanged?.(result);
                  }}
                  compact
                />
              ))}
              {state.hasMore && (
                <button className="btn btn-sm w-full" disabled={busy} onClick={more}>
                  {busy ? <span className="loading loading-spinner loading-xs" /> : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
      <div className={`text-lg font-bold tabular-nums ${highlight ? "text-amber-300" : ""}`}>{value}</div>
      <div className="text-[11px] text-zinc-500">{label}</div>
    </div>
  );
}
