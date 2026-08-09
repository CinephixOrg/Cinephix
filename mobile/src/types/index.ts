export type ContentType = "movie" | "series";

export interface User {
  _id: string;
  username: string;
  email: string;
  profile_pic_url?: string;
  googleId?: string | null;
  isOAuthUser?: boolean;
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

export interface UserProfile {
  _id: string;
  username: string;
  bio?: string;
  profile_pic_url?: string;
  visibility?: "public" | "private";
  isOAuthUser?: boolean;
  createdAt: string;
  followers: string[];
  following: string[];
}

export interface Connection {
  _id: string;
  username: string;
  profile_pic_url?: string;
}

export type CineGraphStats = Record<string, number>;

export interface CineGraphData {
  movieStats: CineGraphStats;
  seriesStats: CineGraphStats;
  isAuthorized: boolean;
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
  createdAt: string;
  updatedAt: string;
}

export interface MatchUser {
  _id: string;
  username: string;
  profile_pic_url?: string;
  bio?: string;
}

export interface MatchResult {
  user: MatchUser;
  matchPercentage: number;
}

export interface MatchAnalysis {
  provider: "mock" | "groq" | "openrouter" | "openai";
  parsed: {
    analysis: string;
    strengths: string[];
    weaknesses: string[];
    conversation_starters: string[];
    graph_ascii: string | string[];
  };
  raw: unknown;
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

export type RoomType = "dm" | "group";

export type MessageType = "text" | "recommendation" | "analysis_share";

export interface MessageSender {
  _id: string;
  username: string;
  profile_pic_url?: string;
}

export interface Message {
  _id: string;
  roomType: RoomType;
  roomId: string;
  sender: MessageSender;
  text: string;
  type: MessageType;
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
}

// Raw movie/series doc fields spread directly by the backend — title (movies)
// OR name (series), not normalized like PopularThisWeekItem.content.title.
export interface RecommendationItem {
  _id: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  contentType: ContentType;
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
  createdAt: string;
  updatedAt: string;
  fromFollowing: boolean;
}
