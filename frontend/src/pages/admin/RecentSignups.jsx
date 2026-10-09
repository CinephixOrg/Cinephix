import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FiBell, FiCheckCircle, FiEye, FiGift, FiRefreshCw, FiSearch, FiUserPlus } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { getRecentSignupStats, getRecentSignups, revealUserEmail } from "../../api/adminService.js";
import AdminNav from "./AdminNav.jsx";

// /admin/signups — who joined lately, how, and whether they've started using
// the app: rated something, followed someone, joined a community, allowed
// notifications. Emails are masked unless revealed one at a time.
//
// "Last active" is the latest app start that registered for push (the
// server keeps no last-login time), or "online now" from the live socket.

const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];
const PAGE_SIZE = 25;
// violet-500: passes contrast and lightness checks against the zinc-900 surface.
const BAR = "#8b5cf6";

const TIER_STYLES = {
  premium: "bg-amber-400/15 text-amber-300",
  plus: "bg-sky-400/15 text-sky-300",
  dev: "bg-violet-400/15 text-violet-300",
  free: "bg-zinc-700/40 text-zinc-400",
};

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
/** "2 hours ago", "yesterday", "3 weeks ago". */
function timeAgo(value) {
  if (!value) return null;
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const steps = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let amount = seconds;
  for (const [size, unit] of steps) {
    if (Math.abs(amount) < size) return relative.format(Math.round(amount), unit);
    amount /= size;
  }
  return null;
}
const exact = (value) => new Date(value).toLocaleString();
const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function RecentSignups({ me, onSignOut }) {
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(7);
  const [method, setMethod] = useState("");
  const [verified, setVerified] = useState(false);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(() => {
    getRecentSignupStats()
      .then(setStats)
      .catch(() => toast.error("Couldn't load signup stats"));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    getRecentSignups({ days, method, verified, q, page, limit: PAGE_SIZE })
      .then(setData)
      .catch((err) => toast.error(err?.response?.data?.message || "Couldn't load signups"))
      .finally(() => setLoading(false));
  }, [days, method, verified, q, page]);

  useEffect(load, [load]);
  useEffect(loadStats, [loadStats]);

  // Any filter change starts again from the first page.
  const filter = (apply) => {
    setPage(1);
    apply();
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:px-6">
      <AdminNav
        me={me}
        onSignOut={onSignOut}
        right={
          <button onClick={() => { load(); loadStats(); }} className="btn btn-sm btn-ghost" aria-label="Refresh" title="Refresh">
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Today" value={stats?.today} />
          <StatTile label="Last 7 days" value={stats?.last7} />
          <StatTile label="Last 30 days" value={stats?.last30} />
        </div>
        <DailyChart daily={stats?.daily} />
      </div>

      {/* Filters, in one row above the table. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-zinc-900/70 p-1">
          {RANGES.map((range) => (
            <button
              key={range.days}
              onClick={() => filter(() => setDays(range.days))}
              className={`rounded-full px-3 py-1 text-sm ${days === range.days ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              {range.label}
            </button>
          ))}
        </div>
        <select value={method} onChange={(e) => filter(() => setMethod(e.target.value))} aria-label="Signup method" className="select select-sm select-bordered bg-zinc-900">
          <option value="">Any signup method</option>
          <option value="email">Email</option>
          <option value="google">Google</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" className="checkbox checkbox-sm" checked={verified} onChange={(e) => filter(() => setVerified(e.target.checked))} />
          Verified only
        </label>
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            filter(() => setQ(query.trim()));
          }}
        >
          <label className="input input-sm input-bordered flex items-center gap-2 bg-zinc-900">
            <FiSearch className="text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Username" maxLength={50} className="w-36" />
          </label>
          <button type="submit" className="btn btn-sm">
            Search
          </button>
        </form>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
        <table className="table table-sm">
          <thead>
            <tr className="text-zinc-500">
              <th>User</th>
              <th>Joined</th>
              <th>Signup</th>
              <th>Tier</th>
              <th className="text-right">Ratings</th>
              <th className="text-right">Following</th>
              <th className="text-right">Communities</th>
              <th className="text-right">Watchlist</th>
              <th title="Allowed notifications">Push</th>
              <th>Last active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <SignupRow key={row._id} row={row} />
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={11} className="py-6 text-center text-zinc-500">
                  Nobody matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="mt-3 flex items-center justify-between text-sm text-zinc-400">
          <span>{data.pagination.total} {data.pagination.total === 1 ? "person" : "people"}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button className="btn btn-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              Page {page} of {totalPages}
              <button className="btn btn-xs" disabled={!data.pagination.hasMore} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-100">{value ?? "–"}</div>
      <div className="text-xs text-zinc-500">signups</div>
    </div>
  );
}

/**
 * Signups per day for the last 30 days: one series, so no legend. Thin bars
 * with a rounded top on a shared baseline, a hover tooltip per day (the hit
 * area is the whole column, not just the bar), and a hidden table for screen
 * readers.
 */
function DailyChart({ daily }) {
  const [hover, setHover] = useState(null);
  const W = 600;
  const H = 120;
  const top = 14;
  const bottom = 18;
  const plotH = H - top - bottom;
  const n = daily?.length ?? 30;
  const slot = W / n;
  const barW = Math.max(2, slot * 0.7); // thin bars, clear gaps
  const max = Math.max(1, ...(daily ?? []).map((d) => d.count));
  const radius = Math.min(4, barW / 2);

  // A bar with only its top corners rounded, standing on the baseline.
  const barPath = (x, h) => {
    const y = top + plotH - h;
    if (h <= 0) return "";
    const r = Math.min(radius, h);
    return `M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${top + plotH} Z`;
  };

  return (
    <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Signups per day · last 30 days</div>
        <div className="text-xs text-zinc-500">peak {daily ? max : "–"}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" role="img" aria-label="Signups per day over the last 30 days" onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={W} y1={top + plotH + 0.5} y2={top + plotH + 0.5} stroke="#3f3f46" strokeWidth="1" />
        {daily?.map((d, i) => {
          const x = i * slot + (slot - barW) / 2;
          const h = (d.count / max) * plotH;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              <path d={barPath(x, h)} fill={BAR} opacity={hover === null || hover === i ? 1 : 0.45} />
              {d.count === 0 && <rect x={x} y={top + plotH - 1} width={barW} height={1} fill="#3f3f46" />}
            </g>
          );
        })}
        {daily && (
          <>
            <text x="0" y={H - 3} fill="#71717a" fontSize="10">
              {shortDate(daily[0].date)}
            </text>
            <text x={W} y={H - 3} fill="#71717a" fontSize="10" textAnchor="end">
              Today
            </text>
          </>
        )}
      </svg>
      {hover !== null && daily?.[hover] && (
        <div
          className="pointer-events-none absolute top-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 shadow-lg"
          style={{ left: `calc(${((hover + 0.5) / n) * 100}% )`, transform: "translateX(-50%)" }}
        >
          <span className="font-semibold tabular-nums">{daily[hover].count}</span> on {shortDate(daily[hover].date)}
        </div>
      )}
      <table className="sr-only">
        <caption>Signups per day</caption>
        <tbody>
          {daily?.map((d) => (
            <tr key={d.date}>
              <th>{d.date}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignupRow({ row }) {
  const [email, setEmail] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const a = row.activity;

  const reveal = async () => {
    setRevealing(true);
    try {
      setEmail(await revealUserEmail(row._id));
    } catch {
      toast.error("Couldn't load that email");
    } finally {
      setRevealing(false);
    }
  };

  const lastActive = a.onlineNow ? (
    <span className="inline-flex items-center gap-1.5 text-emerald-300">
      <span className="h-2 w-2 rounded-full bg-emerald-400" /> Online now
    </span>
  ) : a.lastAppOpenAt ? (
    <span title={`App opened ${exact(a.lastAppOpenAt)}`}>{timeAgo(a.lastAppOpenAt)}</span>
  ) : (
    <span className="text-zinc-600" title="Hasn't opened the app with notifications set up">—</span>
  );

  return (
    <tr className="align-middle">
      <td>
        <div className="flex items-center gap-2.5">
          {row.profile_pic_url ? (
            <img src={row.profile_pic_url} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-400">{row.username?.[0]?.toUpperCase()}</div>
          )}
          <div className="min-w-0">
            <Link to={`/admin/users/${row._id}`} target="_blank" className="font-medium hover:underline">
              @{row.username}
            </Link>
            {row.isSuspended && <span className="ml-1.5 rounded bg-red-500/15 px-1.5 text-[10px] font-semibold uppercase text-red-300">suspended</span>}
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              {email ?? row.emailMasked}
              {!email && (
                <button onClick={reveal} disabled={revealing} className="text-zinc-500 hover:text-zinc-200" title="Show email" aria-label="Show email">
                  <FiEye className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap" title={exact(row.createdAt)}>
        {timeAgo(row.createdAt)}
      </td>
      <td className="whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {row.signupMethod === "google" ? <FcGoogle /> : <FiUserPlus className="text-zinc-400" />}
          {row.signupMethod === "google" ? "Google" : "Email"}
          {row.signupMethod === "email" && row.googleLinked && <span className="text-xs text-zinc-500">+ Google</span>}
        </div>
        {row.emailVerified ? (
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-emerald-300">
            <FiCheckCircle className="h-3 w-3" /> verified
          </span>
        ) : (
          <span className="mt-0.5 inline-block text-xs text-amber-300">not verified</span>
        )}
      </td>
      <td className="whitespace-nowrap">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TIER_STYLES[row.accountTier] ?? TIER_STYLES.free}`}>{row.accountTier}</span>
        {row.tierGrantExpiresAt && <div className="mt-0.5 text-xs text-zinc-500">granted until {new Date(row.tierGrantExpiresAt).toLocaleDateString()}</div>}
      </td>
      <Count value={a.ratings} />
      <Count value={a.following} />
      <Count value={a.communities} />
      <Count value={a.watchlist} />
      <td title={a.hasPushToken ? "Notifications on" : "No notifications"}>
        <FiBell className={a.hasPushToken ? "text-zinc-200" : "text-zinc-700"} aria-label={a.hasPushToken ? "Notifications on" : "No notifications"} />
      </td>
      <td className="whitespace-nowrap text-sm">{lastActive}</td>
      <td className="text-right">
        <Link
          to={`/admin/grants?q=${encodeURIComponent(row.username)}`}
          className="btn btn-xs gap-1 border-0 bg-violet-600/20 text-violet-200 hover:bg-violet-600/40"
          title="Open the grant form for this user"
        >
          <FiGift /> Grant premium
        </Link>
      </td>
    </tr>
  );
}

/** An activation count: zero recedes, anything else reads. */
function Count({ value }) {
  return <td className={`text-right tabular-nums ${value > 0 ? "text-zinc-200" : "text-zinc-600"}`}>{value}</td>;
}
