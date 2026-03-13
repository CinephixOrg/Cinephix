/**
 * Cache Service
 * Simple in-memory caching for API responses with configurable TTL
 */

const cache = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_KEYS = {
  USER: (userId) => `user:${userId}`,
  CURRENT_USER: 'user:current',
  CINE_GRAPH: (userId) => `cineGraph:${userId}`,
  FAVORITES: (userId) => `favorites:${userId}`,
  WATCHLIST: 'watchlist:current',
  MOVIE: (movieId) => `movie:${movieId}`,
  SERIES: (seriesId) => `series:${seriesId}`,
  MOVIE_SEARCH: (query) => `moviesearch:${query}`,
  SERIES_SEARCH: (query) => `seriessearch:${query}`,
  REVIEWS: (contentId) => `reviews:${contentId}`,
};

/**
 * Store data in cache
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
 */
export const setCacheItem = (key, data, ttl = DEFAULT_TTL) => {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
};

/**
 * Retrieve data from cache if valid
 * @param {string} key - Cache key
 * @returns {*|null} Cached data or null if expired/not found
 */
export const getCacheItem = (key) => {
  const item = cache.get(key);

  if (!item) return null;

  const isExpired = Date.now() - item.timestamp > item.ttl;

  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return item.data;
};

/**
 * Check if cache item exists and is valid
 * @param {string} key - Cache key
 * @returns {boolean} True if cache is valid
 */
export const isCacheValid = (key) => {
  return getCacheItem(key) !== null;
};

/**
 * Clear a specific cache item
 * @param {string} key - Cache key to clear
 */
export const clearCacheItem = (key) => {
  cache.delete(key);
};

/**
 * Clear cache items matching a pattern
 * @param {string|RegExp} pattern - Pattern to match (can be substring or regex)
 */
export const clearCacheByPattern = (pattern) => {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  const keysToDelete = [];

  for (const key of cache.keys()) {
    if (regex.test(key)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => cache.delete(key));
};

/**
 * Clear all cache
 */
export const clearAllCache = () => {
  cache.clear();
};

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
export const getCacheStats = () => {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
};

export { CACHE_KEYS };
