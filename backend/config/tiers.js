export const TIER_LIMITS = {
  free: {
    maxMatches: 5,
    analysisCooldownHours: 24,
    analysisSchema: 'basic',
    analysisHistory: false,
    swipesPerDay: 5,
    canUseMatchFilters: false,
    canViewRejectedMatches: false
  },
  pro: {
    maxMatches: 30,
    analysisCooldownHours: 6,
    analysisSchema: 'rich',
    analysisHistory: true,
    swipesPerDay: 30,
    canUseMatchFilters: true,
    canViewRejectedMatches: true
  },
  premium: {
    maxMatches: 100,
    analysisCooldownHours: 1,
    analysisSchema: 'rich',
    analysisHistory: true,
    swipesPerDay: 100,
    canUseMatchFilters: true,
    canViewRejectedMatches: true
  },
  // Internal testing tier — no cooldown so Analyze Profile can be re-run
  // freely while iterating; otherwise as generous as premium.
  dev: {
    maxMatches: 999,
    analysisCooldownHours: 0,
    analysisSchema: 'rich',
    analysisHistory: true,
    swipesPerDay: 999,
    canUseMatchFilters: true,
    canViewRejectedMatches: true
  }
};

// A rejected swipe drops out of the candidate pool for this long before it's
// eligible to resurface — same value for every tier, unlike the other limits
// above (Pro/Premium's edge over Free here is *seeing* the rejected list via
// canViewRejectedMatches, not a shorter wait).
export const REJECT_COOLDOWN_DAYS = 30;

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
