import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiClock, FiGift, FiRefreshCw, FiSearch, FiXCircle } from "react-icons/fi";
import { extendTierGrant, getActiveGrants, getGrantLog, grantTier, revokeTierGrant, searchGrantUsers } from "../../api/adminService.js";
import AdminNav from "./AdminNav.jsx";
import DangerButton from "./DangerButton.jsx";

// /admin/grants — Plus or Premium for a limited time (alpha testers get an
// ad-free app this way). Find someone by username, grant / extend / revoke,
// and see every running grant and the audit log of changes.
//
// The server applies a grant to the account's tier directly and ends it by
// itself, so nothing here has to be remembered later.

const DURATIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "custom", label: "Until a date…" },
];

const TIER_STYLES = {
  premium: "bg-amber-400/15 text-amber-300",
  plus: "bg-sky-400/15 text-sky-300",
  dev: "bg-violet-400/15 text-violet-300",
  free: "bg-zinc-700/40 text-zinc-400",
};

const dateLabel = (value) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const timeLabel = (value) => new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** "12 days left", "ends today" — from the server's remainingMs. */
function remainingLabel(grant) {
  if (!grant) return "";
  const hours = grant.remainingMs / 3600000;
  if (hours < 24) return hours < 1 ? "ends within the hour" : `ends in ${Math.ceil(hours)} h`;
  return `${grant.remainingDays} days left`;
}

/** The duration picker's choice as the API's body: { days } or { expiresAt }. */
function durationBody(duration, customDate) {
  if (duration !== "custom") return { days: Number(duration) };
  // The end of the chosen day, local time.
  return customDate ? { expiresAt: new Date(`${customDate}T23:59:59`).toISOString() } : null;
}

