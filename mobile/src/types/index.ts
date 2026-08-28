export type ContentType = "movie" | "series";

export type AccountTier = "free" | "pro" | "premium" | "dev";

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

export type SwipeDecision = "accept" | "reject";

// GET /match/swipe/queue row — same shape for the swipe-away-forever queue
// and (via the same `user` field) the Rejected list below.
export interface SwipeCandidate {
  user: MatchUser;
  contentType: ContentType;
  matchPercentage: number;
}

export interface SwipeQueueResult {
  candidates: SwipeCandidate[];
  swipesPerDay: number;
  swipesUsedToday: number;
}

export interface SwipeResult {
  decision: SwipeDecision;
  followType: "following" | "requested" | null;
  swipesRemainingToday: number;
}

// GET /match/swipe/rejected row — Pro/Premium/Dev only.
export interface RejectedMatchEntry {
  user: MatchUser;
  contentType: ContentType;
  matchPercentage: number;
  rejectedAt: string;
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
  content: { id: string; title: string; poster_path?: string; type: ContentType };
  addCount: number;
  topAdders?: FeedUserRef[]; // up to 3, present on popular-this-week/popular-with-friends
}

export type FeedActivityType = "rated" | "reviewed" | "watchlisted" | "followed";

export interface FeedUserRef {
  _id: string;
  username: string;
  profile_pic_url?: string;
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
export type ShareType = "analysis" | "review" | "recommendation";

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
  createdAt: string;
  updatedAt: string;
  // Only present on /discover results — /popular reuses this same shape
  // without a following-relationship concept.
  fromFollowing?: boolean;
}
