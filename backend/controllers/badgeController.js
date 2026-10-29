import mongoose from "mongoose";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Review from "../models/Review.js";
import CustomList from "../models/CustomList.js";
import Share from "../models/Share.js";
import MatchAnalysisLog from "../models/MatchAnalysisLog.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess } from "../utils/response.js";
import { tallyGenres } from "../utils/analysisMath.js";
import { MOVIE_GENRE_MAP, SERIES_GENRE_MAP } from "../utils/genreConstants.js";

// Unified genre badges — one badge can combine a movie genre and (when
// TMDB's own series taxonomy has an equivalent) a series genre, same
// movie/series genre-name drift feedController.js's getRecommendations
// already had to account for (e.g. movie "Action" vs series "Action &
// Adventure" are different strings for the same idea). TMDB's series genre
// list has no Horror/Romance/Thriller equivalent at all (confirmed against
// SERIES_GENRE_MAP), so those three badges are movie-only by nature of the
// data, not an oversight here.
export const GENRE_BADGES = [
  { key: "action", movieGenres: ["Action"], seriesGenres: ["Action & Adventure"] },
  { key: "comedy", movieGenres: ["Comedy"], seriesGenres: ["Comedy"] },
  { key: "drama", movieGenres: ["Drama"], seriesGenres: ["Drama"] },
  { key: "horror", movieGenres: ["Horror"], seriesGenres: [] },
  { key: "romance", movieGenres: ["Romance"], seriesGenres: [] },
  { key: "thriller", movieGenres: ["Thriller"], seriesGenres: [] },
  { key: "scifi", movieGenres: ["Science Fiction"], seriesGenres: ["Sci-Fi & Fantasy"] },
  { key: "documentary", movieGenres: ["Documentary"], seriesGenres: ["Documentary"] },
  // 10 more added later, same rule as horror/romance/thriller above: a
  // movie genre whose series equivalent is already claimed by another
  // badge (Adventure/Fantasy -> series' merged "Action & Adventure" /
  // "Sci-Fi & Fantasy", already counted by action/scifi) stays movie-only
  // rather than double-counting the same series episodes under two badges.
  { key: "adventure", movieGenres: ["Adventure"], seriesGenres: [] },
  { key: "animation", movieGenres: ["Animation"], seriesGenres: ["Animation"] },
  { key: "crime", movieGenres: ["Crime"], seriesGenres: ["Crime"] },
  { key: "family", movieGenres: ["Family"], seriesGenres: ["Family"] },
  { key: "fantasy", movieGenres: ["Fantasy"], seriesGenres: [] },
  { key: "history", movieGenres: ["History"], seriesGenres: [] },
  { key: "musical", movieGenres: ["Music"], seriesGenres: [] },
  { key: "mystery", movieGenres: ["Mystery"], seriesGenres: ["Mystery"] },
  { key: "war", movieGenres: ["War"], seriesGenres: ["War & Politics"] },
  { key: "western", movieGenres: ["Western"], seriesGenres: ["Western"] },
];

export const DEVOTEE_THRESHOLD = 15;
export const MASTER_THRESHOLD = 40;

const tierFor = (count) => {
  if (count >= MASTER_THRESHOLD) return "master";
  if (count >= DEVOTEE_THRESHOLD) return "devotee";
  return null;
};

// Exported separately from tierFor: tierFor answers "what tier is this
// count at or above" (used for the badges tab's general display, where
// count is always >= the tier's own threshold once earned). This answers
// a narrower question — "did count land EXACTLY on a threshold" — which is
// what "was this specific watchlist add the one that just crossed it"
// means, since adding one title only ever moves a genre's count up by
// exactly 1.
export const crossedThresholdTier = (count) => {
  if (count === MASTER_THRESHOLD) return "master";
  if (count === DEVOTEE_THRESHOLD) return "devotee";
  return null;
};

// Pure tallying step shared by countGenreBadgesFromWatchlist (one user, its
// own Movie/Series.find query) and computeAllUsersBadgeCounts below (many
// users, one BATCHED Movie/Series.find across everyone) — this is the part
// that's actually identical between them; only how movieDocs/seriesDocs get
// fetched differs.
function genreBadgeCountsFromDocs(movieDocs, seriesDocs) {
  const movieGenreCounts = tallyGenres(movieDocs, MOVIE_GENRE_MAP);
  const seriesGenreCounts = tallyGenres(seriesDocs, SERIES_GENRE_MAP);

  return GENRE_BADGES.map(({ key, movieGenres, seriesGenres }) => {
    const count =
      movieGenres.reduce((sum, g) => sum + (movieGenreCounts[g] || 0), 0) +
      seriesGenres.reduce((sum, g) => sum + (seriesGenreCounts[g] || 0), 0);
    return { key, count, tier: tierFor(count) };
  });
}

// Counts genre badges from an already-in-hand watchlist array — direct
// ask: a genre badge counts everything on the Watched List, rated or not,
// not just rated titles. userWatchlistRoute.js's own add-to-watchlist
// handler already has the user document (with the new item already
// pushed) loaded in memory when it needs this, so it calls this directly
// instead of computeGenreBadgeCounts below re-fetching the same user a
// second time.
export async function countGenreBadgesFromWatchlist(watchlist) {
  const Movie = mongoose.model("Movie");
  const Series = mongoose.model("Series");

  const movieIds = (watchlist || []).filter((w) => w.itemType === "movie").map((w) => w.itemId);
  const seriesIds = (watchlist || []).filter((w) => w.itemType === "series").map((w) => w.itemId);

  const [movieDocs, seriesDocs] = await Promise.all([
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }).select("genre_ids").lean() : [],
    seriesIds.length ? Series.find({ _id: { $in: seriesIds } }).select("genre_ids").lean() : [],
  ]);

  return genreBadgeCountsFromDocs(movieDocs, seriesDocs);
}

// Real, Watched-List-membership counts per genre (rated or not — direct
// ask, "sadece ratelenmiş olanları saymasın... watchedliste eklenenleri
// de saysın"), computed fresh from User.watchlist + Movie/Series.genre_ids
// rather than the persisted User.movieCineGraph/seriesCineGraph fields —
// those have known drift bugs from the TV Time/Letterboxd import and
// log-revert paths (see getUserGenreDetail's own comment on this exact
// tradeoff) and would silently show a wrong badge count/tier.
export async function computeGenreBadgeCounts(userId) {
  const user = await User.findById(userId).select("watchlist").lean();
  return countGenreBadgesFromWatchlist(user?.watchlist);
}

// @desc   Genre badge progress for the badges tab.
// @route  GET /api/badges/genres
// @access Private
export const getGenreBadges = asyncHandler(async (req, res) => {
  const badges = await computeGenreBadgeCounts(req.user.id);
  sendSuccess(res, { badges, devoteeThreshold: DEVOTEE_THRESHOLD, masterThreshold: MASTER_THRESHOLD }, "Genre badges fetched", 200);
});