function TierBadge({ tier }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TIER_STYLES[tier] ?? TIER_STYLES.free}`}>{tier}</span>;
}

export default function TierGrants({ me, onSignOut }) {
  const [active, setActive] = useState(null);
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(() => {
    setLoading(true);
    Promise.all([getActiveGrants(), getGrantLog({ limit: 15 })])
      .then(([grants, entries]) => {
        setActive(grants);
        setLog(entries);
      })
      .catch(() => toast.error("Couldn't load the grants"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(loadOverview, [loadOverview]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 sm:px-6">
      <AdminNav
        me={me}
        onSignOut={onSignOut}
        right={
          <button onClick={loadOverview} className="btn btn-sm btn-ghost" aria-label="Refresh" title="Refresh">
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
        }
      />

      <UserSearch onChanged={loadOverview} />

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          <FiClock /> Running grants {active ? <span className="text-zinc-500">({active.pagination.total})</span> : null}
        </h2>
        {active?.items.length === 0 && <p className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-500">No running grants.</p>}
        <div className="space-y-2">
          {active?.items.map((row) => (
            <UserRow key={row._id} row={row} onChanged={loadOverview} showGrantedBy />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Recent changes</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="table table-sm">
            <thead>
              <tr className="text-zinc-500">
                <th>When</th>
                <th>Action</th>
                <th>User</th>
                <th>Tier</th>
                <th>Ends</th>
                <th>By</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {log?.items.map((entry) => (
                <tr key={entry._id}>
                  <td className="whitespace-nowrap text-zinc-400">{timeLabel(entry.createdAt)}</td>
                  <td className="capitalize">{entry.action}</td>
                  <td>@{entry.username}</td>
                  <td className="whitespace-nowrap">
                    {entry.tierBefore} → {entry.tierAfter}
                  </td>
                  <td className="whitespace-nowrap text-zinc-400">{entry.expiresAtAfter ? dateLabel(entry.expiresAtAfter) : "—"}</td>
                  <td className="text-zinc-400">{entry.adminUsername ? `@${entry.adminUsername}` : "automatic"}</td>
                  <td className="max-w-[16rem] truncate text-zinc-400" title={entry.note ?? ""}>
                    {entry.note ?? ""}
                  </td>
                </tr>
              ))}
              {log?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-zinc-500">
                    Nothing yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UserSearch({ onChanged }) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!submitted) return;
    let cancelled = false;
    setBusy(true);
    searchGrantUsers(submitted, page)
      .then((next) => !cancelled && setResult(next))
      .catch((err) => !cancelled && toast.error(err?.response?.data?.message || "Search failed"))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [submitted, page]);

  const submit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setPage(1);
    setSubmitted(q);
  };

  // A row changed: show it updated in place, and refresh the overview.
  const replaceRow = (row) => {
    setResult((r) => r && { ...r, items: r.items.map((item) => (item._id === row._id ? row : item)) });
    onChanged();
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.pagination.total / result.pagination.limit)) : 1;

  return (
    <section>
      <form onSubmit={submit} className="flex gap-2">
        <label className="input input-bordered flex flex-1 items-center gap-2 bg-zinc-900">
          <FiSearch className="text-zinc-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username" className="grow" maxLength={50} />
        </label>
        <button type="submit" className="btn border-0 bg-violet-600 text-white hover:bg-violet-500" disabled={busy || !query.trim()}>
          {busy ? <span className="loading loading-spinner loading-sm" /> : "Search"}
        </button>
      </form>

      {result && (
        <div className="mt-3 space-y-2">
          {result.items.length === 0 && <p className="text-sm text-zinc-500">No usernames contain “{submitted}”.</p>}
          {result.items.map((row) => (
            <UserRow key={row._id} row={row} onChanged={replaceRow} />
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm text-zinc-400">
              <button className="btn btn-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              Page {page} of {totalPages}
              <button className="btn btn-xs" disabled={!result.pagination.hasMore} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** One person: their tier and grant, and what can be done about it. */
function UserRow({ row, onChanged, showGrantedBy = false }) {
  const grant = row.grant;
  const [tier, setTier] = useState(grant?.tier ?? "premium");
  const [duration, setDuration] = useState("30");
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null); // "grant" | "extend" | "revoke"

  const body = durationBody(duration, customDate);

  const run = async (kind, action, success) => {
    setBusy(kind);
    try {
      const updated = await action();
      toast.success(success(updated));
      setNote("");
      onChanged(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  const grantIt = () =>
    run("grant", () => grantTier(row._id, { tier, ...body, note: note.trim() || undefined }), (u) => `@${u.username}: ${tier} until ${dateLabel(u.grant.expiresAt)}`);
  const extendIt = () =>
    run("extend", () => extendTierGrant(row._id, { ...body, note: note.trim() || undefined }), (u) => `@${u.username}: extended to ${dateLabel(u.grant.expiresAt)}`);
  const revokeIt = () => run("revoke", () => revokeTierGrant(row._id), (u) => `@${u.username} is back to ${u.accountTier}`);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {row.profile_pic_url ? (
          <img src={row.profile_pic_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-400">{row.username?.[0]?.toUpperCase()}</div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">@{row.username}</span>
            <TierBadge tier={row.accountTier} />
          </div>
          <div className="text-xs text-zinc-400">
            {grant ? (
              <>
                Granted {grant.tier} until {dateLabel(grant.expiresAt)} · <span className="text-zinc-300">{remainingLabel(grant)}</span>
                {" · "}back to {grant.previousTier} after
                {showGrantedBy && grant.grantedBy?.username ? ` · by @${grant.grantedBy.username}` : ""}
                {grant.note ? ` · “${grant.note}”` : ""}
              </>
            ) : (
              "No grant"
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!grant && (
          <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Tier" className="select select-sm select-bordered bg-zinc-900">
            <option value="premium">Premium</option>
            <option value="plus">Plus</option>
          </select>
        )}
        <select value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Duration" className="select select-sm select-bordered bg-zinc-900">
          {DURATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {grant && d.value !== "custom" ? `+${d.label}` : d.label}
            </option>
          ))}
        </select>
        {duration === "custom" && (
          <input
            type="date"
            value={customDate}
            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            onChange={(e) => setCustomDate(e.target.value)}
            aria-label="End date"
            className="input input-sm input-bordered bg-zinc-900"
          />
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Note (optional)"
          className="input input-sm input-bordered w-full max-w-[14rem] bg-zinc-900"
        />
        {grant ? (
          <>
            <button type="button" className="btn btn-sm gap-1.5 border-0 bg-violet-600 text-white hover:bg-violet-500" disabled={!body || busy} onClick={extendIt}>
              {busy === "extend" ? <span className="loading loading-spinner loading-xs" /> : <FiClock />}
              Extend
            </button>
            <DangerButton label="Revoke" confirmLabel="Revoke now?" icon={<FiXCircle />} busy={busy === "revoke"} disabled={Boolean(busy)} onConfirm={revokeIt} />
          </>
        ) : (
          <button type="button" className="btn btn-sm gap-1.5 border-0 bg-violet-600 text-white hover:bg-violet-500" disabled={!body || busy} onClick={grantIt}>
            {busy === "grant" ? <span className="loading loading-spinner loading-xs" /> : <FiGift />}
            Grant {tier === "premium" ? "Premium" : "Plus"}
          </button>
        )}
      </div>
    </div>
  );
}
