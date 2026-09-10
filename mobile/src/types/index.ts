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
  // one tap away in Medya's own feed.
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
  // Present because GET /users/profile/:id spreads the full (lean) User
  // document straight into the response — real schema field, not something
  // this endpoint had to be taught to expose.
  isOfficial?: boolean;
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
  llmInput: unknown;
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

export interface ProfileAnalysis {
  nickname: string;
  personalitySummary: string;
  funFact: string;
  recommendedConcept: string;
  // Pro/Premium only — absent entirely on the Free (basic) schema.
  genreBreakdown?: { genre: string; percentage: number }[];
  tasteCategory?: string;
  trendVsLastAnalysis?: string;
  tier?: AccountTier;
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

export type MessageType = "text" | "recommendation" | "analysis_share";

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

// Medya/Shares' own podium — ranks people, not content (GET
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
export interface PeopleLeaderboardResult {
  mostFollowed: MostFollowedItem[];
  mostWatched: MostWatchedItem[];
  mostReviewed: MostReviewedItem[];
  mostLiked: MostLikedItem[];
  topRecommenders: TopRecommenderItem[];
}

// GET /feed/my-podium-placements — powers the "you made the podium!" popup
// (see app/(app)/_layout.tsx). `category` matches PeopleLeaderboardResult's
// own field names (backend's PODIUM_CATEGORY_KEYS) verbatim, not
// PeoplePodium.tsx's own shorter CategoryKey union — PodiumNewsModal.tsx
// maps between the two.
export interface PodiumPlacement {
  category: "mostFollowed" | "mostWatched" | "mostReviewed" | "mostLiked" | "topRecommenders";
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
export type ShareType = "analysis" | "review" | "recommendation" | "list" | "official" | "poll";

export type OfficialContentCategory = "trivia" | "tip" | "highlight" | "on_this_day" | "stats" | "announcement";

export interface PollOption {
  text: string;
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