// Volume badges — how many movies/series total are on the Watched List,
// bronze through diamond. Unlike genre badges (2 independent tiers, shown
// as 2 separate permanent tiles), this is a 5-rung ladder — showing all 5
// as separate tiles for both movies and series would add 10 tiles to a
// grid that was deliberately just simplified, so the mobile side shows
// ONE slot per category at its current tier instead (a level, not a
// collection) — see ProfileBadgesTab.tsx's own doc comment on that split.
// `tier` here is ordered lowest-to-highest on purpose: tierForVolume walks
// it forward and keeps the last (highest) threshold actually met, and
// mobile's own level-dot indicator reads a tier's position in this same
// array as "how many dots are filled."
export const VOLUME_TIERS = [
  { tier: "bronze", threshold: 10 },
  { tier: "silver", threshold: 50 },
  { tier: "gold", threshold: 100 },
  { tier: "platinum", threshold: 250 },
  { tier: "diamond", threshold: 500 },
];

// Generic ladder-walk, shared by every "N-rung, higher rung implies every
// lower one" badge family (volume, and now the count-based activity
// badges below) — takes the tiers array as a parameter instead of being
// hardcoded to one, so a new ladder is just a new array, not a new copy
// of this function. Exported so feedController.js's own "podium" badge
// (computePodiumBadge — see its own doc comment for why that one lives
// there instead of here) can reuse the exact same ladder-walk instead of
// a second copy.
export function tierForCount(count, tiers) {
  let result = null;
  for (const { tier, threshold } of tiers) {
    if (count >= threshold) result = tier;
  }
  return result;
}

// Same "landed EXACTLY on a threshold" reasoning as crossedThresholdTier
// above, generalized the same way tierForCount is.
function crossedCountTier(count, tiers) {
  const hit = tiers.find((t) => t.threshold === count);
  return hit ? hit.tier : null;
}

const tierForVolume = (count) => tierForCount(count, VOLUME_TIERS);

// Same "landed EXACTLY on a threshold" reasoning as crossedThresholdTier
// above, for the 5-rung volume ladder instead of the 2-rung genre one.
export const crossedVolumeTier = (count) => crossedCountTier(count, VOLUME_TIERS);

// crossedThresholdTier/crossedVolumeTier above only work because every
// real single-item add moves a count by exactly 1, so "landed exactly on
// a threshold" and "just crossed a threshold" are the same question. A
// bulk add (userWatchlistRoute.js's /watchlist/bulk, TC-133's onboarding
// quiz) can jump a genre or volume count by many at once and skip clean
// over a threshold without ever equaling it — e.g. 0 -> 18 never equals
// 15, so the devotee badge would silently never fire. This answers the
// real question for that case: every tier whose threshold falls strictly
// after `prevCount` and at or before `newCount`, i.e. every tier newly
// crossed by this one jump — possibly more than one at once (a big enough
// jump can cross both devotee and master, or several volume rungs, in a
// single bulk add), unlike the single-item helpers above which can only
// ever report one.
function crossedTiersInRange(prevCount, newCount, tiers) {
  return tiers.filter((t) => prevCount < t.threshold && t.threshold <= newCount).map((t) => t.tier);
}

export const crossedGenreTiersInRange = (prevCount, newCount) =>
  crossedTiersInRange(prevCount, newCount, [
    { tier: "devotee", threshold: DEVOTEE_THRESHOLD },
    { tier: "master", threshold: MASTER_THRESHOLD },
  ]);

export const crossedVolumeTiersInRange = (prevCount, newCount) => crossedTiersInRange(prevCount, newCount, VOLUME_TIERS);

// Same "count from an already-in-hand watchlist array" split as
// countGenreBadgesFromWatchlist/computeGenreBadgeCounts above, for the
// identical reason (userWatchlistRoute.js's add handler already has the
// updated array in memory). No genre_ids lookup needed at all here — a
// volume badge only cares about itemType, so this never touches Movie/
// Series collections.
export function countVolumeBadgesFromWatchlist(watchlist) {
  const moviesCount = (watchlist || []).filter((w) => w.itemType === "movie").length;
  const seriesCount = (watchlist || []).filter((w) => w.itemType === "series").length;
  return [
    { key: "movies", count: moviesCount, tier: tierForVolume(moviesCount) },
    { key: "series", count: seriesCount, tier: tierForVolume(seriesCount) },
  ];
}

export async function computeVolumeBadgeCounts(userId) {
  const user = await User.findById(userId).select("watchlist").lean();
  return countVolumeBadgesFromWatchlist(user?.watchlist);
}

// @desc   Volume badge progress (movies/series watched) for the badges tab.
// @route  GET /api/badges/volume
// @access Private
export const getVolumeBadges = asyncHandler(async (req, res) => {
  const badges = await computeVolumeBadgeCounts(req.user.id);
  sendSuccess(res, { badges, tiers: VOLUME_TIERS }, "Volume badges fetched", 200);
});

// Activity badges — 3 independent single-metric ladders (rating count,
// review count, list count), each shown the same "one slot + level-dot"
// way volume badges are (see ProfileBadgesTab.tsx's own doc comment on
// that split) since each is just one number climbing one ladder, same
// shape as movies/series, just not paired under one shared family. `tier`
// values are deliberately neutral ("tier1".."tierN", not invented words
// like genre's devotee/master) — same convention the badge ART's own file
// names already use (badge_rating_count_tier1.png etc.); real display
// names get invented mobile-side once art is in hand, same as volume's
// own Amateur..Cinephile ladder was.
export const RATING_COUNT_TIERS = [
  { tier: "tier1", threshold: 10 },
  { tier: "tier2", threshold: 30 },
  { tier: "tier3", threshold: 75 },
  { tier: "tier4", threshold: 150 },
  { tier: "tier5", threshold: 300 },
];
export const REVIEW_COUNT_TIERS = [
  { tier: "tier1", threshold: 3 },
  { tier: "tier2", threshold: 8 },
  { tier: "tier3", threshold: 15 },
  { tier: "tier4", threshold: 30 },
];
export const LIST_COUNT_TIERS = [
  { tier: "tier1", threshold: 1 },
  { tier: "tier2", threshold: 3 },
  { tier: "tier3", threshold: 6 },
];

// Each returns the same {badges: [{key,count,tier}]} shape
// computeGenreBadgeCounts/computeVolumeBadgeCounts already use (even
// though there's only ever one entry) so shareController.js's badge
// dispatch table can treat all 5 families identically. `key` is a real,
// semantic string (not a generic "count") so a family could grow a second
// key later — same reasoning volume's own "movies"/"series" keys — not
// just because this one happens to only need one right now.
export async function computeRatingCountBadge(userId) {
  const count = await Rating.countDocuments({ user: userId });
  return [{ key: "ratings", count, tier: tierForCount(count, RATING_COUNT_TIERS) }];
}
export const getRatingCountBadge = asyncHandler(async (req, res) => {
  const badges = await computeRatingCountBadge(req.user.id);
  sendSuccess(res, { badges, tiers: RATING_COUNT_TIERS }, "Rating count badge fetched", 200);
});

export async function computeReviewCountBadge(userId) {
  const count = await Review.countDocuments({ user: userId });
  return [{ key: "reviews", count, tier: tierForCount(count, REVIEW_COUNT_TIERS) }];
}
export const getReviewCountBadge = asyncHandler(async (req, res) => {
  const badges = await computeReviewCountBadge(req.user.id);
  sendSuccess(res, { badges, tiers: REVIEW_COUNT_TIERS }, "Review count badge fetched", 200);
});

