import React, { createContext, useContext, useEffect, useRef, useState } from "react";
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
  clearNeedsProfileSetup: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function persistUser(user: User) {
  const { token, ...rest } = user;
  await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
  await SecureStore.setItemAsync(STORAGE_KEYS.USER, JSON.stringify(rest));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Derived from the user's own persisted onboardingCompletedAt (TC-133),
  // not a separate in-memory flag — a killed/backgrounded app relaunching
  // mid-wizard sees the same real field login/verifyEmail/app-boot already
  // loaded it from, and resumes the wizard instead of silently skipping it.
  const needsProfileSetup = !!user && !user.onboardingCompletedAt;
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
  };

  // Called once the onboarding wizard's own PATCH /onboarding-progress
  // {completed:true} call has succeeded server-side — mirrors that into
  // local/persisted state so needsProfileSetup flips immediately without
  // waiting on a full profile refetch.
  const clearNeedsProfileSetup = async () => {
    if (!user) return;
    const next = { ...user, onboardingCompletedAt: new Date().toISOString() };
    await persistUser(next);
    setUser(next);
  };

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
