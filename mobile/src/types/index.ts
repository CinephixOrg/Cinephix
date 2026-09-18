export type ContentType = "movie" | "series";

export type AccountTier = "free" | "plus" | "premium" | "dev";

// Single active "Currently Watching" status — see backend's User.js own
// field comment for the full TTL/auto-clear design. `startedAt` is an ISO
// string here (over the wire), checked client-side against
// CURRENTLY_WATCHING_TTL_MS (ContentDetailScreen.tsx) the same way the
// server does, purely for local button-state display — the server stays
// authoritative for the actual feed (GET /feed/currently-watching already
// filters by its own TTL).
export interface CurrentlyWatching {
  itemId: string;
  itemType: ContentType;
  startedAt: string;
}

export interface User {
  _id: string;
  username: string;
  email: string;
  profile_pic_url?: string;
  googleId?: string | null;
  isOAuthUser?: boolean;
  accountTier?: AccountTier;
  currentlyWatching?: CurrentlyWatching | null;
  token: string;
}

export interface Movie {
  _id: string;
  title: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  vote_average?: number;
  genre_ids?: number[];
}

export interface Series {
  _id: string;
  name: string;
  overview?: string;
  poster_path?: string | null;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
}

export interface Rating {
  _id: string;
  user: string;
  contentId: string;
  contentType: ContentType;
  value: number;
}

// Present on whichever call actually moved a badge's real count exactly
// onto a threshold (backend's crossedThresholdTier/crossedVolumeTier/
// crossedActivityTier, badgeController.js) — empty on every other call.
// WHICH call carries this depends entirely on what the family actually
// counts, not one fixed endpoint: genre/volume count Watched-List
// membership, so they live on addToWatchlist()'s response (rating
// something already requires it to already be on the watched list, so by
// rating time that count's already-decided change already happened at the
// watchlist-add step); ratingCount/reviewCount/listCount count real
// Rating/Review/CustomList documents, so THEY live on rateContent()/
// saveReview()/createList()'s own responses instead — each lives wherever
// its own count can actually change, not on one shared endpoint by
// convention. followers/influencer/podium never actually populate this —
// each crosses its threshold from someone ELSE's action or a ranking
// shift, not the viewer's own (see badgeController.js's/feedController.
// js's own doc comments) — included in the union anyway for completeness
// since Share.badgeData can still carry them. `family` says which
// definitions table `key`/`tier` resolve against — `key` alone isn't
// guaranteed unique across families as more get added.
export interface NewlyEarnedBadge {
  family: "genre" | "volume" | "ratingCount" | "reviewCount" | "listCount" | "followers" | "influencer" | "podium" | "firstSync" | "highMatch" | "syncExplorer" | "founding" | "membership" | "streak" | "timeTraveler" | "eclecticTaste" | "dayOneViewer" | "hiddenGem" | "pollParticipant" | "halloweenViewer" | "newYearViewer";
  key: string;
  count: number;
  tier: "devotee" | "master" | VolumeTier | ActivityTier | StreakTier;
  threshold: number;
}

// Reviewer is populated with 'username profile_pic_url' only — never bio/email.
export interface ReviewAuthor {
  _id: string;
  username: string;
  profile_pic_url?: string;
  // Only populated for getPopularReviews/getReviewsFeed (Discover's own
  // Reviews tab, ReviewFeedCard.tsx's tier ring/diamond) — not on
  // getContentReviews/getFriendsReviews' own `.populate()` calls, which
  // weren't asked to change and still project a plain username+avatar.
  accountTier?: AccountTier;
}

export interface Review {
  _id: string;
  user: ReviewAuthor;
  contentId: string;
  contentType: ContentType;
  text: string;
  createdAt: string;
  likeCount: number;
  hasLiked: boolean;
  rating: number | null; // 1-10, joined server-side from the Rating collection
}

// GET /reviews/popular only — adds a denormalized `content` block no other
// review response has, so kept as its own type rather than Review & {...}.
// Used by both GET /reviews/popular and GET /reviews/friends — same shape.
export interface PopularReview {
  _id: string;
  user: ReviewAuthor;
  text: string;
  createdAt: string;
  likeCount: number;
  hasLiked: boolean;
  rating: number | null; // 1-10, joined server-side from the Rating collection
  content: { id: string; title: string; poster_path?: string; type: ContentType };
  // Only present on getReviewsFeed items (Discover's paginated Reviews
  // tab) — server-computed there, not on getPopularReviews/getFriendsReviews.
  fromFriend?: boolean;
}

export interface ReviewsFeedResult {
  items: PopularReview[];
  page: number;
  hasMore: boolean;
}