export async function computeListCountBadge(userId) {
  const count = await CustomList.countDocuments({ owner: userId });
  return [{ key: "lists", count, tier: tierForCount(count, LIST_COUNT_TIERS) }];
}
export const getListCountBadge = asyncHandler(async (req, res) => {
  const badges = await computeListCountBadge(req.user.id);
  sendSuccess(res, { badges, tiers: LIST_COUNT_TIERS }, "List count badge fetched", 200);
});

// Same "did this specific action land EXACTLY on a threshold" question as
// crossedThresholdTier/crossedVolumeTier, generalized for the 3 activity
// ladders — exported as one function taking the tiers array rather than 3
// near-identical exports, since the 3 call sites (ratingController.js,
// reviewController.js, customListRoute.js) each already know which tiers
// array they mean.
export const crossedActivityTier = (count, tiers) => crossedCountTier(count, tiers);

// Social badges — followers (real audience size) and influencer (total
// likes received across a user's own Shares — the same signal the
// people-podium's own "Most Liked" ranking uses, just as a personal
// ladder here instead of a top-3). Thresholds picked from a real
// distribution check (followers: median 3, max 12 across 96 seeded
// users; summed likeCount: median 6, max 63) scaled up into round,
// aspirational numbers rather than curve-fit to this dev DB's current
// size — same approach the activity ladders' own thresholds used.
//
// Deliberately NOT event-detected anywhere (no `newlyEarnedBadges` push
// for either of these): both cross their threshold from SOMEONE ELSE's
// action (another user following you, or liking one of your posts), not
// your own — the live "you just earned a badge!" popup this app's other
// badges all use is built around the SAME request that changes your own
// count also telling you about it, which doesn't hold here. A real-time
// cross-user notification would need its own delivery mechanism (a push/
// socket message to the target's own active session) that this feature
// doesn't need to justify building; both badges are still fully correct
// whenever the target actually opens their own Badges tab or shares one,
// same "live-computed on every fetch" model every badge here already
// uses — only the instant pop-up moment is the deliberate gap.
export const FOLLOWERS_TIERS = [
  { tier: "tier1", threshold: 3 },
  { tier: "tier2", threshold: 10 },
  { tier: "tier3", threshold: 25 },
  { tier: "tier4", threshold: 50 },
];
export const INFLUENCER_TIERS = [
  { tier: "tier1", threshold: 5 },
  { tier: "tier2", threshold: 20 },
  { tier: "tier3", threshold: 50 },
];

export async function computeFollowersBadge(userId) {
  const user = await User.findById(userId).select("followers").lean();
  const count = (user?.followers || []).length;
  return [{ key: "followers", count, tier: tierForCount(count, FOLLOWERS_TIERS) }];
}
export const getFollowersBadge = asyncHandler(async (req, res) => {
  const badges = await computeFollowersBadge(req.user.id);
  sendSuccess(res, { badges, tiers: FOLLOWERS_TIERS }, "Followers badge fetched", 200);
});

export async function computeInfluencerBadge(userId) {
  const agg = await Share.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: "$likeCount" } } },
  ]);
  const count = agg[0]?.total || 0;
  return [{ key: "likes", count, tier: tierForCount(count, INFLUENCER_TIERS) }];
}
export const getInfluencerBadge = asyncHandler(async (req, res) => {
  const badges = await computeInfluencerBadge(req.user.id);
  sendSuccess(res, { badges, tiers: INFLUENCER_TIERS }, "Influencer badge fetched", 200);
});

// Sync badges — 3 one-off (not tiered) badges built entirely from
// MatchAnalysisLog, the only persisted trace of the CineMatch "Analyze"
// action (matchController.js's analyzeMatchWithUser). Modeled as a
// DEGENERATE 1-rung ladder each (`tiers` has exactly one entry) rather
// than a bespoke "boolean badge" shape — this lets every one of these
// reuse the exact same tierForCount/crossedCountTier machinery and the
// exact same {badges:[{key,count,tier}], tiers} response shape, so
// shareController.js's BADGE_FAMILIES dispatch table needs zero special-
// casing for "one-off" vs "ladder" badges. Only browsing (getSyncCandidates)
// and viewing a cached score (getMatchWithUser) leave no persisted trace —
// only a completed Analyze does, so these 3 badges are scoped to that
// specific action, not "used Sync" in general (confirmed directly against
// the schema before building this, not assumed).
export const FIRST_SYNC_TIERS = [{ tier: "tier1", threshold: 1 }];
// 80%+ deliberately chosen as an unambiguously "high" compatibility
// reading (matchPercentage is 0-100) rather than curve-fit to this dev
// DB's own thin data (no score was even persisted before this feature).
export const HIGH_MATCH_TIERS = [{ tier: "tier1", threshold: 80 }];
// 5 distinct people is comfortably above this dev DB's own current
// average (6.44) without being tied to it — an aspirational, round
// number, not a curve fit, same approach every other ladder's own
// thresholds already used.
export const SYNC_EXPLORER_TIERS = [{ tier: "tier1", threshold: 5 }];

export async function computeFirstSyncBadge(userId) {
  const count = await MatchAnalysisLog.countDocuments({ user: userId });
  return [{ key: "firstSync", count, tier: tierForCount(count, FIRST_SYNC_TIERS) }];
}
export const getFirstSyncBadge = asyncHandler(async (req, res) => {
  const badges = await computeFirstSyncBadge(req.user.id);
  sendSuccess(res, { badges, tiers: FIRST_SYNC_TIERS }, "First sync badge fetched", 200);
});

export async function computeHighMatchBadge(userId) {
  const best = await MatchAnalysisLog.findOne({ user: userId }).sort({ score: -1 }).select("score").lean();
  const count = best?.score || 0;
  return [{ key: "highMatch", count, tier: tierForCount(count, HIGH_MATCH_TIERS) }];
}
export const getHighMatchBadge = asyncHandler(async (req, res) => {
  const badges = await computeHighMatchBadge(req.user.id);
  sendSuccess(res, { badges, tiers: HIGH_MATCH_TIERS }, "High match badge fetched", 200);
});

export async function computeSyncExplorerBadge(userId) {
  const distinctTargets = await MatchAnalysisLog.distinct("targetUser", { user: userId });
  const count = distinctTargets.length;
  return [{ key: "syncExplorer", count, tier: tierForCount(count, SYNC_EXPLORER_TIERS) }];
}
export const getSyncExplorerBadge = asyncHandler(async (req, res) => {
  const badges = await computeSyncExplorerBadge(req.user.id);
  sendSuccess(res, { badges, tiers: SYNC_EXPLORER_TIERS }, "Sync explorer badge fetched", 200);
});

// Loyalty badges — founding cinephile (one-off), membership anniversary
// (3 tiers), and streak (3 tiers, real day-counts as tier values — see
// below). All 3 read straight off `User` (createdAt for the first two,
// the new currentStreak/lastStreakDate pair for the third), no new
// collection needed.

