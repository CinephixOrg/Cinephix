import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { FiAlertTriangle, FiArrowLeft, FiSlash, FiTrash2 } from "react-icons/fi";
import DangerButton from "./DangerButton.jsx";
import SuspendControl from "./SuspendControl.jsx";
import {
  getAdminCineGraph,
  getAdminCollections,
  getAdminFavorites,
  getAdminProfile,
  getAdminReviews,
  getAdminShares,
  getAdminUser,
  deleteContent,
  setSuspension,
} from "../../api/adminService.js";
import AdminNav from "./AdminNav.jsx";
import ModerationPanel from "./ModerationPanel.jsx";
import { CineGraphPanel, Empty, ListCard, PosterGrid, ReviewItem, SectionCount, ShareItem } from "./profile/ProfileParts.jsx";
import { topGenres } from "./profile/profileHelpers.js";

const SHARES_PAGE = 10;
const REVIEWS_PAGE = 20;

// /admin/users/:id — the person as the app shows them, for a moderator with
// a report to judge.
//
// The main column is their public profile rebuilt for desktop: the same
// header, the same tabs (posts, reviews, favorites, lists, watched list,
// watchlist, CineGraph) and the same data, read through /admin so the block
// filter is off and private lists are included. The right column is the
// moderation panel: their report history both ways, with the decisions.
//
// Admin-only, checked on the server for every call (requireAdmin).
export default function AdminUserPage({ me, onSignOut }) {
  const { id } = useParams();
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [cineGraph, setCineGraph] = useState(null);
  const [favorites, setFavorites] = useState(null);
  const [collections, setCollections] = useState(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState("posts");

  const loadSummary = useCallback(() => getAdminUser(id).then(setSummary), [id]);

  const load = useCallback(() => {
    setFailed(false);
    setProfile(null);
    Promise.all([
      loadSummary(),
      getAdminProfile(id).then((p) => {
        setProfile(p);
        document.title = `@${p.username} · Cinephix Moderation`;
      }),
      getAdminCineGraph(id).then(setCineGraph),
      getAdminFavorites(id).then(setFavorites),
      getAdminCollections(id).then(setCollections),
    ]).catch(() => setFailed(true));
  }, [id, loadSummary]);

  useEffect(load, [load]);

  const [removed, setRemoved] = useState(() => new Set());
  const forget = (id) => setRemoved((current) => new Set(current).add(id));

  const genres = useMemo(() => topGenres(cineGraph), [cineGraph]);
  const favoriteItems = useMemo(
    () => [
      ...(favorites?.movies ?? []).map((m) => ({ key: `m${m._id}`, poster_path: m.poster_path, title: m.title, rating: m.rating, subtitle: "Movie" })),
      ...(favorites?.series ?? []).map((s) => ({ key: `s${s._id}`, poster_path: s.poster_path, title: s.name ?? s.title, rating: s.rating, subtitle: "Series" })),
    ],
    [favorites]
  );

  const TABS = [
    { key: "posts", label: "Posts" },
    { key: "reviews", label: "Reviews" },
    { key: "favorites", label: "Favorites", count: favoriteItems.length },
    { key: "lists", label: "Lists", count: collections?.lists?.length },
    { key: "watched", label: "Watched list", count: collections?.watched?.total },
    { key: "watchlist", label: "Watchlist", count: collections?.watchlist?.total },
    { key: "cinegraph", label: "CineGraph" },
  ];

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 sm:px-6">
      <AdminNav
        me={me}
        onSignOut={onSignOut}
        right={
          <Link to="/admin" className="btn btn-sm btn-ghost gap-1.5 text-zinc-300" title="Back to the queue">
            <FiArrowLeft /> Queue
          </Link>
        }
      />

      {failed ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-16 text-center text-sm text-zinc-400">
          This account couldn't be loaded — it may have been deleted.{" "}
          <button onClick={load} className="link text-violet-300">
            Try again
          </button>
        </div>
      ) : !profile ? (
        <div className="flex justify-center py-24">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <main className="min-w-0">
            <ProfileHeader profile={profile} summary={summary} genres={genres} onSuspensionChanged={loadSummary} />

            <nav className="mt-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                    tab === t.key ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {t.label}
                  {t.count ? <span className="ml-1.5 text-xs opacity-70">{t.count}</span> : null}
                </button>
              ))}
            </nav>

            <section className="mt-5">
              {tab === "posts" && <SharesTab userId={id} removed={removed} onRemoved={forget} />}
              {tab === "reviews" && <ReviewsTab userId={id} removed={removed} onRemoved={forget} />}
              {tab === "favorites" && (
                <>
                  <SectionCount shown={favoriteItems.length} total={favoriteItems.length} noun="favorites" />
                  <PosterGrid items={favoriteItems} empty="No favorites." />
                </>
              )}
              {tab === "lists" && (
                <div className="space-y-3">
                  {collections?.lists?.length ? (
                    collections.lists
                      .filter((list) => !removed.has(list._id))
                      .map((list) => (
                        <div key={list._id} className="space-y-2">
                          <ListCard list={list} />
                          <RemoveRow type="list" id={list._id} label="Delete list" onRemoved={forget} />
                        </div>
                      ))
                  ) : (
                    <Empty>No lists.</Empty>
                  )}
                </div>
              )}
              {tab === "watched" && <CollectionTab collection={collections?.watched} noun="watched titles" empty="Nothing watched yet." />}
              {tab === "watchlist" && <CollectionTab collection={collections?.watchlist} noun="titles on the watchlist" empty="Watchlist is empty." />}
              {tab === "cinegraph" && <CineGraphPanel cineGraph={cineGraph} />}
            </section>
          </main>

          <ModerationPanel userId={id} summary={summary} onDecided={loadSummary} onSuspensionChanged={loadSummary} />
        </div>
      )}
    </div>
  );
}

