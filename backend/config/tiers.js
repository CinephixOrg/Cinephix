export const TIER_LIMITS = {
  free: {
    maxMatches: 5,
    analysisCooldownHours: 24,
    // Separate from analysisCooldownHours (Profile Analysis's own cooldown,
    // re-running your *own* profile) — CineMatch's "Analyze" button targets
    // a *specific other person* per call, and the legitimate use case is
    // analyzing several different candidates in one session, so this is
    // scoped per (user, targetUser) pair (MatchAnalysisLog), not a single
    // global timer, and is deliberately much shorter — re-analyzing the
    // *same* pair after a short break is still a reasonable thing to want.
    matchAnalysisCooldownMinutes: 60,
    analysisSchema: 'basic',
    analysisHistory: false,
    canUseMatchFilters: false,
    // How many times /sync/candidates can be hit per day (SyncSearchLog) —
    // movies and series share one quota, not a separate one each; a Free
    // account can't pick a type filter anyway (canUseMatchFilters below),
    // so this is really "one fresh queue a day" regardless of content type.
    syncSearchesPerDay: 1,
    // Gates the useCount/useAvgRating toggles specifically — distinct from
    // canUseMatchFilters, which gates type/genre. Plus can already narrow by
    // type/genre; the two matching-weight toggles stay Premium-only, forced
    // to DEFAULT_MATCH_FILTERS' own useCount/useAvgRating server-side
    // (getSyncCandidates) regardless of what a client sends.
    canUseAdvancedMatchFilters: false
  },
  plus: {
    maxMatches: 30,
    analysisCooldownHours: 6,
    matchAnalysisCooldownMinutes: 15,
    analysisSchema: 'rich',
    analysisHistory: true,
    canUseMatchFilters: true,
    syncSearchesPerDay: 3,
    canUseAdvancedMatchFilters: false
  },
  premium: {
    maxMatches: 100,
    analysisCooldownHours: 1,
    matchAnalysisCooldownMinutes: 5,
    analysisSchema: 'rich',
    analysisHistory: true,
    canUseMatchFilters: true,
    // Generous enough that no real usage pattern hits it — this exists to
    // bound worst-case LLM cost per account, not to be felt as a limit by a
    // paying Premium user, so the client deliberately never surfaces a
    // "X of 15 left today" counter for this tier the way it might for
    // Free/Plus.
    syncSearchesPerDay: 15,
    canUseAdvancedMatchFilters: true
  },
  // Internal testing tier — no cooldown so Analyze Profile can be re-run
  // freely while iterating; otherwise as generous as premium.
  dev: {
    maxMatches: 999,
    analysisCooldownHours: 0,
    matchAnalysisCooldownMinutes: 0,
    analysisSchema: 'rich',
    analysisHistory: true,
    canUseMatchFilters: true,
    syncSearchesPerDay: 999,
    canUseAdvancedMatchFilters: true
  }
};

// The default filters silently applied to sync candidates for tiers where
// canUseMatchFilters is false — Free always gets this regardless of what a
// (tampered) client request might send, enforced server-side in the
// controller, not just hidden client-side. Also what canUseAdvancedMatchFilters
// forces useCount/useAvgRating back to for Free/Plus, on top of type/genres.
export const DEFAULT_MATCH_FILTERS = {
  type: 'movie',
  genres: [],
  useCount: true,
  useAvgRating: true
};

export const getTierLimits = (tier) => TIER_LIMITS[tier] || TIER_LIMITS.free;