// Founding Cinephile — the first FOUNDING_CINEPHILE_CUTOFF people ever
// registered (by createdAt, official account excluded), a fixed absolute
// rank cutoff rather than a percentage of the user base or a fixed
// calendar date. A percentage-of-timeline rule was checked directly
// against this app's real registration data and rejected: registrations
// are heavily front-loaded (most accounts were bulk-seeded near launch),
// so "earliest 10% of the timeline" would tag the large majority of all
// users as founders — a fixed round number behaves sensibly regardless of
// how bursty real registration turns out to be, and still means something
// once the user base grows well past this cutoff.
export const FOUNDING_CINEPHILE_CUTOFF = 100;
// Only the threshold's own display value is real here — `tierForCount`
// isn't used for this one at all (see computeFoundingCinephileBadge):
// "was this account's registration RANK small enough" is the inverse of
// "was this COUNT large enough" every other ladder answers, so this
// family's own compute function does its own direct comparison instead.
export const FOUNDING_TIERS = [{ tier: "tier1", threshold: FOUNDING_CINEPHILE_CUTOFF }];

export async function computeFoundingCinephileBadge(userId) {
  const user = await User.findById(userId).select("createdAt isOfficial").lean();
  if (!user || user.isOfficial || !user.createdAt) return [{ key: "founding", count: 0, tier: null }];
  const rank = await User.countDocuments({ isOfficial: { $ne: true }, createdAt: { $lte: user.createdAt } });
  return [{ key: "founding", count: rank, tier: rank <= FOUNDING_CINEPHILE_CUTOFF ? "tier1" : null }];
}
export const getFoundingCinephileBadge = asyncHandler(async (req, res) => {
  const badges = await computeFoundingCinephileBadge(req.user.id);
  sendSuccess(res, { badges, tiers: FOUNDING_TIERS }, "Founding cinephile badge fetched", 200);
});

// Membership anniversary — account age in days. Scaled in
// weeks/months, not years: checked directly against this app's real
// registration data first (oldest account is ~265 days old, so a 1-year
// tier would currently be unreachable by anyone) rather than picked blind.
export const MEMBERSHIP_TIERS = [
  { tier: "tier1", threshold: 30 },
  { tier: "tier2", threshold: 90 },
  { tier: "tier3", threshold: 180 },
];

export async function computeMembershipBadge(userId) {
  const user = await User.findById(userId).select("createdAt").lean();
  const days = user?.createdAt ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000) : 0;
  return [{ key: "membership", count: days, tier: tierForCount(days, MEMBERSHIP_TIERS) }];
}
export const getMembershipBadge = asyncHandler(async (req, res) => {
  const badges = await computeMembershipBadge(req.user.id);
  sendSuccess(res, { badges, tiers: MEMBERSHIP_TIERS }, "Membership badge fetched", 200);
});

// Streak — consecutive CALENDAR days (UTC) with at least one genuinely
// engaging action (a new/edited rating, a new/edited review, a new list,
// or a watchlist add — the same 4 endpoints activity badges already hook
// into). Deliberately real day-counts as tier VALUES ("7day"/"30day"/
// "100day"), not generic "tier1".."tierN" — the one other exception to
// that convention besides genre's own devotee/master, for the identical
// reason: these are genuine, fixed, well-known milestones (also already
// reflected in the badge art's own file names,
// badge_streak_7day/30day/100day.png), not an arbitrary ladder.
export const STREAK_TIERS = [
  { tier: "7day", threshold: 7 },
  { tier: "30day", threshold: 30 },
  { tier: "100day", threshold: 100 },
];

// A stored `currentStreak` only reflects reality up through whatever day
// it was last bumped — with no cron job re-checking it, a streak that
// stopped 3 days ago would otherwise still report its old (stale) length
// forever. This is the "did it actually survive to today" check every
// READ of the streak goes through: still alive if the last qualifying
// activity was today or yesterday (yesterday is still "alive" since
// today's own qualifying action just hasn't happened yet), decayed to 0
// otherwise — the underlying stored fields themselves are only ever
// corrected for real on the user's own next bumpStreak call.
// Pulled out of currentStreakValue so TC-136's separate puzzle-streak
// fields (puzzleStreak/lastPuzzleStreakDate) can share the exact same
// decay math against their own field pair, instead of a second copy of
// this date arithmetic.
export function decayedStreakCount(count, lastDate) {
  if (!lastDate) return 0;
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const last = new Date(lastDate);
  const lastUTC = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
  const daysSince = (todayUTC - lastUTC) / 86400000;
  return daysSince <= 1 ? count || 0 : 0;
}

function currentStreakValue(user) {
  return decayedStreakCount(user?.currentStreak, user?.lastStreakDate);
}

export async function computeStreakBadge(userId) {
  const user = await User.findById(userId).select("currentStreak lastStreakDate").lean();
  const count = currentStreakValue(user);
  return [{ key: "streak", count, tier: tierForCount(count, STREAK_TIERS) }];
}
export const getStreakBadge = asyncHandler(async (req, res) => {
  const badges = await computeStreakBadge(req.user.id);
  sendSuccess(res, { badges, tiers: STREAK_TIERS }, "Streak badge fetched", 200);
});

// Advances (or resets, or no-ops) the caller's own streak — called from
// the same 4 engagement endpoints activity badges already hook into
// (ratingController.js, reviewController.js, customListRoute.js,
// userWatchlistRoute.js), unconditionally (unlike those badges' own
// "only a genuinely NEW document" guards) since a streak cares about
// DAILY PRESENCE, not document counts — even editing an existing rating
// is real evidence the user showed up today. Idempotent within a single
// day: a second qualifying action on the same calendar day is a no-op
// (returns null, same as "nothing newly earned"), so calling this from
// multiple action types on the same day never double-advances the streak.
// Returns a NewlyEarnedBadge-shaped object the instant the bump itself
// lands exactly on a threshold, or null otherwise — same "crossed exactly
// on this action" contract crossedActivityTier already established for
// the count-based ladders.
export async function bumpStreak(userId) {
  const user = await User.findById(userId).select("currentStreak lastStreakDate").lean();
  if (!user) return null;

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let newStreak;
  if (user.lastStreakDate) {
    const last = new Date(user.lastStreakDate);
    const lastUTC = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
    const daysSince = (todayUTC - lastUTC) / 86400000;
    if (daysSince === 0) return null; // already bumped today
    newStreak = daysSince === 1 ? (user.currentStreak || 0) + 1 : 1;
  } else {
    newStreak = 1;
  }

  await User.updateOne({ _id: userId }, { $set: { currentStreak: newStreak, lastStreakDate: new Date(todayUTC) } });

  const crossedTier = crossedActivityTier(newStreak, STREAK_TIERS);
  if (!crossedTier) return null;
  const threshold = STREAK_TIERS.find((t) => t.tier === crossedTier).threshold;
  return { family: "streak", key: "streak", count: newStreak, tier: crossedTier, threshold };
}

// TC-136's daily guessing game — its own streak, deliberately separate
// from bumpStreak/STREAK_TIERS above (see User.js's own field comment for
// why). Same ladder shape/day-count tier values, same decay-on-read
// contract, same "exact threshold crossing" event-detection — a direct
// copy against puzzleStreak/lastPuzzleStreakDate instead of
// currentStreak/lastStreakDate, not a generalization of the one above,
// matching this file's own existing tolerance for this kind of small
// per-feature duplication over a shared parameterized helper.
export const PUZZLE_STREAK_TIERS = [
  { tier: "7day", threshold: 7 },
  { tier: "30day", threshold: 30 },
  { tier: "100day", threshold: 100 },
];

