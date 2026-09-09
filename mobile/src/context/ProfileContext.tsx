import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { getCineGraph, getUserProfile } from "../api/userService";
import { getFavorites } from "../api/favoriteService";
import { getUserShares } from "../api/shareService";
import type { CineGraphData, Favorites, UserProfile } from "../types";

interface ProfileContextValue {
  profile: UserProfile | null;
  cineGraph: CineGraphData | null;
  favorites: Favorites | null;
  shareCount: number | undefined;
  // True once the first successful load has completed — stays true after
  // that even while a background refresh() is in flight, which is exactly
  // what lets the Profile tab skip its loading skeleton on every visit
  // after the first.
  loaded: boolean;
  error: string | null;
  ensureLoaded: () => void;
  // Revalidates the whole bundle, but no more often than REFRESH_TTL_MS —
  // pass { force: true } straight after mutating something server-side, when
  // you know the cached copy is wrong rather than merely old.
  refresh: (options?: { force?: boolean }) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

// How long a just-fetched bundle is treated as current. Sized to cover
// tab-bouncing (the case this exists for) without being long enough to show
// a stale number after the user goes off and actually rates something.
const REFRESH_TTL_MS = 30_000;

// Cheap structural equality for the payloads above. They're small, flat-ish
// JSON straight off the wire with stable key order from the server, so
// stringify is both correct enough and faster than walking them by hand —
// and a false "changed" only costs one extra render, never wrong data.
function sameShape<T>(a: T | null, b: T | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

// App-wide cache of the logged-in user's own profile bundle (profile info,
// CineGraph, favorites, share count) — same "load once, silently refresh
// after" shape FollowGraphContext already uses for the follow-status set.
// Backs the Profile tab so switching away and back never re-shows a full
// loading skeleton once it's loaded once (matching how Instagram's own
// profile tab behaves — instant on every visit after the first), and
// prefetches as soon as a user is known rather than waiting for the tab to
// actually be opened, so even the *first* visit is usually already resolved
// by the time someone taps it.
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cineGraph, setCineGraph] = useState<CineGraphData | null>(null);
  const [favorites, setFavorites] = useState<Favorites | null>(null);
  const [shareCount, setShareCount] = useState<number | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const lastFetchedAtRef = useRef(0);

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
      if (!user) return;
      // Bouncing between the app's bottom tabs used to re-fire all four of
      // these requests every single time Profile regained focus, however
      // briefly. Nothing on this screen can change while the user is
      // elsewhere in the app except by their own action (rating, reviewing,
      // sharing), and none of those is quick enough to fit inside this
      // window — so within it the cached bundle is simply correct, and
      // re-fetching it is pure network and battery for an identical answer.
      // `force` exists for callers that just mutated something server-side.
      if (!options?.force && Date.now() - lastFetchedAtRef.current < REFRESH_TTL_MS) return;
      // Also collapses concurrent callers (focus effect + prefetch racing on
      // app boot) onto the one request already in flight.
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const [profileData, cineGraphData, favoritesData, sharesData] = await Promise.all([
          getUserProfile(user._id),
          getCineGraph(user._id),
          getFavorites(user._id),
          getUserShares("me", 1, 1),
        ]);
        // isAuthorizedToView always passes for viewerId === targetUser._id,
        // so these should never actually be the masked branch — defensive only.
        if (!profileData.isAuthorized) throw new Error("Own profile unexpectedly masked");
        if (!favoritesData.isAuthorized) throw new Error("Own favorites unexpectedly masked");
        lastFetchedAtRef.current = Date.now();
        // Identity-preserving: a revalidation that comes back byte-identical
        // (the common case) keeps the previous object, so React bails out of
        // re-rendering every consumer. That matters most for cineGraph —
        // CineGraphDonut derives its slice geometry and its 19 chip
        // positions from that object's identity, so a fresh-but-identical
        // reference used to throw all of that away and recompute it.
        setProfile((prev) => (sameShape(prev, profileData) ? prev : profileData));
        setCineGraph((prev) => (sameShape(prev, cineGraphData) ? prev : cineGraphData));
        setFavorites((prev) => (sameShape(prev, favoritesData) ? prev : favoritesData));
        setShareCount(sharesData.total);
        setError(null);
        setLoaded(true);
      } catch (e: any) {
        // A failed background refresh leaves whatever was already loaded on
        // screen (stale-but-visible beats an error screen replacing working
        // data) — the error is only surfaced when there's nothing loaded yet.
        setError(e?.response?.data?.message || "Failed to load profile.");
      } finally {
        loadingRef.current = false;
      }
    },
    [user?._id]
  );

  // Forces past the TTL on purpose: this only ever fires when there is
  // nothing loaded at all, so "recently fetched" can't be a reason to skip.
  const ensureLoaded = useCallback(() => {
    if (loaded || loadingRef.current) return;
    refresh({ force: true });
  }, [loaded, refresh]);

  // Prefetch the moment a user is known (login, or session restore on app
  // boot) — not lazily on first Profile-tab focus — so that first visit is
  // as likely as possible to already have data by the time it's opened.
  useEffect(() => {
    // A different account's bundle is not a stale copy of this one, it's the
    // wrong data — drop the freshness stamp so the TTL can't hold it on
    // screen after a logout/login inside the same window.
    lastFetchedAtRef.current = 0;
    if (user) ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  return (
    <ProfileContext.Provider
      value={{ profile, cineGraph, favorites, shareCount, loaded, error, ensureLoaded, refresh }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
