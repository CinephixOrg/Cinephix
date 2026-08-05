import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { API_BASE_URL } from "./client";
import type { User } from "../types";

// Reuses the backend's existing browser-redirect Google OAuth flow
// (passport-google-oauth20), just pointed at this app's redirect URL instead
// of the web frontend. See backend/routes/userRoute.js and
// backend/controllers/userController.js#googleAuthCallback.
//
// The redirect URL is NOT hardcoded on the backend (e.g. a fixed
// "cinephix://" scheme) — it's passed explicitly here and echoed back by the
// server. This matters because Linking.createURL() produces a different,
// dynamic URL depending on how the app is currently running: an
// "exp://<lan-ip>:8081/--/oauth-success" URL in Expo Go during development,
// vs. a real "cinephix://oauth-success" URL in a standalone/dev-client
// build. A hardcoded scheme only works for the latter — Expo Go can't
// register arbitrary custom schemes, so it can't be handed a "cinephix://"
// redirect at all.
export async function signInWithGoogle(): Promise<User> {
  const redirectUri = Linking.createURL("oauth-success");
  const authUrl = `${API_BASE_URL}/users/auth/google?platform=mobile&redirectUri=${encodeURIComponent(redirectUri)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== "success" || !result.url) {
    throw new Error("Google sign-in was cancelled.");
  }

  const { queryParams } = Linking.parse(result.url);
  const data = queryParams?.data;
  if (!data || typeof data !== "string") {
    throw new Error("Google sign-in did not return user data.");
  }

  return JSON.parse(data) as User;
}