export async function computePuzzleStreakBadge(userId) {
  const user = await User.findById(userId).select("puzzleStreak lastPuzzleStreakDate").lean();
  const count = decayedStreakCount(user?.puzzleStreak, user?.lastPuzzleStreakDate);
  return [{ key: "puzzleStreak", count, tier: tierForCount(count, PUZZLE_STREAK_TIERS) }];
}

export async function bumpPuzzleStreak(userId) {
  const user = await User.findById(userId).select("puzzleStreak lastPuzzleStreakDate").lean();
  if (!user) return null;

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let newStreak;
  if (user.lastPuzzleStreakDate) {
    const last = new Date(user.lastPuzzleStreakDate);
    const lastUTC = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
    const daysSince = (todayUTC - lastUTC) / 86400000;
    if (daysSince === 0) return null; // already solved today's puzzle
    newStreak = daysSince === 1 ? (user.puzzleStreak || 0) + 1 : 1;
  } else {
    newStreak = 1;
  }

  await User.updateOne({ _id: userId }, { $set: { puzzleStreak: newStreak, lastPuzzleStreakDate: new Date(todayUTC) } });

  const crossedTier = crossedActivityTier(newStreak, PUZZLE_STREAK_TIERS);
  if (!crossedTier) return null;
  const threshold = PUZZLE_STREAK_TIERS.find((t) => t.tier === crossedTier).threshold;
  return { family: "puzzleStreak", key: "puzzleStreak", count: newStreak, tier: crossedTier, threshold };
}

// Special + seasonal badges — 7 one-off badges (same degenerate 1-rung-
// ladder shape as founding/firstSync/etc. above), none of them event-
// detected: each is a fact discovered by looking at the user's existing
// Watched List / rating history, not something a single action visibly
// "crosses" the way a count-based ladder does. All computed live, same as
// every badge in this file — nothing here is persisted as "earned."

export const TIME_TRAVELER_TIERS = [{ tier: "tier1", threshold: 1 }];
// A movie/series released before this date, sitting on the user's own
// Watched List — 1970 checked directly against this app's real catalog
// first (137k+ movies qualify, and over a third of this dev DB's own
// users already have something pre-1970 on their list), not picked blind.
export const TIME_TRAVELER_CUTOFF = "1970-01-01";
// Guards against a missing/malformed release_date (empty string, etc.)
// sorting before the cutoff by pure string comparison and falsely
// qualifying — TMDB dates are always well after this floor when present.
const REAL_DATE_FLOOR = "1900-01-01";

export async function computeTimeTravelerBadge(userId) {
  const Movie = mongoose.model("Movie");
  const Series = mongoose.model("Series");
  const user = await User.findById(userId).select("watchlist").lean();
  const watchlist = user?.watchlist || [];
  const movieIds = watchlist.filter((w) => w.itemType === "movie").map((w) => w.itemId);
  const seriesIds = watchlist.filter((w) => w.itemType === "series").map((w) => w.itemId);

  const [oldMovie, oldSeries] = await Promise.all([
    movieIds.length
      ? Movie.exists({ _id: { $in: movieIds }, release_date: { $gte: REAL_DATE_FLOOR, $lt: TIME_TRAVELER_CUTOFF } })
      : null,
    seriesIds.length
      ? Series.exists({ _id: { $in: seriesIds }, first_air_date: { $gte: REAL_DATE_FLOOR, $lt: TIME_TRAVELER_CUTOFF } })
      : null,
  ]);

  const earned = Boolean(oldMovie || oldSeries);
  return [{ key: "timeTraveler", count: earned ? 1 : 0, tier: earned ? "tier1" : null }];
}
export const getTimeTravelerBadge = asyncHandler(async (req, res) => {
  const badges = await computeTimeTravelerBadge(req.user.id);
  sendSuccess(res, { badges, tiers: TIME_TRAVELER_TIERS }, "Time traveler badge fetched", 200);
});

// Eclectic Taste — reuses the SAME unified genre system GENRE_BADGES
// already establishes (not raw TMDB genre_ids, which would count e.g.
// movie "Action" and series "Action & Adventure" as two separate genres)
// so this can never quietly disagree with what the Genre badges tab
// itself shows. Earned once at least MIN_GENRES of those keys (18, as of
// the adventure/animation/crime/family/fantasy/history/musical/mystery/
// war/western expansion) have any real count at all — deliberately NOT
// requiring devotee-level counts in each, since this badge is about
// BREADTH of taste, not depth in any one. MIN_GENRES stays 6 (unchanged
// by that expansion — still a meaningful "genuinely eclectic" bar, not
// automatically raised just because more genres exist to draw from).
export const ECLECTIC_TASTE_MIN_GENRES = 6;
// threshold is the real gating number here (unlike every other one-off
// badge's own dummy `1`) since `count` is a genuinely meaningful number
// for this one (distinct genres touched, out of GENRE_BADGES.length
// possible) — the share payload's own `threshold` field should reflect
// that, not a placeholder.
export const ECLECTIC_TASTE_TIERS = [{ tier: "tier1", threshold: ECLECTIC_TASTE_MIN_GENRES }];

export async function computeEclecticTasteBadge(userId) {
  const counts = await computeGenreBadgeCounts(userId);
  const distinctGenres = counts.filter((c) => c.count >= 1).length;
  const earned = distinctGenres >= ECLECTIC_TASTE_MIN_GENRES;
  return [{ key: "eclecticTaste", count: distinctGenres, tier: earned ? "tier1" : null }];
}
export const getEclecticTasteBadge = asyncHandler(async (req, res) => {
  const badges = await computeEclecticTasteBadge(req.user.id);
  sendSuccess(res, { badges, tiers: ECLECTIC_TASTE_TIERS }, "Eclectic taste badge fetched", 200);
});

// Day-One Viewer — a Watched-List add whose OWN `addedAt` calendar day
// exactly matches that title's real release/air date. Checked directly
// against this app's real data first: zero matches exist anywhere in the
// current dev DB (expected — bulk-seeded `addedAt` timestamps were never
// going to coincidentally land on a real release date), so this is a
// genuinely rare, real achievement rather than one quietly already
// trivial for most users the way a couple of the other badges turned out
// to be at this app's current small scale.
export const DAY_ONE_VIEWER_TIERS = [{ tier: "tier1", threshold: 1 }];

export async function computeDayOneViewerBadge(userId) {
  const Movie = mongoose.model("Movie");
  const Series = mongoose.model("Series");
  const user = await User.findById(userId).select("watchlist").lean();
  const watchlist = user?.watchlist || [];
  const movieIds = watchlist.filter((w) => w.itemType === "movie").map((w) => w.itemId);
  const seriesIds = watchlist.filter((w) => w.itemType === "series").map((w) => w.itemId);

  const [movieDocs, seriesDocs] = await Promise.all([
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }).select("release_date").lean() : [],
    seriesIds.length ? Series.find({ _id: { $in: seriesIds } }).select("first_air_date").lean() : [],
  ]);
  const movieDateById = new Map(movieDocs.map((d) => [d._id.toString(), d.release_date]));
  const seriesDateById = new Map(seriesDocs.map((d) => [d._id.toString(), d.first_air_date]));

  const earned = watchlist.some((w) => {
    if (!w.addedAt) return false;
    const addedDay = new Date(w.addedAt).toISOString().slice(0, 10);
    const releaseDate = w.itemType === "movie" ? movieDateById.get(w.itemId.toString()) : seriesDateById.get(w.itemId.toString());
    return releaseDate === addedDay;
  });

  return [{ key: "dayOneViewer", count: earned ? 1 : 0, tier: earned ? "tier1" : null }];
}
export const getDayOneViewerBadge = asyncHandler(async (req, res) => {
  const badges = await computeDayOneViewerBadge(req.user.id);
  sendSuccess(res, { badges, tiers: DAY_ONE_VIEWER_TIERS }, "Day-one viewer badge fetched", 200);
});

