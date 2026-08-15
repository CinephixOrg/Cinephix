# Caching Strategy Documentation

## Overview

Issue #9 implements a comprehensive client-side caching strategy to reduce unnecessary API calls and improve application performance.

## What's Cached

### User Data
- **getCurrentUser()** - 5 minutes
  - Cached at: `user:current`
  - Invalidated on: profile update, pic upload, bio change, account deletion
  
- **getProfile(userId)** - 10 minutes
  - Cached at: `user:{userId}`
  - Invalidated on: profile update, pic upload, bio change, follow/unfollow
  
- **getCineGraphData(userId)** - 15 minutes
  - Cached at: `cineGraph:{userId}`
  - Invalidated on: rating create/update/delete
  
- **getFavorites(userId)** - 10 minutes
  - Cached at: `favorites:{userId}`
  - Invalidated on: watchlist operations
  
- **getWatchlist()** - 10 minutes
  - Cached at: `watchlist:current`
  - Invalidated on: add/remove from watchlist

### Content Data
- **getMovieById(movieId)** - 30 minutes
  - Cached at: `movie:{movieId}`
  - Rationale: Movie data rarely changes
  
- **getSeriesById(seriesId)** - 30 minutes
  - Cached at: `series:{seriesId}`
  - Rationale: Series data rarely changes
  
- **searchMovies(query)** - 20 minutes
  - Cached at: `moviesearch:{query}`
  
- **searchSeries(query)** - 20 minutes
  - Cached at: `seriessearch:{query}`

### Review Data
- **getReviewsByContent(contentId)** - 10 minutes
  - Cached at: `reviews:{contentId}`
  - Invalidated on: review create/update

## Cache Invalidation Strategy

### Automatic Invalidation
When you perform an action that modifies data, related caches are automatically invalidated:

- **Rating changes** → Clears cineGraph cache
- **Profile updates** → Clears current user & profile caches
- **Watchlist changes** → Clears watchlist & current user caches
- **Review creation** → Clears reviews cache for that content
- **Follow/Unfollow** → Clears user profile caches

### Manual Cache Management

#### For Development/Testing
Open browser console and use `window.__cacheDebug`:

```javascript
// View cache statistics
window.__cacheDebug.stats()

// Clear all cache
window.__cacheDebug.clear()

// Clear cache by pattern
window.__cacheDebug.clearByPattern('user')
window.__cacheDebug.clearByPattern('movie')
window.__cacheDebug.clearByPattern('reviews')
```

#### Programmatic Access
```javascript
import { clearCacheItem, clearCacheByPattern, CACHE_KEYS } from './api/cacheService';

// Clear specific cache
clearCacheItem(CACHE_KEYS.USER('user123'));

// Clear by pattern
clearCacheByPattern('user');
```

## Usage in Components

### With useApiCache Hook
```javascript
import { useApiCache } from '../hooks/useApiCache';
import { userService } from '../api/userService';

function MyComponent() {
  const { data: profile, loading, error, refetch } = useApiCache(
    () => userService.getProfile(userId),
    [userId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>{profile.username}</h1>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

### With Service Methods Directly
Services now automatically handle caching:

```javascript
import { userService } from '../api/userService';

// First call: Fetches from API
const data1 = await userService.getProfile(userId);

// Second call (within 10 minutes): Returns from cache
const data2 = await userService.getProfile(userId);

// Manual cache clear
import { clearCacheItem, CACHE_KEYS } from '../api/cacheService';
clearCacheItem(CACHE_KEYS.USER(userId));

// Third call: Fetches from API again
const data3 = await userService.getProfile(userId);
```

## Cache TTL (Time To Live)

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Current User | 5 min | Frequently changes (follows, profile) |
| User Profiles | 10 min | Changes less frequently |
| Cine Graph | 15 min | Changes only on ratings |
| Favorites | 10 min | Changes with watchlist |
| Watchlist | 10 min | User may update frequently |
| Movies/Series | 30 min | Content metadata rarely changes |
| Search Results | 20 min | Less time-sensitive |
| Reviews | 10 min | User-generated content |

## Performance Impact

### Expected Improvements
- **Reduced API calls** - Same data fetched once per TTL period instead of on every mount
- **Faster page navigation** - Cached data returns instantly
- **Lower bandwidth usage** - Fewer network requests
- **Better UX** - No loading spinners for cached data

### Real-world Example
**Before:**
1. User navigates to ProfilePage
2. Component mounts, calls `userService.getProfile()`
3. Component mounts, calls `userService.getCineGraphData()`
4. User navigates away and back to ProfilePage
5. Same API calls repeated (if within cache TTL, now cached)

**After:**
1. User navigates to ProfilePage
2. Component mounts, calls `userService.getProfile()` → API call (cached)
3. Component mounts, calls `userService.getCineGraphData()` → API call (cached)
4. User navigates away and back to ProfilePage (within 5-15 min)
5. Same API calls return from cache instantly ✅

## When Cache is Cleared

### Automatic Clearing
- User logs out
- User deletes account
- Profile picture uploaded
- Bio updated
- Rating added/updated/deleted
- Review added/updated
- Watchlist modified
- Follow/Unfollow action

### Manual Clearing
```javascript
// In development, use the debug tools
window.__cacheDebug.clear()

// Or programmatically
import { clearAllCache } from './api/cacheService';
clearAllCache();
```

## Testing Cache

### Verify Cache is Working
1. Open browser console
2. Call: `window.__cacheDebug.stats()` - Shows cache size
3. Navigate to a profile page - Watch for API calls in Network tab
4. Navigate away and back within 5-15 minutes - Should not see same API calls

### Monitor Cache Activity
```javascript
// See what's in cache
window.__cacheDebug.stats()

// Output example:
// {
//   size: 5,
//   keys: [
//     "user:current",
//     "user:668c5d3f78c3d9c6f3e2c8b1", 
//     "cineGraph:668c5d3f78c3d9c6f3e2c8b1",
//     "movie:68ed0787d4510a0b669a1d24",
//     "reviews:668c5d3f78c3d9c6f3e2c8b1"
//   ]
// }
```

## Best Practices

### ✅ DO
- Use service methods which handle caching automatically
- Let automatic cache invalidation work for most cases
- Use `useApiCache` hook for cleaner component code
- Monitor cache with `window.__cacheDebug.stats()` during development

### ❌ DON'T
- Make direct API.get() calls (use services instead)
- Manually set cache without understanding TTL
- Expect cache to persist after page reload (in-memory only)
- Cache sensitive data with long TTLs

## Troubleshooting

### Stale Data
If you see stale data:
1. Check cache TTL - it might be too long
2. Verify cache invalidation is triggered after mutations
3. Use `window.__cacheDebug.clear()` to reset
4. Check browser Network tab to confirm API calls

### Cache Not Working
1. Verify you're using service methods (not direct API calls)
2. Check if cache was manually cleared
3. Open console and use `window.__cacheDebug.stats()` to verify cache

### Memory Issues
If cache grows too large:
1. Monitor with `window.__cacheDebug.stats()`
2. Reduce TTL for frequently updated data
3. Clear by pattern: `window.__cacheDebug.clearByPattern('search')`

## Future Enhancements

Potential improvements for the caching strategy:
1. **Persistent Cache** - Use localStorage for longer-term caching
2. **Cache Compression** - Reduce memory for large datasets
3. **Smart Invalidation** - Use server timestamps for cache validation
4. **Analytics** - Track cache hit/miss rates
5. **Selective Caching** - User setting to disable/enable cache
