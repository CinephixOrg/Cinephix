import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../constants/apiRoutes";
import i18next from "../i18n";
import { localizeTitles } from "../utils/localizedTitles";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

const API = axios.create({ baseURL: API_BASE_URL });

// Set once by AuthContext (a plain module has no hook access of its own) so
// a 401 from an *authenticated* request — the token itself is missing/
// invalid/expired, the only thing authMiddleware.js's 401 ever means — can
// trigger a real logout instead of leaving the app logged in against a
// token the server will keep rejecting forever. Without this, anything
// that polls on a fixed interval while `user` is truthy (e.g.
// NotificationContext's unread-count poll) kept silently retrying and
// failing every cycle indefinitely — a real reported "infinite loop" of
// 401s, once whatever session was active stopped being valid.
let onUnauthorized: ((reason?: string) => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

API.interceptors.request.use(async (req) => {
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// Backend envelope is { success, message, data, pagination? } — unwrap it so
// callers just get res.data / res.pagination. Watchlist endpoints are the one
// exception (raw { message, watchlist }) and are read directly by
// watchlistService instead of relying on this unwrap.
API.interceptors.response.use(
  (res) => {
    // Every film and series in the app's own language shows under its
    // original name, everything else under its English one
    // (utils/localizedTitles.ts) — once, here, for every screen.
    localizeTitles(res.data, i18next.language);
    if (res.data && res.data.pagination) {
      const { data, pagination, success, message, ...rest } = res.data;
      res.data = data;
      (res as any).pagination = pagination;
      Object.assign(res, rest);
      return res;
    }
    if (res.data && res.data.data !== undefined && res.data.success !== undefined) {
      res.data = res.data.data;
    }
    return res;
  },
  (error) => {
    // Only for requests that actually carried a token — login's own
    // "Invalid email or password" also comes back as 401 (userController.js
    // — a different meaning entirely, not a session problem), and that
    // request never sets this header in the first place.
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      // A suspended account is signed out like an expired session, but with
      // something to show for it (backend/middleware/authMiddleware.js).
      const suspended = error.response?.data?.code === "account_suspended";
      onUnauthorized?.(suspended ? error.response?.data?.message : undefined);
    }
    if (!error.response && error.request) {
      // Network-level failure (offline, timeout, unreachable) — no server
      // response at all. Synthesize one so every existing
      // `e?.response?.data?.message || t(fallback)` call site across the
      // app automatically shows a real "check your connection" message
      // instead of silently falling through to its own generic fallback,
      // with zero per-screen changes needed.
      error.response = {
        data: {
          message: i18next.t("No internet connection. Please check your network and try again."),
        },
      };
    }
    return Promise.reject(error);
  }
);

export default API;