// GET /feed/activity — Discover's "Friends' Activity" section: a
// chronological feed of who-you-follow's real activity. A discriminated
// union on `type` rather than one loose object so each event's own extra
// fields (`value`, `excerpt`, `listId`/`listName`, `rating`) are only
// accessible after narrowing.
// `favorited` was added once favorite-adds got their own append-only event
// log (`FavoriteEvent`, backend/models/FavoriteEvent.js) — the *existing*
// `favoriteMovies`/`favoriteSeries` fields on User still have no per-item
// timestamp and weren't touched (that would've meant migrating every
// match-making/leaderboard/content-stats call site that reads them as
// plain id arrays); this is a separate, additive log written only when a
// favorite is genuinely newly added.
// `list_item_added` — an item added to an *existing* list
// (CustomList.items[].addedAt already existed for this, no schema change
// needed). There used to be a sibling `list_created` variant too (a
// brand-new list, rather than an item added to one) — dropped from this
// feed entirely per direct request (this endpoint no longer generates it;
// `getMyActivity`, a separate self-activity endpoint, still has its own
// independent "created a list" concept, untouched).
// `watchlist_added` no longer appears via *this* feed either (dropped for
// the same reason `list_created` was — `rated`'s own redesign now covers
// the same "I've engaged with this" signal, see ContentDetailScreen.tsx's
// own "Add to Watched List to save" prompt on rating), but the type itself
// stays in this union since ContentWatchedSection.tsx (Content Detail's own
// "Watched by" list) still actively constructs and renders it via the same
// `ActivityRow` component.
export interface ActivityContent {
  id: string;
  title: string;
  poster_path?: string;
  type: ContentType;
}
export type ActivityEvent =
  | { type: "rated"; actor: FeedUserRef; content: ActivityContent; value: number; createdAt: string }
  | { type: "reviewed"; actor: FeedUserRef; content: ActivityContent; excerpt?: string; createdAt: string }
  // `rating` (1-10, same scale as `rated.value`) is populated only if this
  // same actor has also rated this same content — a bonus enrichment, not
  // guaranteed present.
  | { type: "watchlist_added"; actor: FeedUserRef; content: ActivityContent; rating?: number; createdAt: string }
  // createdAt is genuinely absent (not just optional-but-usually-present)
  // for anyone who favorited before FavoriteEvent's log started (see its
  // own model comment) — ActivityRow.tsx renders no time-ago label when
  // unset rather than lying about when this actually happened. Content
  // Detail's own "Favorites" stat page (ContentFavoritedSection.tsx) is the
  // one caller that regularly hits this unset case; the network Activity
  // feed's own favorited events always have a real one.
  | { type: "favorited"; actor: FeedUserRef; content: ActivityContent; createdAt?: string }
  | { type: "list_item_added"; actor: FeedUserRef; content: ActivityContent; listId: string; listName: string; createdAt: string }
  // The real Watchlist (to-watch queue) — distinct from `watchlist_added`
  // above, which is actually this app's own inverted-naming "Watched List".
  | { type: "towatch_added"; actor: FeedUserRef; content: ActivityContent; createdAt: string }
  // No `content` — a follow isn't about a movie/series. `targetUser` is
  // absent if that account was since deleted.
  | { type: "followed"; actor: FeedUserRef; targetUser?: FeedUserRef; createdAt: string }
  // No content preview here on purpose — a Share's own real content shape
  // varies too much by `shareType` (recommendation/review carry a poster,
  // list/analysis don't) for a one-line activity row; the actual post is
  // one tap away in Media's own feed.
  | { type: "shared"; actor: FeedUserRef; shareType: "analysis" | "review" | "recommendation" | "list"; createdAt: string }
  // Plus/Premium-viewer-only "so-and-so made the podium" news (server
  // already omits this entirely for a Free viewer, this app never trusts a
  // client-side check for a paywalled signal) — a live status, not a
  // persisted event: `createdAt` is stamped "now" by the server on every
  // request while still true, not a real historical timestamp.
  | { type: "podium"; actor: FeedUserRef; category: "followed" | "watched" | "reviewed"; rank: 1 | 2 | 3; createdAt: string };

export interface ActivityFeedResult {
  items: ActivityEvent[];
  page: number;
  hasMore: boolean;
}

export interface WatchlistItem {
  itemId: string;
  itemType: ContentType;
}

// One entry of a watched list / watchlist, already resolved to something
// renderable by the server (see getUserCollections) rather than needing a
// second bulk content fetch the way the raw WatchlistItem shape does.
export interface CollectionItem {
  itemId: string;
  itemType: ContentType;
  title: string;
  poster_path?: string | null;
}

export interface CollectionSlice {
  items: CollectionItem[];
  // How many the user actually has, which can exceed items.length — the
  // endpoint caps what it ships. Lets the UI say "showing N of M".
  total: number;
}

// GET /users/collections/:id/:kind — every entry of someone's watched list or
// watchlist, for the public profile's full-list sheet. Ids only (the app
// fills in titles and posters from its content cache), in stored order.
// `rating` is the owner's own rating and only present on the watched list.
export interface PublicCollectionEntry {
  itemId: string;
  itemType: ContentType;
  rating?: number | null;
}

export interface PublicCollectionEntries {
  items: PublicCollectionEntry[];
}

