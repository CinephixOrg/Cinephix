import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../constants/apiRoutes";
import i18next from "../i18n";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

const API = axios.create({ baseURL: API_BASE_URL });

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
    if (res.data && res.data.pagination) {
      const { data, pagination } = res.data;
      res.data = data;
      (res as any).pagination = pagination;
      return res;
    }
    if (res.data && res.data.data !== undefined && res.data.success !== undefined) {
      res.data = res.data.data;
    }
    return res;
  },
  (error) => {
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
