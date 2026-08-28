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
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

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

  const refresh = useCallback(async () => {
    if (!user) return;
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
      setProfile(profileData);
      setCineGraph(cineGraphData);
      setFavorites(favoritesData);
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
  }, [user?._id]);

  const ensureLoaded = useCallback(() => {
    if (loaded || loadingRef.current) return;
    refresh();
  }, [loaded, refresh]);

  // Prefetch the moment a user is known (login, or session restore on app
  // boot) — not lazily on first Profile-tab focus — so that first visit is
  // as likely as possible to already have data by the time it's opened.
  useEffect(() => {
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
