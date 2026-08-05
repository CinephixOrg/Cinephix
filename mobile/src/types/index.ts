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
