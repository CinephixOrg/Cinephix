export const TIER_LIMITS = {
  free: {
    maxMatches: 5,
    analysisCooldownHours: 24,
    analysisSchema: 'basic',
    analysisHistory: false,
    canUseMatchFilters: false
  },
  pro: {
    maxMatches: 30,
    analysisCooldownHours: 6,
    analysisSchema: 'rich',
    analysisHistory: true,
    canUseMatchFilters: true
  },
  premium: {
    maxMatches: 100,
    analysisCooldownHours: 1,
    analysisSchema: 'rich',
    analysisHistory: true,
    canUseMatchFilters: true
  },
  // Internal testing tier — no cooldown so Analyze Profile can be re-run
  // freely while iterating; otherwise as generous as premium.
  dev: {
    maxMatches: 999,
    analysisCooldownHours: 0,
    analysisSchema: 'rich',
    analysisHistory: true,
    canUseMatchFilters: true
  }
};

// The default filters silently applied to swipe candidates for tiers where
// canUseMatchFilters is false — Free always gets this regardless of what a
// (tampered) client request might send, enforced server-side in the
// controller, not just hidden client-side.
export const DEFAULT_MATCH_FILTERS = {
  type: 'movie',
  genres: [],
  useCount: true,
  useAvgRating: true
};

export const getTierLimits = (tier) => TIER_LIMITS[tier] || TIER_LIMITS.free;
