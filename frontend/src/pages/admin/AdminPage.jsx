import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiLock, FiShield } from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getMe } from "../../api/adminService.js";
import ReportQueue, { SignOutButton } from "./ReportQueue.jsx";
import AdminUserPage from "./AdminUserPage.jsx";
import TicketQueue from "./TicketQueue.jsx";
import TierGrants from "./TierGrants.jsx";
import RecentSignups from "./RecentSignups.jsx";

// /admin — the moderation dashboard. Internal, English only.
//
// Access is decided by the server, not this page: the user is re-read from
// /users/me on every visit (a stored copy could predate losing admin), and
// every moderation call is checked again by the API's requireAdmin. Admin is
// granted from the server only: `node backend/scripts/setAdmin.js <user> on`.
//
// The views behind the same check: the reports queue, the support ticket
// queue (/admin/tickets), time-limited Plus/Premium grants (/admin/grants),
// recent signups (/admin/signups), and one person's record (/admin/users/:id), which opens in its own tab
// from a report card or a ticket.
export default function AdminPage({ view = "queue" }) {
  const { user, logout } = useContext(AuthContext);
  const [state, setState] = useState({ status: "checking", me: null });

  useEffect(() => {
    if (!user?.token) {
      setState({ status: "signed-out", me: null });
      return;
    }
    let cancelled = false;
    setState({ status: "checking", me: null });
    getMe()
      .then((me) => !cancelled && setState({ status: me?.isAdmin ? "admin" : "forbidden", me }))
      .catch((err) => {
        if (cancelled) return;
        // An expired or revoked token: sign in again.
        if (err?.response?.status === 401) {
          logout();
          setState({ status: "signed-out", me: null });
        } else {
          setState({ status: "error", me: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-theme="black" className="min-h-screen bg-zinc-950 text-zinc-100">
      {state.status === "admin" ? (
        view === "user" ? (
          <AdminUserPage me={state.me} onSignOut={logout} />
        ) : view === "tickets" ? (
          <TicketQueue me={state.me} onSignOut={logout} />
        ) : view === "grants" ? (
          <TierGrants me={state.me} onSignOut={logout} />
        ) : view === "signups" ? (
          <RecentSignups me={state.me} onSignOut={logout} />
        ) : (
          <ReportQueue me={state.me} onSignOut={logout} />
        )
      ) : (
        <div className="flex min-h-screen items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex items-center justify-center gap-2 text-zinc-300">
              <FiShield className="h-5 w-5 text-violet-400" />
              <span className="text-sm font-semibold uppercase tracking-[0.2em]">Cinephix Moderation</span>
            </div>
            {state.status === "checking" && <Centered>Checking access…</Centered>}
            {state.status === "signed-out" && <AdminLogin />}
            {state.status === "forbidden" && (
              <Panel>
                <FiLock className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
                <h1 className="mb-2 text-center text-lg font-semibold">Admins only</h1>
                <p className="mb-5 text-center text-sm leading-relaxed text-zinc-400">
                  @{state.me?.username} isn't a moderator. An admin is granted from the server with{" "}
                  <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">node backend/scripts/setAdmin.js {state.me?.username} on</code>
                  , then sign in again.
                </p>
                <SignOutButton onClick={logout} />
              </Panel>
            )}
            {state.status === "error" && (
              <Panel>
                <p className="mb-5 text-center text-sm text-zinc-400">Couldn't reach the server. Is the backend running?</p>
                <button className="btn btn-sm w-full" onClick={() => window.location.reload()}>
                  Try again
                </button>
              </Panel>
            )}
            <p className="mt-6 text-center text-xs text-zinc-600">
              <Link to="/" className="hover:text-zinc-400">
                ← cinephix
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminLogin() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      // AdminPage re-checks access as soon as the token lands.
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't sign in.");
      setBusy(false);
    }
  };

  return (
    <Panel>
      <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
      <p className="mb-5 text-sm text-zinc-400">Use your Cinephix account's email and password.</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          autoComplete="username"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input input-bordered w-full bg-zinc-900"
        />
        <input
          type="password"
          autoComplete="current-password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input input-bordered w-full bg-zinc-900"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={busy} className="btn w-full border-0 bg-violet-600 text-white hover:bg-violet-500">
          {busy ? <span className="loading loading-spinner loading-sm" /> : "Sign in"}
        </button>
      </form>
    </Panel>
  );
}

function Panel({ children }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">{children}</div>;
}

function Centered({ children }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-zinc-400">
      <span className="loading loading-spinner loading-sm" />
      {children}
    </div>
  );
}
