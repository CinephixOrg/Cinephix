import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../constants/apiRoutes";

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
  (error) => Promise.reject(error)
);

export default API;