// Hidden Gem Hunter — a real title the user rated highly that almost
// nobody else on the app has ever watched. Deliberately NOT built on
// TMDB's own vote_average/vote_count fields (checked directly first:
// only 169 of this catalog's 578k+ movies even HAVE those fields at all —
// the bulk TMDB import never populated them) — instead derived entirely
// from this app's own data: how many total users have a title on their
// own Watched List. Scoped to just the current user's own highly-rated
// titles (never a full-catalog scan) so the watcher-count aggregation
// stays cheap regardless of catalog size.
export const HIDDEN_GEM_TIERS = [{ tier: "tier1", threshold: 1 }];
export const HIDDEN_GEM_MIN_RATING = 8;
export const HIDDEN_GEM_MAX_WATCHERS = 3;

export async function computeHiddenGemBadge(userId) {
  const highRatings = await Rating.find({ user: userId, value: { $gte: HIDDEN_GEM_MIN_RATING } })
    .select("contentId contentType")
    .lean();
  if (highRatings.length === 0) return [{ key: "hiddenGem", count: 0, tier: null }];

  const movieIds = highRatings.filter((r) => r.contentType === "movie").map((r) => new mongoose.Types.ObjectId(r.contentId));
  const seriesIds = highRatings.filter((r) => r.contentType === "series").map((r) => new mongoose.Types.ObjectId(r.contentId));

  // A `$match` before `$unwind` — narrowing to users whose watchlist has
  // at least one of these specific items (via `$elemMatch`, evaluated
  // in-place against the array, no unwind needed to check it) — lets
  // MongoDB skip unwinding the (potentially long) watchlist of every
  // OTHER user first. Unwinding the whole users collection's watchlists
  // up front, every time this ran, was a real, measured contributor to
  // the Badges tab's own reported slowness (it runs on every load,
  // regardless of whether this specific badge is even close to earned).
  const [movieWatcherCounts, seriesWatcherCounts] = await Promise.all([
    movieIds.length
      ? User.aggregate([
          { $match: { watchlist: { $elemMatch: { itemType: "movie", itemId: { $in: movieIds } } } } },
          { $unwind: "$watchlist" },
          { $match: { "watchlist.itemType": "movie", "watchlist.itemId": { $in: movieIds } } },
          { $group: { _id: "$watchlist.itemId", count: { $sum: 1 } } },
        ])
      : [],
    seriesIds.length
      ? User.aggregate([
          { $match: { watchlist: { $elemMatch: { itemType: "series", itemId: { $in: seriesIds } } } } },
          { $unwind: "$watchlist" },
          { $match: { "watchlist.itemType": "series", "watchlist.itemId": { $in: seriesIds } } },
          { $group: { _id: "$watchlist.itemId", count: { $sum: 1 } } },
        ])
      : [],
  ]);

  const earned = [...movieWatcherCounts, ...seriesWatcherCounts].some((c) => c.count <= HIDDEN_GEM_MAX_WATCHERS);
  return [{ key: "hiddenGem", count: earned ? 1 : 0, tier: earned ? "tier1" : null }];
}
export const getHiddenGemBadge = asyncHandler(async (req, res) => {
  const badges = await computeHiddenGemBadge(req.user.id);
  sendSuccess(res, { badges, tiers: HIDDEN_GEM_TIERS }, "Hidden gem badge fetched", 200);
});

// Poll Participant — voted on any official poll-type Share
// (shareController.js's voteOnPoll). Real, already-active data: 22 poll
// shares and 20 real votes already exist in this app's own dev DB from
// the official-account content feature.
export const POLL_PARTICIPANT_TIERS = [{ tier: "tier1", threshold: 1 }];

export async function computePollParticipantBadge(userId) {
  const voted = await Share.exists({ type: "poll", "pollData.options.votes": new mongoose.Types.ObjectId(userId) });
  return [{ key: "pollParticipant", count: voted ? 1 : 0, tier: voted ? "tier1" : null }];
}
export const getPollParticipantBadge = asyncHandler(async (req, res) => {
  const badges = await computePollParticipantBadge(req.user.id);
  sendSuccess(res, { badges, tiers: POLL_PARTICIPANT_TIERS }, "Poll participant badge fetched", 200);
});

// Halloween Viewer — a Horror movie added to the Watched List during the
// month of October (any year, recurring annually) — genre resolved via
// the same MOVIE_GENRE_MAP already used everywhere else in this file,
// not a second genre-name table.
export const HALLOWEEN_VIEWER_TIERS = [{ tier: "tier1", threshold: 1 }];
const OCTOBER_UTC_MONTH = 9; // Date.getUTCMonth() is 0-indexed

export async function computeHalloweenViewerBadge(userId) {
  const Movie = mongoose.model("Movie");
  const user = await User.findById(userId).select("watchlist").lean();
  const watchlist = user?.watchlist || [];
  const octoberMovieIds = watchlist
    .filter((w) => w.itemType === "movie" && w.addedAt && new Date(w.addedAt).getUTCMonth() === OCTOBER_UTC_MONTH)
    .map((w) => w.itemId);

  let earned = false;
  if (octoberMovieIds.length) {
    const docs = await Movie.find({ _id: { $in: octoberMovieIds } }).select("genre_ids").lean();
    earned = docs.some((m) => (m.genre_ids || []).some((g) => MOVIE_GENRE_MAP[g] === "Horror"));
  }

  return [{ key: "halloweenViewer", count: earned ? 1 : 0, tier: earned ? "tier1" : null }];
}
export const getHalloweenViewerBadge = asyncHandler(async (req, res) => {
  const badges = await computeHalloweenViewerBadge(req.user.id);
  sendSuccess(res, { badges, tiers: HALLOWEEN_VIEWER_TIERS }, "Halloween viewer badge fetched", 200);
});

// New Year Viewer — anything added to the Watched List on Dec 31 or
// Jan 1 (any year) — no genre restriction, unlike Halloween, since New
// Year's is about the calendar moment itself, not a content theme.
export const NEW_YEAR_VIEWER_TIERS = [{ tier: "tier1", threshold: 1 }];

export async function computeNewYearViewerBadge(userId) {
  const user = await User.findById(userId).select("watchlist").lean();
  const watchlist = user?.watchlist || [];
  const earned = watchlist.some((w) => {
    if (!w.addedAt) return false;
    const d = new Date(w.addedAt);
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    return (month === 11 && day === 31) || (month === 0 && day === 1);
  });
  return [{ key: "newYearViewer", count: earned ? 1 : 0, tier: earned ? "tier1" : null }];
}
export const getNewYearViewerBadge = asyncHandler(async (req, res) => {
  const badges = await computeNewYearViewerBadge(req.user.id);
  sendSuccess(res, { badges, tiers: NEW_YEAR_VIEWER_TIERS }, "New Year viewer badge fetched", 200);
});

