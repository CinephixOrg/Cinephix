import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as authService from "../api/authService";
import { setUnauthorizedHandler } from "../api/client";
import { STORAGE_KEYS } from "../constants/apiRoutes";
import { unregisterForPush } from "../push/registration";
import { resetSessionCaches } from "../api/sessionReset";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  needsProfileSetup: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, acceptedTerms: boolean) => Promise<void>;
  /** Set when the session ended because the account was suspended. */
  signedOutReason: string | null;
  clearSignedOutReason: () => void;
  verifyEmail: (email: string, code: string) => Promise<void>;
  completeOAuthLogin: (user: User) => Promise<void>;
  updateUser: (fields: Partial<User>) => Promise<void>;
  clearNeedsProfileSetup: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// The fields re-read from the server by refreshAccount below. accountTier is
// the one that matters: it decides ads and Premium features, and an admin
// can grant or end a tier at any time. The others can change from another
// device.
const REFRESHED_FIELDS = ["accountTier", "username", "profile_pic_url"] as const;

// At most this often when the app keeps coming back to the foreground.
const REFRESH_MIN_INTERVAL_MS = 60 * 1000;

async function persistUser(user: User) {
  const { token, ...rest } = user;
  await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
  await SecureStore.setItemAsync(STORAGE_KEYS.USER, JSON.stringify(rest));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Transient (not persisted) — only ever set true by a fresh verifyEmail,
  // so a plain login or app relaunch never routes through setup-profile.
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  // Why the session ended, when it ended for a reason worth showing.
  const [signedOutReason, setSignedOutReason] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.USER),
      ]);
      if (token && userJson) {
        setUser({ ...JSON.parse(userJson), token });
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const loggedInUser = await authService.login(email, password);
    await persistUser(loggedInUser);
    setUser(loggedInUser);
  };

  const register = async (username: string, email: string, password: string, acceptedTerms: boolean) => {
    // No token yet — backend requires email verification before login.
    await authService.register(username, email, password, acceptedTerms);
  };

  const verifyEmail = async (email: string, code: string) => {
    const verifiedUser = await authService.verifyEmail(email, code);
    await persistUser(verifiedUser);
    setUser(verifiedUser);
    setNeedsProfileSetup(true);
  };

  const clearNeedsProfileSetup = () => setNeedsProfileSetup(false);

  // Used after the Google OAuth in-app-browser flow hands back a
  // { ...userFields, token } blob in the redirect URL, same shape as
  // login/verifyEmail return.
  const completeOAuthLogin = async (oauthUser: User) => {
    await persistUser(oauthUser);
    setUser(oauthUser);
  };

  // Merges fields (e.g. new bio/username/avatar) into the stored user object
  // — mirrors frontend/src/context/AuthContext.jsx's updateUser.
  const updateUser = async (fields: Partial<User>) => {
    if (!user) return;
    const next = { ...user, ...fields };
    await persistUser(next);
    setUser(next);
  };

  // The stored user is a copy from sign-in, so a tier granted or ended
  // since (an admin's time-limited Premium, say) would otherwise only show
  // after signing in again. It's re-read from /users/me when the app starts
  // with someone signed in and whenever it comes back to the foreground.
  // Offline or failing, the stored copy simply stays.
  const userRef = useRef(user);
  userRef.current = user;
  const lastRefresh = useRef(0);

  const refreshAccount = async () => {
    const current = userRef.current;
    if (!current || Date.now() - lastRefresh.current < REFRESH_MIN_INTERVAL_MS) return;
    lastRefresh.current = Date.now();
    try {
      const fresh = await authService.getMyAccount();
      const latest = userRef.current;
      // Signed out or switched account meanwhile.
      if (!latest || String(fresh?._id) !== String(latest._id)) return;
      const changes: Partial<User> = {};
      for (const field of REFRESHED_FIELDS) {
        if (fresh[field] !== undefined && fresh[field] !== latest[field]) Object.assign(changes, { [field]: fresh[field] });
      }
      if (Object.keys(changes).length === 0) return;
      const next = { ...latest, ...changes };
      await persistUser(next);
      setUser(next);
    } catch {
      // Keep the stored copy; the next start or foreground tries again.
    }
  };

  const signedInId = user?._id ?? null;
  useEffect(() => {
    if (!signedInId) return;
    lastRefresh.current = 0;
    refreshAccount();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshAccount();
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInId]);

  // Set while signing out. Removing the push token is itself an
  // authenticated request, and when the session has expired its 401 calls
  // logout again through the unauthorized handler below.
  const signingOut = useRef(false);

  const logout = async (reason?: string) => {
    setSignedOutReason(reason ?? null);
    if (signingOut.current) return;
    signingOut.current = true;
    // Right away, before anything else: nothing cached for this account
    // may show to whoever signs in next (see api/sessionReset.ts).
    resetSessionCaches();
    try {
      // First, while the session token can still authorize it: this device
      // stops receiving the account's push notifications. Bounded by a
      // timeout, so an offline sign-out still goes through.
      await unregisterForPush();
      await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER);
      setUser(null);
      // Again, for anything an in-flight request put back meanwhile.
      resetSessionCaches();
    } finally {
      signingOut.current = false;
    }
  };

  // Registered once — client.ts's response interceptor calls this on a 401
  // from an authenticated request (the token itself is missing/invalid/
  // expired) so the app actually logs out and stops silently re-hitting an
  // endpoint that will keep rejecting it forever, instead of e.g.
  // NotificationContext's 10s unread-count poll failing in an unbounded
  // loop for as long as the app stays open. Safe as an empty-deps effect —
  // `logout` itself only closes over the stable `setUser` setter and
  // SecureStore calls, nothing that goes stale across renders.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        needsProfileSetup,
        login,
        register,
        signedOutReason,
        clearSignedOutReason: () => setSignedOutReason(null),
        verifyEmail,
        completeOAuthLogin,
        updateUser,
        clearNeedsProfileSetup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
