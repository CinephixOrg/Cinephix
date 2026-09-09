export type ContentType = "movie" | "series";

export type AccountTier = "free" | "plus" | "premium" | "dev";

export interface User {
  _id: string;
  username: string;
  email: string;
  profile_pic_url?: string;
  googleId?: string | null;
  isOAuthUser?: boolean;
  accountTier?: AccountTier;
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

// Reviewer is populated with 'username profile_pic_url' only — never bio/email.
export interface ReviewAuthor {
  _id: string;
  username: string;
  profile_pic_url?: string;
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
  | { type: "favorited"; actor: FeedUserRef; content: ActivityContent; createdAt: string }
  | { type: "list_item_added"; actor: FeedUserRef; content: ActivityContent; listId: string; listName: string; createdAt: string };

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

// GET /users/collections/:id — everything the public profile's Lists tab
// needs, in one response. `isAuthorized` false is the private-account
// masked shape, matching favorites/CineGraph.
//
// `lists` comes back in the same shape /discover and /popular return, so
// the profile's Lists rail renders with ListRailCard instead of needing a
// list card of its own.
export interface UserCollections {
  lists: DiscoverListItem[];
  watched: CollectionSlice;
  watchlist: CollectionSlice;
  isAuthorized: boolean;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type FollowStatus = "self" | "following" | "requested" | "not-following";
export type FollowActionType = "following" | "requested";

interface PublicProfileBase {
  _id: string;
  username: string;
  profile_pic_url?: string;
  isRequested: boolean;
}

// GET /users/profile/:id's masked branch (private account you don't follow)
// — every other field is absent from the response, not just empty.
export interface PublicProfileMasked extends PublicProfileBase {
  isAuthorized: false;
  isPrivateMasked: true;
  isPrivateAndHidden: true;
  message: string;
}

export interface PublicProfileFull extends PublicProfileBase {
  isAuthorized: true;
  bio?: string;
  visibility?: "public" | "private";
  accountTier?: AccountTier;
  followers: string[];
  following: string[];
  createdAt: string;
}

export type PublicProfile = PublicProfileFull | PublicProfileMasked;

// Own-profile call sites only ever hit the full branch (you're always
// authorized to view yourself).
export type UserProfile = PublicProfileFull;

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

// GET /users/me/follow-requests populates '_id username profile_pic_url name
// bio' but User has no `name` field, so only these four keys ever come back.
export interface FollowRequestUser {
  _id: string;
  username: string;
  profile_pic_url?: string;
  bio?: string;
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
  isAuthorized: boolean;
}

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
  isAuthorized: boolean;
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

export interface FavoritesMasked {
  isAuthorized: false;
  isPrivateMasked: true;
  isPrivateAndHidden: true;
  movies: [];
  series: [];
}

export interface FavoritesFull {
  isAuthorized: true;
  movies: FavoriteMovie[];
  series: FavoriteSeries[];
}

export type Favorites = FavoritesFull | FavoritesMasked;

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
  // Only hydrated by GET /lists/me (mirrors /discover, /popular) — absent
  // (not just empty) from the create/update/detail responses.
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

// Lightweight, bulk-hydrated {title, poster_path} for the first 5 items of
// a list — returned by /discover and /popular for the Home-tab preview
// cards, not the full per-item content shape ContentCard needs.
export interface ListPreviewItem {
  itemId: string;
  itemType: ContentType;
  title: string;
  poster_path?: string;
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

export type NotificationType = "follow" | "message" | "follow_request" | "follow_accepted";

export interface NotificationSender {
  _id: string;
  username: string;
  profile_pic_url?: string;
}

export interface Notification {
  _id: string;
  sender: NotificationSender;
  type: NotificationType;
  conversationId?: string | null;
  read: boolean;
  createdAt: string;
}

export type ActivityLogActionType = "RATE" | "ADD_WATCHLIST" | "IMPORT_TVTIME" | "IMPORT_LETTERBOXD";

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

export type ImportSource = "tvtime" | "letterboxd";

// Models the backend's two SSE completion payloads exactly — importedEpisodes
// is TV-Time-only, Letterboxd's completion event never includes the key.
export interface ImportResult {
  status: "completed" | "error";
  importedMovies?: number;
  importedEpisodes?: number;
  message?: string;
}

export type RoomType = "dm" | "group";

export type MessageType = "text" | "recommendation" | "analysis_share" | "profile_share";

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

// Discover's Most Favorited/Highest Rated/Most Recommended podium —
// always exactly 3 entries per list, all-time content signals
// (GET /feed/leaderboard). Each list carries only its own single metric
// (no cross-enrichment — an earlier version showed both favorite count and
// rating on every card regardless of list, simplified back to one metric
// per page per a follow-up request).
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
export interface LeaderboardResult {
  mostFavorited: FavoritedLeaderboardItem[];
  highestRated: RatedLeaderboardItem[];
  mostRecommended: RecommendedLeaderboardItem[];
}

// Medya/Shares' own podium — ranks people, not content (GET
// /feed/people-leaderboard). Only Most Watched has a movie/series
// dimension; Most Followed/Most Reviewed ignore the optional type filter.
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
export interface PeopleLeaderboardResult {
  mostFollowed: MostFollowedItem[];
  mostWatched: MostWatchedItem[];
  mostReviewed: MostReviewedItem[];
}

export type FeedActivityType = "rated" | "reviewed" | "watchlisted" | "followed";

export interface FeedUserRef {
  _id: string;
  username: string;
  profile_pic_url?: string;
  // Only populated on Share.user (getShareFeed/getUserShares) — drives the
  // Pro-tier gold card treatment on ShareCard, not present on other
  // FeedUserRef usages (topViewers, FeedActivityItem.user).
  accountTier?: AccountTier;
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
  | "watchlist_added"
  | "towatch_added"
  | "list_created"
  | "group_joined";

export interface PersonalActivityItem {
  type: PersonalActivityType;
  createdAt: string;
  content?: PopularThisWeekItem["content"]; // rated/reviewed/review_liked/watchlist_added/towatch_added
  value?: number; // "rated" only, 1-10
  excerpt?: string; // "reviewed"/"review_liked" only
  listId?: string; // "list_created" only
  listName?: string; // "list_created" only
  groupSlug?: string; // "group_joined" only
  groupName?: string; // "group_joined" only
  groupCoverImage?: string; // "group_joined" only
}

export interface PersonalActivityResult {
  items: PersonalActivityItem[];
  page: number;
  hasMore: boolean;
}

// Medya (social sharing feed) — a Share is always a snapshot of an
// analysis/review/recommendation at the moment it was posted, never a live
// reference (mirrors how chat's analysis_share/recommendation messages
// already snapshot instead of referencing).
export type ShareType = "analysis" | "review" | "recommendation" | "list";

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
  owner: { _id: string; username: string; profile_pic_url?: string };
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
}