const GENRE_TIER_ORDER = ["devotee", "master"];

// A ladder-shaped count array's own contribution to the "Most Badges"
// total — how many rungs of `tiers` have actually been climbed, summed
// across every entry in `counts` (there's only ever one entry for the 3
// activity families, but this works identically for volume's two).
function ladderTotal(counts, tiers) {
  return counts.reduce((sum, c) => sum + (c.tier ? tiers.findIndex((t) => t.tier === c.tier) + 1 : 0), 0);
}

// One comparable number across EVERY badge family, for the "Most Badges"
// people-podium ranking (feedController.js) — a viewer comparing two users
// doesn't want a dozen separate per-key numbers, just "who has more." A
// genre key is worth up to 2 (devotee=1, master=2 — master already
// implies devotee's threshold was crossed too, so it's counted as if both
// rungs were earned) and every other ladder (volume, and now the 3
// activity ones) is worth up to its own rung count — the same "a higher
// tier doesn't retire the lower one" reasoning ProfileBadgesTab.tsx's own
// doc comment already gives for showing all of them, just collapsed into
// one sum here. Deliberately excludes the "podium" badge (feedController.
// js's own computePodiumBadge) — Most Badges is itself one of the podium's
// own categories, so folding podium's count in here would be
// self-referential (being podium-decorated would inflate the very total
// that decides whether you're podium-decorated).
function totalBadgeCount(
  genreCounts,
  volumeCounts,
  ratingCounts,
  reviewCounts,
  listCounts,
  followersCounts,
  influencerCounts,
  firstSyncCounts,
  highMatchCounts,
  syncExplorerCounts,
  foundingCounts,
  membershipCounts,
  streakCounts,
  timeTravelerCounts,
  eclecticTasteCounts,
  dayOneViewerCounts,
  hiddenGemCounts,
  pollParticipantCounts,
  halloweenViewerCounts,
  newYearViewerCounts
) {
  const genreTotal = genreCounts.reduce((sum, c) => sum + (c.tier ? GENRE_TIER_ORDER.indexOf(c.tier) + 1 : 0), 0);
  return (
    genreTotal +
    ladderTotal(volumeCounts, VOLUME_TIERS) +
    ladderTotal(ratingCounts, RATING_COUNT_TIERS) +
    ladderTotal(reviewCounts, REVIEW_COUNT_TIERS) +
    ladderTotal(listCounts, LIST_COUNT_TIERS) +
    ladderTotal(followersCounts, FOLLOWERS_TIERS) +
    ladderTotal(influencerCounts, INFLUENCER_TIERS) +
    ladderTotal(firstSyncCounts, FIRST_SYNC_TIERS) +
    ladderTotal(highMatchCounts, HIGH_MATCH_TIERS) +
    ladderTotal(syncExplorerCounts, SYNC_EXPLORER_TIERS) +
    ladderTotal(foundingCounts, FOUNDING_TIERS) +
    ladderTotal(membershipCounts, MEMBERSHIP_TIERS) +
    ladderTotal(streakCounts, STREAK_TIERS) +
    ladderTotal(timeTravelerCounts, TIME_TRAVELER_TIERS) +
    ladderTotal(eclecticTasteCounts, ECLECTIC_TASTE_TIERS) +
    ladderTotal(dayOneViewerCounts, DAY_ONE_VIEWER_TIERS) +
    ladderTotal(hiddenGemCounts, HIDDEN_GEM_TIERS) +
    ladderTotal(pollParticipantCounts, POLL_PARTICIPANT_TIERS) +
    ladderTotal(halloweenViewerCounts, HALLOWEEN_VIEWER_TIERS) +
    ladderTotal(newYearViewerCounts, NEW_YEAR_VIEWER_TIERS)
  );
}