// The app's profile header, on a desktop row: picture, @username, the
// counts, their bio and top genres — plus what only a moderator sees
// (email, join date, account flags).
function ProfileHeader({ profile, summary, genres, onSuspensionChanged }) {
  const pending = summary?.reportsAgainst?.pending ?? 0;
  const suspended = Boolean(summary?.isSuspended);
  const [busy, setBusy] = useState(false);

  const lift = async () => {
    setBusy(true);
    try {
      const result = await setSuspension(profile._id, false);
      toast.success("Suspension lifted");
      onSuspensionChanged?.(result);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't lift the suspension");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
      {suspended && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <span className="font-semibold">
            {summary?.suspendedUntil
              ? `Suspended until ${format(new Date(summary.suspendedUntil), "d MMM yyyy, HH:mm")}`
              : "Suspended permanently"}
          </span>
          {summary?.suspensionReason ? ` — ${summary.suspensionReason}` : ""}
        </div>
      )}
      {pending > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-300">
          <FiAlertTriangle className="h-4 w-4 shrink-0" />
          {pending} pending {pending === 1 ? "report" : "reports"} about this account.
        </div>
      )}
      <div className="flex flex-wrap items-start gap-5">
        {profile.profile_pic_url ? (
          <a href={profile.profile_pic_url} target="_blank" rel="noopener noreferrer" title="Open full size">
            <img src={profile.profile_pic_url} alt="" className="h-28 w-28 rounded-full object-cover ring-2 ring-zinc-700" />
          </a>
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-zinc-800 text-3xl font-bold text-violet-300">
            {profile.username.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold">@{profile.username}</h1>
            <Tag className="bg-zinc-800 text-zinc-300">{profile.accountTier ?? "free"}</Tag>
            {profile.isOfficial && <Tag className="bg-sky-500/15 text-sky-300">Official</Tag>}
            {summary?.isAdmin && <Tag className="bg-violet-500/15 text-violet-300">Admin</Tag>}
          </div>

          <div className="mt-3 flex flex-wrap gap-6 text-sm">
            <Count value={profile.followers?.length ?? summary?.followersCount ?? 0} label="followers" />
            <Count value={profile.following?.length ?? summary?.followingCount ?? 0} label="following" />
            <Count value={summary?.reportsAgainst ? Object.values(summary.reportsAgainst).reduce((a, b) => a + b, 0) : 0} label="reports about them" />
          </div>

          {profile.bio ? (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">{profile.bio}</p>
          ) : (
            <p className="mt-3 text-sm italic text-zinc-600">No bio</p>
          )}

          {genres.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {genres.map((genre) => (
                <span key={genre} className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                  {genre}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
            {profile.email && <span>{profile.email}</span>}
            <span>Joined {profile.createdAt ? format(new Date(profile.createdAt), "d MMM yyyy") : "—"}</span>
            <span className="font-mono">User id: {profile._id}</span>
          </div>
        </div>
      </div>

      {/* Suspending blocks their access to the app immediately: the next
          request they make is refused and the app signs itself out. */}
      {profile.isOfficial || summary?.isAdmin ? null : (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
          {suspended ? (
            <button disabled={busy} onClick={lift} className="btn btn-sm gap-1.5">
              {busy ? <span className="loading loading-spinner loading-xs" /> : <FiSlash />} Lift suspension
            </button>
          ) : (
            <SuspendControl userId={profile._id} onChanged={onSuspensionChanged} />
          )}
        </div>
      )}
    </section>
  );
}

/** The delete control under one piece of their content. */
function RemoveRow({ type, id, label, onRemoved }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      const result = await deleteContent(type, id);
      toast.success(result.reportsResolved ? `Removed, ${result.reportsResolved} report(s) closed` : "Removed");
      onRemoved(id);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't remove that");
      setBusy(false);
    }
  };
  return (
    <div className="flex justify-end">
      <DangerButton label={label} confirmLabel="Delete for good?" icon={<FiTrash2 />} busy={busy} onConfirm={remove} />
    </div>
  );
}

function Tag({ className, children }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${className}`}>{children}</span>;
}

function Count({ value, label }) {
  return (
    <span className="text-zinc-400">
      <b className="text-base text-zinc-100 tabular-nums">{value}</b> {label}
    </span>
  );
}

// Watched list / watchlist: the app sends the most recent 60 with their
// titles, and the real total.
function CollectionTab({ collection, noun, empty }) {
  if (!collection) return <Empty>{empty}</Empty>;
  const items = (collection.items ?? []).map((item) => ({
    key: `${item.itemType}${item.itemId}`,
    poster_path: item.poster_path,
    title: item.title,
    subtitle: item.itemType === "series" ? "Series" : "Movie",
  }));
  return (
    <>
      <SectionCount shown={items.length} total={collection.total} noun={noun} />
      <PosterGrid items={items} empty={empty} />
    </>
  );
}

function SharesTab({ userId, removed, onRemoved }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState(null);
    getAdminShares(userId, 1, SHARES_PAGE)
      .then((data) => !cancelled && setState({ ...data, page: 1 }))
      .catch(() => !cancelled && setState({ items: [], total: 0, hasMore: false, page: 1, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const more = async () => {
    setBusy(true);
    try {
      const next = await getAdminShares(userId, state.page + 1, SHARES_PAGE);
      setState((cur) => ({ ...next, items: [...cur.items, ...next.items], page: cur.page + 1 }));
    } catch {
      toast.error("Couldn't load more posts");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Feed
      state={state}
      busy={busy}
      onMore={more}
      noun="posts"
      empty="They haven't posted anything."
      removed={removed}
      render={(share) => (
        <div key={share._id} className="space-y-2">
          <ShareItem share={share} />
          <RemoveRow type="share" id={share._id} label="Delete post" onRemoved={onRemoved} />
        </div>
      )}
    />
  );
}

function ReviewsTab({ userId, removed, onRemoved }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState(null);
    getAdminReviews(userId, 1, REVIEWS_PAGE)
      .then((data) => !cancelled && setState({ ...data, page: 1 }))
      .catch(() => !cancelled && setState({ items: [], total: 0, hasMore: false, page: 1, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const more = async () => {
    setBusy(true);
    try {
      const next = await getAdminReviews(userId, state.page + 1, REVIEWS_PAGE);
      setState((cur) => ({ ...next, items: [...cur.items, ...next.items], page: cur.page + 1 }));
    } catch {
      toast.error("Couldn't load more reviews");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Feed
      state={state}
      busy={busy}
      onMore={more}
      noun="reviews"
      empty="They haven't written any reviews."
      removed={removed}
      render={(review) => (
        <div key={review._id} className="space-y-2">
          <ReviewItem review={review} />
          <RemoveRow type="review" id={review._id} label="Delete review" onRemoved={onRemoved} />
        </div>
      )}
    />
  );
}

// Shared by the two paged tabs: spinner, count, items, Load more.
function Feed({ state, busy, onMore, noun, empty, render, removed }) {
  if (!state) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-md" />
      </div>
    );
  }
  if (state.failed) return <Empty>Couldn't load their {noun}.</Empty>;
  // Anything a moderator just removed leaves the list without a refetch.
  const items = removed ? state.items.filter((item) => !removed.has(item._id)) : state.items;
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <>
      <SectionCount shown={items.length} total={state.total} noun={noun} />
      <div className="space-y-3">{items.map(render)}</div>
      {state.hasMore && (
        <div className="flex justify-center pt-4">
          <button className="btn btn-sm" disabled={busy} onClick={onMore}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