// GET /users/collections/:id — everything the public profile's Lists tab
// needs, in one response.
//
// `lists` comes back in the same shape /discover and /popular return, so
// the profile's Lists rail renders with ListRailCard instead of needing a
// list card of its own.
export interface UserCollections {
  lists: DiscoverListItem[];
  watched: CollectionSlice;
  watchlist: CollectionSlice;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type FollowStatus = "self" | "following" | "not-following";

// GET /users/profile/:id — the (lean) User document without its password.
// Every profile is public, so the same shape comes back for anyone.
export interface PublicProfile {
  _id: string;
  username: string;
  profile_pic_url?: string;
  bio?: string;
  accountTier?: AccountTier;
  followers: string[];
  following: string[];
  createdAt: string;
  // Present because GET /users/profile/:id spreads the full (lean) User
  // document straight into the response — real schema field, not something
  // this endpoint had to be taught to expose.
  isOfficial?: boolean;
}

export type UserProfile = PublicProfile;

export interface Connection {
  _id: string;
  username: string;
  profile_pic_url?: string;
  accountTier?: AccountTier;
}

export interface SuggestedUser {
  _id: string;
  username: string;
  profile_pic_url?: string;
  bio?: string;
  mutualCount: number;
  accountTier?: AccountTier;
}

export type CineGraphStats = Record<string, number>;
// genre -> average rating (raw 1-10 scale, matches Rating.value), null if unrated
export type CineGraphRatings = Record<string, number | null>;

export interface CineGraphData {
  movieStats: CineGraphStats;
  seriesStats: CineGraphStats;
  movieGenreRatings: CineGraphRatings;
  seriesGenreRatings: CineGraphRatings;
}

// One of GENRE_BADGES's 8 keys (badgeController.js) — "action" | "comedy" |
// "drama" | "horror" | "romance" | "thriller" | "scifi" | "documentary".
// Kept as a plain string here rather than a union: the badge key set is a
// backend-owned list that's expected to grow, and re-syncing a literal
// union on every addition isn't worth it for a value only ever used to
// look up a local asset/label table (badgeDefinitions.ts).
export interface GenreBadge {
  key: string;
  count: number;
  tier: "devotee" | "master" | null;
}

export interface GenreBadgesResponse {
  badges: GenreBadge[];
  devoteeThreshold: number;
  masterThreshold: number;
}

// The 5-rung volume ladder (movies/series watched) — bronze through
// diamond, badgeController.js's own VOLUME_TIERS order. Shown as one slot
// per key with a level-dot indicator (ProfileBadgesTab.tsx) rather than 5
// separate tiles like genre badges get — see that file's own comment on
// why a 2-tier and a 5-tier badge ladder are shown differently. The actual
// ordered array (VOLUME_TIER_ORDER) lives in volumeBadgeDefinitions.ts,
// not here — this file is types only, runtime values belong there.
export type VolumeTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface VolumeBadge {
  key: string; // "movies" | "series"
  count: number;
  tier: VolumeTier | null;
}

export interface VolumeBadgesResponse {
  badges: VolumeBadge[];
  tiers: { tier: VolumeTier; threshold: number }[];
}

// The 3 "activity" badges (rating count, review count, list count) —
// unlike volume's movies/series, each is its own single-metric ladder
// (badgeController.js's RATING_COUNT_TIERS/REVIEW_COUNT_TIERS/
// LIST_COUNT_TIERS), so `badges` only ever has one entry per response.
// `tier` values are deliberately neutral ("tier1".."tier5", not invented
// words) — same reasoning volume's own art-file naming already
// established; real display names (Newcomer/Rookie/Organizer/...) are a
// mobile-side-only concern, see activityBadgeDefinitions.ts.
export type ActivityTier = "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

// The streak loyalty badge's own tier values are deliberately real,
// fixed day-counts — not generic "tier1".."tierN" — since they're genuine
// well-known milestones (also already reflected in the badge art's own
// file names, badge_streak_7day/30day/100day.png), the one other
// exception to the neutral-tier convention besides genre's own
// devotee/master. See loyaltyBadgeDefinitions.ts.
export type StreakTier = "7day" | "30day" | "100day";

// Reused as-is for the streak endpoint too (ActivityBadgeResponse below),
// not a parallel type — the shape is identical, `tier` just widens to
// also allow StreakTier's own real-day-count values alongside every other
// family's neutral tier1..tierN.
export interface ActivityBadge {
  key: string; // "ratings" | "reviews" | "lists" | "followers" | "likes" | "podium" | "founding" | "membership" | "streak" | ...
  count: number;
  tier: ActivityTier | StreakTier | null;
}

export interface ActivityBadgeResponse {
  badges: ActivityBadge[];
  tiers: { tier: ActivityTier | StreakTier; threshold: number }[];
}

// The public-profile Badges tab's own bulk shape — GET /api/badges/user/:id
// (badgeRoute.js's getAllBadgesForUser) computes all 20 families in one
// request instead of ProfileBadgesTab.tsx's own-profile 20-separate-calls
// path, since firing 20 requests for a profile that isn't the viewer's own
// would be wasteful.
export type AllBadgesResponse = {
  genre: GenreBadgesResponse;
  volume: VolumeBadgesResponse;
} & Record<
      | "ratingCount"
      | "reviewCount"
      | "listCount"
      | "followers"
      | "influencer"
      | "podium"
      | "firstSync"
      | "highMatch"
      | "syncExplorer"
      | "founding"
      | "membership"
      | "streak"
      | "timeTraveler"
      | "eclecticTaste"
      | "dayOneViewer"
      | "hiddenGem"
      | "pollParticipant"
      | "halloweenViewer"
      | "newYearViewer",
      ActivityBadgeResponse
    >;

export interface GenreDetailItem {
  contentId: string;
  title: string;
  posterPath: string | null;
  year: string | null;
  rating: number | null; // raw 1-10, null if unrated
}

export interface GenreDetailData {
  items: GenreDetailItem[];
  avgRating: number | null; // raw 1-10
  count: number;
}

// GET /users/favorites/:id populates only these fields — deliberately
// narrower than Movie/Series (no overview/release_date/vote_average).
// rating is the profile owner's own 1-10 Rating value for that item, if any
// (null when they favorited something they haven't rated).
export interface FavoriteMovie {
  _id: string;
  title: string;
  poster_path?: string | null;
  rating?: number | null;
}

export interface FavoriteSeries {
  _id: string;
  name: string;
  poster_path?: string | null;
  rating?: number | null;
}

export interface Favorites {
  movies: FavoriteMovie[];
  series: FavoriteSeries[];
}

export interface CustomListItem {
  itemId: string;
  itemType: ContentType;
  addedAt: string;
}

export interface CustomList {
  _id: string;
  owner: string;
  name: string;
  description: string;
  isPublic: boolean;
  items: CustomListItem[];
  // Hydrated by GET /lists/me (mirrors /discover, /popular) as a 5-item
  // preview, and by GET /lists/:id (ListDetailScreen's own fetch) as EVERY
  // item — absent (not just empty) from the create/update responses, which
  // never return items at all in their own response shape.
  previewItems?: ListPreviewItem[];
  likeCount: number;
  order: number;
  views?: number;
  createdAt: string;
  updatedAt: string;
}

// GET /lists/:id (unlike /me, POST /, PATCH /:id) populates owner —
// modeled as its own type rather than widening CustomList.owner for
// every other call site, where it's genuinely just a plain id string.
export interface CustomListDetail extends Omit<CustomList, "owner"> {
  owner: { _id: string; username: string; profile_pic_url?: string };
}

// Lightweight, bulk-hydrated {title, poster_path} — either the first 5
// items of a list (/discover, /popular, for the Home-tab preview cards) or
// every item (/lists/:id, for ListDetailScreen's own grid) depending on the
// caller; not the full per-item content shape ContentCard needs.
export interface ListPreviewItem {
  itemId: string;
  itemType: ContentType;
  title: string;
  poster_path?: string;
  // Present since hydratePreviewItems started projecting these too (added
  // for ListDetailScreen's own CollectionEntry mapping — Release-date sort,
  // popularity as a search tie-break); /discover, /popular, /for-content
  // don't read either.
  release_date?: string | null;
  popularity?: number;
}

export interface MatchUser {
  _id: string;
  username: string;
  profile_pic_url?: string;
  bio?: string;
}

// The 5 weighted signals computeMatchBreakdown (backend) combines into
// matchPercentage — always present now (was computed server-side all along,
// previously discarded before reaching the client). Order here is heaviest-
// weighted first.
export interface MatchBreakdown {
  collaborative: number;
  contentBased: number;
  social: number;
  diversity: number;
  bonus: number;
}

export interface MatchInsightGenre {
  genre: string;
  meCount: number;
  targetCount: number;
}

export interface MatchFavoritesOverlap {
  intersectionCount: number;
  unionCount: number;
  sharedIds: string[];
  genreOnly: { mine: string[]; theirs: string[] };
}

export interface MatchSocialOverlap {
  mutualFollowing: number;
  mutualFollowers: number;
  followingOverlapRate: number;
  followersOverlapRate: number;
}

// Extra per-candidate detail computeMatchBreakdown already computed but
// getSyncCandidates used to discard — surfaced for a future match-detail view,
// not consumed by any component yet.
export interface MatchInsights {
  sharedGenres: MatchInsightGenre[];
  favoritesOverlap: MatchFavoritesOverlap;
  socialOverlap: MatchSocialOverlap;
}

// GET /match/sync/candidates row — one ranked match candidate.
export interface SyncCandidate {
  user: MatchUser;
  contentType: ContentType;
  matchPercentage: number;
  breakdown: MatchBreakdown;
  matchInsights?: MatchInsights;
}

export interface SyncCandidatesResult {
  candidates: SyncCandidate[];
}

export interface MatchWithUserResult {
  matchPercentage: number;
  targetUser: MatchUser;
  breakdown: {
    collaborative: number;
    contentBased: number;
    social: number;
    diversity: number;
    bonus: number;
  };
  // Added so SyncScoreCard.tsx's own synthesized SyncCandidate can carry
  // it through to MatchAnalysisPanel — without it, the Shared Genres/
  // Shared Favorites/Social Overlap cards (all gated on matchInsights)
  // silently never appeared for the profile entry point, only for the
  // Sync page's own getSyncCandidates-backed deck. computeMatchBreakdown
  // (backend matchController.js) already computes this at zero extra
  // query cost — getMatchWithUser used to just not return it.
  matchInsights?: MatchInsights;
}

export interface MatchAnalysis {
  provider: "mock" | "gemini" | "groq" | "openrouter" | "openai";
  // Absent on analyses shared before this field existed (old chat messages'
  // stored analysisData) — callers must treat it as optional. Same number
  // getMatchWithUser's matchPercentage would return for the same pair/filters.
  matchPercentage?: number;
  breakdown?: {
    collaborative: number;
    contentBased: number;
    social: number;
    diversity: number;
    bonus: number;
  };
  parsed: {
    analysis: string;
    strengths: string[];
    weaknesses: string[];
    conversation_starters: string[];
    graph_ascii: string | string[];
    // Absent on analyses fetched/cached before this field existed.
    match_title?: string;
  };
  raw: unknown;
}

// Raw metrics behind an analysis run — same numbers the LLM prompt itself
// was built from, returned alongside it so the card deck's detail cards
// (Recent Taste, Favorite Genres, Your Stats) can render without a second
// round trip. Absent on analyses fetched/cached before this field existed
// (older ProfileAnalysis history rows), so every consumer treats it as
// optional rather than assuming it's always there.
export interface ProfileAnalysisStats {
  movies: { watchedCount: number; topGenres: string[]; avgRating: number };
  series: { watchedCount: number; topGenres: string[]; avgRating: number };
  watchlist: number;
  // shareCount was added after this feature shipped, same reasoning as the
  // fields below — optional so old history rows don't lie about having it.
  social: { reviewsCount: number; followingCount: number; followersCount: number; shareCount?: number };
  // Below: every field added after this feature's first release, each in
  // its own pass — a history row saved before a given pass simply doesn't
  // have that field at all (not an empty array/object, genuinely absent),
  // so all of them stay optional and every consumer must fall back
  // (`?? []`/`?? 0`/`?.`) rather than assume they're always present.
  totalRatings?: number;
  memberSince?: string;
  // Total genre tags across all rated titles. A title carries 2-3 genres, so
  // each genre's `percentage` below is its share of THIS, not of
  // totalRatings — the two denominators are why "37 of your 45 titles" and
  // "31%" can both be right, and the UI states each one explicitly.
  genreTagTotal?: number;
  // Computed server-side straight from real rating data (movie+series genre
  // tags combined) — never LLM-invented, so these always reflect the actual
  // DB and never coincidentally land on a suspicious even split.
  genreBreakdown?: { genre: string; count: number; percentage: number }[];
  // Titles behind each genre in the breakdown, highest-rated first — keyed
  // by genre name, revealed when that genre is tapped.
  genreItems?: Record<string, ProfileAnalysisItem[]>;
  // Combined movie+series genre counts from ratings given in the last 30
  // days — distinct from movies/series.topGenres above, which are all-time.
  // deltaVsAllTime is this genre's share of the last 30 days minus its
  // all-time share (positive = leaning into it more than usual lately).
  recentGenres?: {
    genre: string;
    count: number;
    percentage: number;
    deltaVsAllTime: number;
    // This genre's share of the last 30 days minus its share of the 30 days
    // before that — what the card's ↑/↓ arrows actually mean. Null when
    // there's no earlier window to compare against ("no prior data" and
    // "unchanged" must not look the same); absent on older history rows,
    // which compared against the all-time share instead.
    deltaVsPreviousPeriod?: number | null;
  }[];
  favoriteGenres?: {
    items: { genre: string; count?: number; percentage: number }[];
    // Total favorite genre tags, so the card can show an explicit "Other"
    // remainder rather than a top-5 list that stops at 78%.
    tagTotal?: number;
    totalFavorites: number;
    // True when the #1 favorited genre matches the #1 all-time rated genre.
    alignsWithTopWatched: boolean;
  };
  // This calendar month vs. the last complete one. Every figure is an event
  // count inside the window (things that happened this month), never a
  // running total — followers/following included, which is why they come
  // from follow notifications rather than the untimestamped follower arrays.
  monthlyStats?: ProfileAnalysisMonthlyStats;
  // The actual titles behind the two percentage lists above. `genres` lets
  // the cards filter these client-side when a genre row is tapped, without a
  // second per-genre payload for lists this small.
  recentItems?: ProfileAnalysisItem[];
  favoriteItems?: ProfileAnalysisItem[];
  // Premium/dev only — absent entirely on lower tiers (the server never
  // computes them), which is what the deck keys its upsell card off.
  ratingCurve?: { value: number; count: number }[];
  activityTimeline?: { month: string; count: number }[];
  // Titles behind each bucket of the two charts above, so both are tappable.
  // Keyed by the 1-10 score and by the month's ISO string respectively.
  ratingCurveItems?: Record<string, ProfileAnalysisItem[]>;
  timelineItems?: Record<string, ProfileAnalysisItem[]>;
}

// One monthly figure and the same figure for the previous calendar month.
export interface MonthlyStatPair {
  value: number;
  previous: number;
}

export interface ProfileAnalysisMonthlyStats {
  periodStart: string;
  // Last day of the current month (inclusive) — the label's "1-31 August"
  // end, not the exclusive bound the queries used.
  periodEnd: string;
  moviesWatched: MonthlyStatPair;
  seriesWatched: MonthlyStatPair;
  avgMovieRating: MonthlyStatPair;
  avgSeriesRating: MonthlyStatPair;
  // New followers / newly followed accounts this month, not running totals.
  followers: MonthlyStatPair;
  following: MonthlyStatPair;
  watchlist: MonthlyStatPair;
  reviews: MonthlyStatPair;
  shares: MonthlyStatPair;
}

export interface ProfileAnalysisItem {
  _id: string;
  type: ContentType;
  title?: string;
  name?: string;
  poster_path?: string | null;
  // The score this user gave it, 1-10 backend-side (see utils/rating.ts).
  // Absent for a favorited title they never rated.
  rating?: number;
  genres?: string[];
}

export interface ProfileAnalysis {
  nickname: string;
  personalitySummary: string;
  funFact: string;
  recommendedConcept: string;
  tasteCategory?: string;
  trendVsLastAnalysis?: string;
  tier?: AccountTier;
  // Real, computed metrics behind this run — genreBreakdown now lives here
  // (stats.genreBreakdown), not as a separate top-level LLM-authored field.
  stats?: ProfileAnalysisStats;
  // Added client-side only when sharing, mirrors web's exact convention for
  // letting a receiver distinguish this from a MatchAnalysis share.
  type?: "profile";
}

// One saved row from GET /users/profile-analysis/history (Pro/Premium/Dev
// only — Free always gets an empty array back).
export interface ProfileAnalysisHistoryEntry {
  _id: string;
  tier: AccountTier;
  result: ProfileAnalysis;
  stats?: ProfileAnalysisStats;
  createdAt: string;
}

// Error body returned by GET /users/profile-analysis when on cooldown (HTTP 429).
export interface ProfileAnalysisCooldownError {
  retryAfterMs: number;
  lastRunAt: string;
}

export type NotificationType = "follow" | "message" | "share_like";

export interface NotificationSender {
  _id: string;
  username: string;
  profile_pic_url?: string;
}

// type "message": what was said, as a snippet (backend utils/notificationPayload.js).
export interface NotificationMessagePayload {
  messageId?: string;
  preview?: string;
  kind?: "text" | "recommendation" | "analysis_share" | "profile_share";
}

// type "share_like": one notification per share, however many people like it.
export interface NotificationSharePayload {
  shareId: string;
  shareType?: ShareType;
  /** How many people like the share, not counting its author. */
  likerCount: number;
}

export interface Notification {
  _id: string;
  /** Who acted; for share_like, whoever liked the share most recently. */
  sender: NotificationSender;
  type: NotificationType;
  conversationId?: string | null;
  message?: NotificationMessagePayload;
  share?: NotificationSharePayload;
  read: boolean;
  createdAt: string;
}

// IMPORT is what the unified importer writes. The two per-platform values
// remain because rows written before it still exist and still render.
export type ActivityLogActionType =
  | "RATE"
  | "ADD_WATCHLIST"
  | "IMPORT"
  | "IMPORT_TVTIME"
  | "IMPORT_LETTERBOXD";

export interface ActivityLogPayload {
  addedWatchlistIds?: string[];
  addedRatingIds?: string[];
  updatedCineGraph?: boolean;
}

// GET /users/me/logs — hard-capped at 50, no pagination, includes
// already-reverted rows (no server-side filter).
export interface ActivityLog {
  _id: string;
  userId: string;
  actionType: ActivityLogActionType;
  details: string;
  isReverted: boolean;
  payload?: ActivityLogPayload;
  createdAt: string;
  updatedAt: string;
}

// The platforms the generic import pipeline accepts. Mirrors
// backend/utils/import/sources.js — the server is the source of truth and
// returns the catalogue at runtime; this union is what gives the client
// compile-time safety over it.
export type ImportSourceId =
  | "letterboxd"
  | "tvtime"
  | "trakt"
  | "imdb"
  | "simkl"
  | "plex"
  | "jellyfin"
  | "kodi"
  | "myanimelist"
  | "anilist"
  | "kitsu"
  | "generic";

export interface ImportSourceInfo {
  id: ImportSourceId;
  label: string;
  /** File extensions the picker should accept, e.g. [".zip", ".csv"]. */
  accepts: string[];
  kinds: ("movie" | "series")[];
}

/** One SSE progress block. Progress blocks never carry a `status`. */
export interface ImportProgress {
  phase: "extract" | "normalize" | "match" | "lookup" | "save";
  text: string;
  current?: number;
  total?: number;
}

export interface ImportUnmatchedSample {
  title: string;
  year: number | null;
  type: "movie" | "series";
}

/** The final SSE block on success. */
export interface ImportSummary {
  status: "completed";
  source: ImportSourceId;
  sourceLabel: string;
  durationMs: number;
  parsed: {
    files: number;
    rows: number;
    titles: number;
    movies: number;
    series: number;
    ratingScale: number;
  };
  matched: {
    total: number;
    unmatched: number;
    skipped: number;
    /** Counts keyed by the rule that resolved them: imdb, title+year, tmdb… */
    byRule: Record<string, number>;
    samples: ImportUnmatchedSample[];
  };
  added: {
    watched: number;
    watchlist: number;
    favorites: number;
    ratings: number;
    episodes: number;
    alreadyHad: number;
    fromTmdb: number;
  };
  /** True when the server recognised a re-submitted file and replayed it. */
  replayed?: boolean;
}

export interface ImportFailure {
  status: "error";
  message: string;
}

export type ImportResult = ImportSummary | ImportFailure;

export type RoomType = "dm" | "group";

export type MessageType = "text" | "recommendation" | "analysis_share" | "profile_share" | "list_share";

export interface MessageSender {
  _id: string;
  username: string;
  profile_pic_url?: string;
  accountTier?: AccountTier;
}

export interface Message {
  _id: string;
  roomType: RoomType;
  roomId: string;
  sender: MessageSender;
  text: string;
  type: MessageType;
  contentId?: string;
  contentType?: ContentType;
  contentData?: {
    title?: string;
    posterUrl?: string;
    genres?: string[];
    releaseYear?: number;
    overview?: string;
    rating?: number;
  };
  analysisData?: unknown;
  // "hey, do you know this person?" shares — denormalized at send time
  // (see backend/models/Message.js), so still renders correctly even if
  // the shared user later changes their username/avatar/tier.
  profileData?: {
    userId: string;
    username: string;
    profile_pic_url?: string | null;
    accountTier?: AccountTier | null;
    // Added later, so absent on older shares — the card shows less then.
    bio?: string | null;
    followersCount?: number | null;
    topGenres?: string[];
  };
  // "check out this list" shares — denormalized at send time (see
  // backend/models/Message.js), same reasoning as profileData above: still
  // renders correctly even if the list is later renamed or resized.
  listData?: {
    listId: string;
    name: string;
    itemCount: number;
    previewPosters: string[];
    // Newer shares only — the card shows less without them.
    description?: string | null;
    ownerUsername?: string | null;
  };
  createdAt: string;
  // Local-only fields, never sent by the server.
  clientTempId?: string;
  status?: "pending";
}

export interface Conversation {
  _id: string;
  type: "dm";
  participants: MessageSender[];
  otherUser: MessageSender;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  // Present only on the find-or-create response (POST /conversations), not
  // on rows from the conversation list. Opening a DM needs its first page of
  // messages immediately, and the client can't ask for them until it knows
  // the conversation id — so that endpoint returns both at once rather than
  // making the chat wait on a second round trip.
  messages?: Message[];
  messagesPagination?: MessagePagination;
}

// A group row from the same GET /conversations response as Conversation
// above — kept as a separate type (not unioned into Conversation) so every
// existing DM-only consumer (RecipientPickerModal, [conversationId].tsx,
// messages/new.tsx) needs zero changes; only messages/index.tsx and
// ChatContext know about this shape.
export interface GroupConversationRow {
  _id: string;
  type: "group";
  slug: string;
  name: string;
  coverImage?: string;
  memberCount: number;
  lastMessage: string;
  lastMessageAt: string | null;
  lastMessageSenderId?: { _id: string; username: string };
  unreadCount: number;
}

// GET /conversations/:id/messages uses a different pagination shape than
// the {total,page,limit,pages} Pagination used elsewhere (Movies/Match/
// Notifications) — cursor-based, not page-based.
export interface MessagePagination {
  hasMore: boolean;
  limit: number;
  before: string | null;
}

export interface UserSearchResult {
  _id: string;
  username: string;
  profile_pic_url?: string;
  accountTier?: AccountTier;
}

export interface ConversationUpdatedPayload {
  conversationId: string;
  lastMessage: string;
  lastMessageAt: string;
  senderId: string;
}

export interface GroupUpdatedPayload {
  roomType: "group";
  groupId: string;
  lastMessage: string;
  lastMessageAt: string;
  senderId: string;
  // Sent by current servers; an older one leaves it out.
  senderUsername?: string;
}

export type RoomUpdatedPayload = ConversationUpdatedPayload | GroupUpdatedPayload;

export type GroupCategory = "director" | "genre" | "era" | "style";

export interface Group {
  _id: string;
  slug: string;
  name: string;
  description: string;
  category: GroupCategory;
  tags: string[];
  memberCount: number;
  isMember: boolean;
  /** How many people you follow are members. Absent from older servers. */
  friendsJoined?: number;
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  user: MessageSender;
  joinedAt: string;
}

export interface PopularThisWeekItem {
  content: {
    id: string;
    title: string;
    poster_path?: string;
    type: ContentType;
    releaseYear?: number;
    avgRating?: number; // 1-10 scale, bulk-averaged from Rating across all Cinephix users — same scale StarRatingDisplay already expects
    ratingCount?: number;
  };
  addCount: number;
  topAdders?: FeedUserRef[]; // up to 3, present on popular-this-week/popular-with-friends
}

// Discover's 5-category content podium — always exactly 3 entries per
// list, all-time content signals (GET /feed/leaderboard). Each list
// carries only its own single metric (no cross-enrichment — an earlier
// version showed both favorite count and rating on every card regardless
// of list, simplified back to one metric per page per a follow-up
// request). mostWatched/mostReviewed added later, content-side twins of
// the people podium's own identically-named categories below.
interface LeaderboardContent {
  id: string;
  title: string;
  poster_path?: string;
  type: ContentType;
}
export interface FavoritedLeaderboardItem {
  content: LeaderboardContent;
  favoriteCount: number;
}
export interface RatedLeaderboardItem {
  content: LeaderboardContent;
  avgRating: number; // 1-10 scale, same as everywhere else — StarRatingDisplay expects this directly
  ratingCount: number;
}
export interface RecommendedLeaderboardItem {
  content: LeaderboardContent;
  recommendCount: number;
}
export interface WatchedLeaderboardItem {
  content: LeaderboardContent;
  watchedCount: number;
}
export interface ReviewedLeaderboardItem {
  content: LeaderboardContent;
  reviewCount: number;
}
export interface LeaderboardResult {
  mostFavorited: FavoritedLeaderboardItem[];
  highestRated: RatedLeaderboardItem[];
  mostRecommended: RecommendedLeaderboardItem[];
  mostWatched: WatchedLeaderboardItem[];
  mostReviewed: ReviewedLeaderboardItem[];
}

// Media/Shares' own podium — ranks people, not content (GET
// /feed/people-leaderboard). Only Most Watched has a movie/series
// dimension; the rest ignore the optional type filter. mostLiked/
// topRecommenders added later, alongside the content podium's own 2
// additions above — see PeoplePodium.tsx's own doc comment for why (the
// 3-way Free/Plus/Premium visibility split needed a round number).
interface PodiumUser {
  id: string;
  username: string;
  profile_pic_url?: string;
  accountTier?: AccountTier;
}
export interface MostFollowedItem {
  user: PodiumUser;
  followerCount: number;
}
export interface MostWatchedItem {
  user: PodiumUser;
  watchedCount: number;
}
export interface MostReviewedItem {
  user: PodiumUser;
  reviewCount: number;
}
export interface MostLikedItem {
  user: PodiumUser;
  likeCount: number;
}
export interface TopRecommenderItem {
  user: PodiumUser;
  recommendCount: number;
}
// Total badge count across BOTH badge families (genre + volume) — see
// computeAllUsersBadgeCounts's own doc comment in the backend's
// badgeController.js for how one comparable number is derived from two
// differently-shaped badge systems.
export interface MostBadgesItem {
  user: PodiumUser;
  badgeCount: number;
}
export interface PeopleLeaderboardResult {
  mostFollowed: MostFollowedItem[];
  mostWatched: MostWatchedItem[];
  mostReviewed: MostReviewedItem[];
  mostLiked: MostLikedItem[];
  topRecommenders: TopRecommenderItem[];
  mostBadges: MostBadgesItem[];
}

// GET /feed/my-podium-placements — powers the "you made the podium!" popup
// (see app/(app)/_layout.tsx). `category` matches PeopleLeaderboardResult's
// own field names (backend's PODIUM_CATEGORY_KEYS) verbatim, not
// PeoplePodium.tsx's own shorter CategoryKey union — PodiumNewsModal.tsx
// maps between the two.
export interface PodiumPlacement {
  category: "mostFollowed" | "mostWatched" | "mostReviewed" | "mostLiked" | "topRecommenders" | "mostBadges";
  rank: 1 | 2 | 3;
}

export type FeedActivityType = "rated" | "reviewed" | "watchlisted" | "followed";

export interface FeedUserRef {
  _id: string;
  username: string;
  profile_pic_url?: string;
  // Populated on Share.user (getShareFeed/getUserShares, driving
  // ShareCard's tier ring/diamond) and ActivityEvent.actor
  // (getNetworkActivity, driving ActivityRow's own) — not on other
  // FeedUserRef usages (topViewers, FeedActivityItem.user), which weren't
  // asked to show a tier signal.
  accountTier?: AccountTier;
  // Marks the single official Cinephix account (Share.user.isOfficial,
  // getShareFeed/getUserShares) — drives ShareCard's verified badge.
  isOfficial?: boolean;
}

export interface FeedActivityItem {
  type: FeedActivityType;
  user: FeedUserRef;
  content?: PopularThisWeekItem["content"]; // absent only for "followed"
  value?: number; // "rated" only, 1-10
  excerpt?: string; // "reviewed" only
  targetUser?: FeedUserRef; // "followed" only, absent if the target account was deleted
  createdAt: string;
}

export interface FeedResult {
  items: FeedActivityItem[];
  page: number;
  hasMore: boolean;
}

// The caller's own activity (ratings, reviews, review likes, watchlist/
// to-watch adds, list creation, group joins) — distinct from FeedActivityItem,
// which is always someone else's (network) activity. No `user` field here:
// the actor is always "you".
export type PersonalActivityType =
  | "rated"
  | "reviewed"
  | "review_liked"
  | "list_liked"
  | "followed"
  | "watchlist_added"
  | "towatch_added"
  | "favorited"
  | "list_created"
  | "group_joined"
  | "shared"
  | "match_analyzed"
  | "profile_analyzed";

// One entry on your own Activity page (GET /users/me/activity). Which
// optional fields are set depends on `type`.
export interface PersonalActivityItem {
  /** Stable across requests — the list key, and how pages are de-duplicated. */
  key: string;
  type: PersonalActivityType;
  createdAt: string;
  content?: PopularThisWeekItem["content"]; // title-based types
  value?: number; // "rated": 1-10
  excerpt?: string; // "reviewed"
  listId?: string; // "list_created", "list_liked"
  listName?: string;
  groupSlug?: string; // "group_joined"
  groupName?: string;
  groupCoverImage?: string;
  // The other person: who you followed, whose review or list you liked, who
  // you ran a CineMatch with.
  targetUser?: FeedUserRef;
  shareId?: string; // "shared"
  shareType?: ShareType;
  shareTitle?: string;
  score?: number; // "match_analyzed": 0-100
  nickname?: string; // "profile_analyzed"
}

export interface PersonalActivityResult {
  items: PersonalActivityItem[];
  page: number;
  hasMore: boolean;
}

// Media (social sharing feed) — a Share is always a snapshot of an
// analysis/review/recommendation at the moment it was posted, never a live
// reference (mirrors how chat's analysis_share/recommendation messages
// already snapshot instead of referencing).
export type ShareType = "analysis" | "review" | "recommendation" | "list" | "official" | "poll" | "badge";

export type OfficialContentCategory = "trivia" | "tip" | "highlight" | "on_this_day" | "stats" | "announcement";

export interface PollOption {
  text: string;
  // Set only on a user-created "what should I watch" poll (createShare's
  // own "poll" branch, shareController.js) — absent on the official
  // account's plain text-option polls. Presence of `contentId` on the
  // first option is what ShareCard.tsx uses to pick the poster-grid layout
  // over the original text-row one.
  contentId?: string;
  contentType?: ContentType;
  posterUrl?: string | null;
  voteCount: number;
  // First up to 5 voters for this option, same shape/purpose as Share's own
  // topViewers — only populated once results are visible (pre-vote option
  // objects never carry this).
  topVoters?: FeedUserRef[];
}

// Denormalized snapshot of a CustomList at share time — same {itemId,
// itemType, title, poster_path} shape backend's hydratePreviewItems (also
// used by /lists/discover, /lists/popular, /lists/me) already returns.
export interface ShareListPreviewItem {
  itemId: string;
  itemType: ContentType;
  title: string;
  poster_path?: string;
}

export interface Share {
  _id: string;
  user: FeedUserRef;
  type: ShareType;
  analysisData?: any; // "analysis" only — same shape ProfileAnalysisModal already renders
  reviewText?: string; // "review" only
  reviewRating?: number | null; // "review" only, 1-10
  note?: string; // "recommendation" only, optional caption
  contentId?: string; // "review" | "recommendation"
  contentType?: ContentType; // "review" | "recommendation"
  contentData?: { title: string; posterUrl: string | null; releaseYear?: number }; // "review" | "recommendation"
  listId?: string; // "list" only
  listData?: { name: string; description?: string; itemCount: number; previewItems: ShareListPreviewItem[] }; // "list" only
  officialCategory?: OfficialContentCategory; // "official" only
  officialText?: string; // "official" only
  // "official" only — zero or more words inside officialText rendered as
  // tappable in-app links. Tip posts carry `href` (an absolute app route,
  // passed straight to router.push). Trivia's title-referencing templates
  // instead carry `contentId`/`contentType`, resolved against whichever
  // stack (`basePath`) the card is rendered in — same as the existing
  // single contentId/contentType fields' own content-detail navigation.
  officialLinks?: { word: string; href?: string; contentId?: string; contentType?: ContentType }[];
  pollData?: { question: string; options: PollOption[] }; // "poll" only
  userVoteIndex?: number | null; // "poll" only — the caller's own vote, if any
  // "badge" only — server-verified at share time (createShare re-checks
  // the badge is actually earned via compute{Genre,Volume}BadgeCounts,
  // never trusts a client-supplied tier/count). `family` + `key` together
  // resolve the actual art/label client-side (GENRE_BADGE_DEFINITIONS or
  // volumeBadgeDefinitions, same tables ProfileBadgesTab uses).
  badgeData?: {
    family: "genre" | "volume" | "ratingCount" | "reviewCount" | "listCount" | "followers" | "influencer" | "podium" | "firstSync" | "highMatch" | "syncExplorer" | "founding" | "membership" | "streak" | "timeTraveler" | "eclecticTaste" | "dayOneViewer" | "hiddenGem" | "pollParticipant" | "halloweenViewer" | "newYearViewer";
    key: string;
    tier: "devotee" | "master" | VolumeTier | ActivityTier | StreakTier;
    count: number;
    threshold: number;
  };
  likeCount: number;
  liked: boolean;
  viewCount: number;
  topViewers: FeedUserRef[];
  createdAt: string;
}

export interface ShareFeedResult {
  items: Share[];
  page: number;
  hasMore: boolean;
}

// Distinct from CustomList: owner is populated ({_id,username,profile_pic_url}),
// not the plain string CustomList.owner is typed as, plus fromFollowing.
export interface DiscoverListItem {
  _id: string;
  // accountTier drives SearchListCard.tsx's own Premium gold-frame
  // treatment (both /discover and /popular now project it).
  owner: { _id: string; username: string; profile_pic_url?: string; accountTier?: AccountTier };
  name: string;
  description: string;
  isPublic: boolean;
  items: CustomListItem[];
  previewItems: ListPreviewItem[];
  likeCount: number;
  views: number;
  createdAt: string;
  updatedAt: string;
  // Only present on /discover results — /popular reuses this same shape
  // without a following-relationship concept.
  fromFollowing?: boolean;
  // Only present on /popular results — the caller's own like state for
  // this list, needed for SearchListCard.tsx's interactive heart.
  hasLiked?: boolean;
}