// Ranks EVERY user's total badge count at once — feedController.js's
// "Most Badges" podium category. Takes already-fetched user docs (each
// with its own `watchlist`) rather than querying User itself, so the
// caller controls the exact same `isOfficial`-excluded, already-in-memory
// set every other podium category ranks over. Deliberately NOT N separate
// calls to countGenreBadgesFromWatchlist (one Movie.find + one Series.find
// PER USER) — that's fine at this app's current real size (see this
// file's own sibling comments on the same tradeoff elsewhere), but this
// still fetches every referenced Movie/Series doc across ALL users in
// exactly one batched pair of queries and reuses that one map per user,
// rather than paying the 2-queries-per-user cost for no reason.
export async function computeAllUsersBadgeCounts(users) {
  const Movie = mongoose.model("Movie");
  const Series = mongoose.model("Series");

  const movieIds = new Set();
  const seriesIds = new Set();
  for (const u of users) {
    for (const w of u.watchlist || []) {
      if (w.itemType === "movie") movieIds.add(w.itemId.toString());
      else if (w.itemType === "series") seriesIds.add(w.itemId.toString());
    }
  }

  const [movieDocs, seriesDocs, ratingAgg, reviewAgg, listAgg, likeAgg, syncAgg, watcherAgg, pollVoterDocs, highRatingDocs] =
    await Promise.all([
      movieIds.size ? Movie.find({ _id: { $in: [...movieIds] } }).select("genre_ids release_date").lean() : [],
      seriesIds.size ? Series.find({ _id: { $in: [...seriesIds] } }).select("genre_ids first_air_date").lean() : [],
      Rating.aggregate([{ $group: { _id: "$user", count: { $sum: 1 } } }]),
      Review.aggregate([{ $group: { _id: "$user", count: { $sum: 1 } } }]),
      CustomList.aggregate([{ $group: { _id: "$owner", count: { $sum: 1 } } }]),
      Share.aggregate([{ $group: { _id: "$user", count: { $sum: "$likeCount" } } }]),
      MatchAnalysisLog.aggregate([
        { $group: { _id: "$user", count: { $sum: 1 }, maxScore: { $max: "$score" }, targets: { $addToSet: "$targetUser" } } },
        { $project: { count: 1, maxScore: 1, targetCount: { $size: "$targets" } } },
      ]),
      // How many total users have EACH item on their own Watched List —
      // for Hidden Gem Hunter below. Computed once across every item any
      // user has (not scoped to high ratings first) since this app's
      // total combined watchlist size is small; reused as one shared
      // lookup for every user's own hidden-gem check instead of computing
      // it per user.
      User.aggregate([
        { $unwind: "$watchlist" },
        { $group: { _id: { itemId: "$watchlist.itemId", itemType: "$watchlist.itemType" }, count: { $sum: 1 } } },
      ]),
      Share.aggregate([
        { $match: { type: "poll" } },
        { $unwind: "$pollData.options" },
        { $unwind: "$pollData.options.votes" },
        { $group: { _id: "$pollData.options.votes" } },
      ]),
      Rating.find({ value: { $gte: HIDDEN_GEM_MIN_RATING } }).select("user contentId contentType").lean(),
    ]);
  const movieById = new Map(movieDocs.map((d) => [d._id.toString(), d]));
  const seriesById = new Map(seriesDocs.map((d) => [d._id.toString(), d]));
  const ratingCountById = new Map(ratingAgg.map((r) => [r._id.toString(), r.count]));
  const reviewCountById = new Map(reviewAgg.map((r) => [r._id.toString(), r.count]));
  const listCountById = new Map(listAgg.map((r) => [r._id.toString(), r.count]));
  const likeCountById = new Map(likeAgg.map((r) => [r._id.toString(), r.count]));
  const syncById = new Map(syncAgg.map((r) => [r._id.toString(), r]));
  const watcherCountByItem = new Map(watcherAgg.map((w) => [`${w._id.itemId}_${w._id.itemType}`, w.count]));
  const pollVoterIds = new Set(pollVoterDocs.map((d) => d._id.toString()));
  const highRatingsByUser = new Map();
  for (const r of highRatingDocs) {
    const key = r.user.toString();
    if (!highRatingsByUser.has(key)) highRatingsByUser.set(key, []);
    highRatingsByUser.get(key).push(r);
  }

  // Founding-cinephile rank — computed once in memory by sorting the same
  // already-fetched `users` set by createdAt, rather than N separate
  // countDocuments queries (one per user) the way computeFoundingCinephile
  // Badge's own single-user version does; every rank 1..N falls straight
  // out of the sorted position.
  const rankById = new Map(
    users
      .slice()
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map((u, i) => [u._id.toString(), i + 1])
  );

  return users.map((u) => {
    const watchlist = u.watchlist || [];
    const userMovieDocs = watchlist
      .filter((w) => w.itemType === "movie")
      .map((w) => movieById.get(w.itemId.toString()))
      .filter(Boolean);
    const userSeriesDocs = watchlist
      .filter((w) => w.itemType === "series")
      .map((w) => seriesById.get(w.itemId.toString()))
      .filter(Boolean);

    const genreCounts = genreBadgeCountsFromDocs(userMovieDocs, userSeriesDocs);
    const volumeCounts = countVolumeBadgesFromWatchlist(watchlist);
    const idStr = u._id.toString();
    const ratingCounts = [{ key: "ratings", tier: tierForCount(ratingCountById.get(idStr) || 0, RATING_COUNT_TIERS) }];
    const reviewCounts = [{ key: "reviews", tier: tierForCount(reviewCountById.get(idStr) || 0, REVIEW_COUNT_TIERS) }];
    const listCounts = [{ key: "lists", tier: tierForCount(listCountById.get(idStr) || 0, LIST_COUNT_TIERS) }];
    const followersCounts = [{ key: "followers", tier: tierForCount((u.followers || []).length, FOLLOWERS_TIERS) }];
    const influencerCounts = [{ key: "likes", tier: tierForCount(likeCountById.get(idStr) || 0, INFLUENCER_TIERS) }];
    const sync = syncById.get(idStr);
    const firstSyncCounts = [{ key: "firstSync", tier: tierForCount(sync?.count || 0, FIRST_SYNC_TIERS) }];
    const highMatchCounts = [{ key: "highMatch", tier: tierForCount(sync?.maxScore || 0, HIGH_MATCH_TIERS) }];
    const syncExplorerCounts = [{ key: "syncExplorer", tier: tierForCount(sync?.targetCount || 0, SYNC_EXPLORER_TIERS) }];

    const rank = rankById.get(idStr) || Number.MAX_SAFE_INTEGER;
    const foundingCounts = [{ key: "founding", tier: rank <= FOUNDING_CINEPHILE_CUTOFF ? "tier1" : null }];
    const membershipDays = u.createdAt ? Math.floor((Date.now() - new Date(u.createdAt).getTime()) / 86400000) : 0;
    const membershipCounts = [{ key: "membership", tier: tierForCount(membershipDays, MEMBERSHIP_TIERS) }];
    const streakCounts = [{ key: "streak", tier: tierForCount(currentStreakValue(u), STREAK_TIERS) }];

    const hasOldContent =
      userMovieDocs.some((m) => m.release_date && m.release_date >= REAL_DATE_FLOOR && m.release_date < TIME_TRAVELER_CUTOFF) ||
      userSeriesDocs.some((s) => s.first_air_date && s.first_air_date >= REAL_DATE_FLOOR && s.first_air_date < TIME_TRAVELER_CUTOFF);
    const timeTravelerCounts = [{ key: "timeTraveler", tier: hasOldContent ? "tier1" : null }];

    const distinctGenres = genreCounts.filter((c) => c.count >= 1).length;
    const eclecticTasteCounts = [{ key: "eclecticTaste", tier: distinctGenres >= ECLECTIC_TASTE_MIN_GENRES ? "tier1" : null }];

    const hasDayOneMatch = watchlist.some((w) => {
      if (!w.addedAt) return false;
      const addedDay = new Date(w.addedAt).toISOString().slice(0, 10);
      const doc = w.itemType === "movie" ? movieById.get(w.itemId.toString()) : seriesById.get(w.itemId.toString());
      const releaseDate = doc ? (w.itemType === "movie" ? doc.release_date : doc.first_air_date) : null;
      return releaseDate === addedDay;
    });
    const dayOneViewerCounts = [{ key: "dayOneViewer", tier: hasDayOneMatch ? "tier1" : null }];

    const userHighRatings = highRatingsByUser.get(idStr) || [];
    const isHiddenGem = userHighRatings.some((r) => {
      const count = watcherCountByItem.get(`${r.contentId}_${r.contentType}`) || 0;
      return count > 0 && count <= HIDDEN_GEM_MAX_WATCHERS;
    });
    const hiddenGemCounts = [{ key: "hiddenGem", tier: isHiddenGem ? "tier1" : null }];

    const pollParticipantCounts = [{ key: "pollParticipant", tier: pollVoterIds.has(idStr) ? "tier1" : null }];

    const hasHalloweenMovie = watchlist.some((w) => {
      if (w.itemType !== "movie" || !w.addedAt || new Date(w.addedAt).getUTCMonth() !== OCTOBER_UTC_MONTH) return false;
      const doc = movieById.get(w.itemId.toString());
      return doc && (doc.genre_ids || []).some((g) => MOVIE_GENRE_MAP[g] === "Horror");
    });
    const halloweenViewerCounts = [{ key: "halloweenViewer", tier: hasHalloweenMovie ? "tier1" : null }];

    const hasNewYearMatch = watchlist.some((w) => {
      if (!w.addedAt) return false;
      const d = new Date(w.addedAt);
      const month = d.getUTCMonth();
      const day = d.getUTCDate();
      return (month === 11 && day === 31) || (month === 0 && day === 1);
    });
    const newYearViewerCounts = [{ key: "newYearViewer", tier: hasNewYearMatch ? "tier1" : null }];

    return {
      _id: u._id,
      badgeCount: totalBadgeCount(
        genreCounts,
        volumeCounts,
        ratingCounts,
        reviewCounts,
        listCounts,
        followersCounts,
        influencerCounts,
        firstSyncCounts,
        highMatchCounts,
        syncExplorerCounts,
        foundingCounts,
        membershipCounts,
        streakCounts,
        timeTravelerCounts,
        eclecticTasteCounts,
        dayOneViewerCounts,
        hiddenGemCounts,
        pollParticipantCounts,
        halloweenViewerCounts,
        newYearViewerCounts
      ),
    };
  });
}
