// TMDB, for what a detail page shows that the catalog doesn't carry.
//
// Authenticates with the v4 read access token when there is one, else the v3
// api_key (TMDB_API_READ_ACCESS_TOKEN / TMDB_API_KEY). Every call is short —
// a detail page waits on it — and details are remembered in memory for a
// while, since the same popular titles are opened again and again. Nothing
// here touches the database.

const BASE = "https://api.themoviedb.org/3";
// Past this, the page opens without what TMDB would have added.
const TIMEOUT_MS = 2500;
const CACHE_MAX = 2000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map(); // request -> { at, value }, oldest first

export function tmdbConfigured() {
  return Boolean(process.env.TMDB_API_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY);
}

export async function tmdbGet(path, params = {}) {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  const query = new URLSearchParams(token ? params : { ...params, api_key: process.env.TMDB_API_KEY });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}?${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`TMDB ${path} ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** tmdbGet, remembered for a few hours (the least recently used are let go first). */
export async function tmdbGetCached(path, params = {}) {
  const key = `${path}?${new URLSearchParams(params)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    cache.delete(key);
    cache.set(key, hit);
    return hit.value;
  }
  const value = await tmdbGet(path, params);
  cache.set(key, { at: Date.now(), value });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return value;
}
