/**
 * Cache Management Utilities
 * Utilities for developers to manually manage cache during development/testing
 */

import { clearAllCache, getCacheStats, clearCacheByPattern } from './cacheService';

/**
 * Print current cache statistics to console
 */
export const debugCacheStats = () => {
  const stats = getCacheStats();
  console.table({
    'Cache Size': stats.size,
    'Keys': stats.keys.join('\n'),
  });
  return stats;
};

/**
 * Clear cache by pattern (useful in dev console)
 * Example: clearCacheByRegex('user')  // Clears all user-related cache
 */
export const clearCacheByRegex = (pattern) => {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  clearCacheByPattern(regex);
  console.log(`Cache cleared for pattern: ${pattern}`);
};

/**
 * Clear all cache (useful for testing)
 */
export const flushAllCache = () => {
  clearAllCache();
  console.log('All cache cleared');
};

// Expose to window for easy access in browser dev console
if (typeof window !== 'undefined') {
  window.__cacheDebug = {
    stats: debugCacheStats,
    clear: flushAllCache,
    clearByPattern: clearCacheByRegex,
  };

  // Log that debugging tools are available
  console.log('Cache debugging tools available: window.__cacheDebug');
}

export default {
  debugCacheStats,
  clearCacheByRegex,
  flushAllCache,
};
