/**
 * API Endpoints Configuration
 * Centralized location for all API routes
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const API_ROUTES = {
  // Auth Routes
  AUTH: {
    LOGIN: `${API_BASE_URL}/users/login`,
    REGISTER: `${API_BASE_URL}/users/register`,
    LOGOUT: `${API_BASE_URL}/users/logout`,
    REFRESH: `${API_BASE_URL}/users/refresh`,
  },

  // User Routes
  USERS: {
    GET_CURRENT: `${API_BASE_URL}/users/me`,
    GET_PROFILE: (userId) => `${API_BASE_URL}/users/profile/${userId}`,
    GET_PROFILE_ANALYSIS: `${API_BASE_URL}/users/profile-analysis`,
    UPDATE_PROFILE: `${API_BASE_URL}/users/profile`,
    GET_FAVORITES: (userId) => `${API_BASE_URL}/users/favorites/${userId}`,
    GET_CINE_GRAPH: (userId) => `${API_BASE_URL}/users/cinegraph-data/${userId}`,
    UPLOAD_PROFILE_PIC: (userId) => `${API_BASE_URL}/users/profile/${userId}/upload-profile-pic`,
    UPDATE_BIO: (userId) => `${API_BASE_URL}/users/profile/${userId}/bio`,
    UPDATE_PASSWORD: `${API_BASE_URL}/users/profile/password`,
    DELETE_ACCOUNT: `${API_BASE_URL}/users/profile`,
    ADD_TO_WATCHLIST: `${API_BASE_URL}/users/me/watchlist`,
    REMOVE_FROM_WATCHLIST: (contentId, contentType) => `${API_BASE_URL}/users/me/watchlist/${contentId}?itemType=${contentType}`,
    GET_WATCHLIST: `${API_BASE_URL}/users/me/watchlist`,
    ADD_TO_TO_WATCH_LIST: `${API_BASE_URL}/users/me/to-watch`,
    REMOVE_FROM_TO_WATCH_LIST: (contentId, contentType) => `${API_BASE_URL}/users/me/to-watch/${contentId}?itemType=${contentType}`,
    GET_TO_WATCH_LIST: `${API_BASE_URL}/users/me/to-watch`,
    FOLLOW: (userId) => `${API_BASE_URL}/users/${userId}/follow`,
    UNFOLLOW: (userId) => `${API_BASE_URL}/users/${userId}/unfollow`,
    ACCEPT_FOLLOW_REQUEST: (userId) => `${API_BASE_URL}/users/${userId}/follow-request/accept`,
    REJECT_FOLLOW_REQUEST: (userId) => `${API_BASE_URL}/users/${userId}/follow-request/reject`,
    GET_PENDING_REQUESTS: `${API_BASE_URL}/users/me/follow-requests`,
    GET_SENT_REQUESTS: `${API_BASE_URL}/users/me/sent-requests`,
    GET_SUGGESTIONS: `${API_BASE_URL}/users/me/suggestions`,
    SEARCH: (query) => `${API_BASE_URL}/users/search?query=${encodeURIComponent(query)}`,
    GET_FOLLOWING: `${API_BASE_URL}/users/me/following`,
  },

  // Movie Routes
  MOVIES: {
    GET_ALL: `${API_BASE_URL}/movies`,
    GET_BY_ID: (movieId) => `${API_BASE_URL}/movies/${movieId}`,
    SEARCH: `${API_BASE_URL}/movies/search`,
    BULK: `${API_BASE_URL}/movies/bulk`,
  },

  // Series Routes
  SERIES: {
    GET_ALL: `${API_BASE_URL}/series`,
    GET_BY_ID: (seriesId) => `${API_BASE_URL}/series/${seriesId}`,
    SEARCH: `${API_BASE_URL}/series/search`,
    BULK: `${API_BASE_URL}/series/bulk`,
  },

  // Ratings Routes
  RATINGS: {
    GET_ALL: `${API_BASE_URL}/ratings`,
    GET_MY_RATING: (contentId) => `${API_BASE_URL}/ratings/me/${contentId}`,
    GET_ALL_FOR_CONTENT: (contentId) => `${API_BASE_URL}/ratings/content/${contentId}`,
    CREATE: `${API_BASE_URL}/ratings`,
    UPDATE: (ratingId) => `${API_BASE_URL}/ratings/${ratingId}`,
    DELETE: (ratingId) => `${API_BASE_URL}/ratings/${ratingId}`,
  },

  // Reviews Routes
  REVIEWS: {
    GET_ALL: `${API_BASE_URL}/reviews`,
    GET_BY_CONTENT: (contentId) => `${API_BASE_URL}/reviews/content/${contentId}`,
    GET_FRIENDS: (contentId) => `${API_BASE_URL}/reviews/content/${contentId}/friends`,
    GET_POPULAR: `${API_BASE_URL}/reviews/popular`,
    TOGGLE_LIKE: (reviewId) => `${API_BASE_URL}/reviews/${reviewId}/like`,
    CREATE: `${API_BASE_URL}/reviews`,
    UPDATE: (reviewId) => `${API_BASE_URL}/reviews/${reviewId}`,
    DELETE: (reviewId) => `${API_BASE_URL}/reviews/${reviewId}`,
  },

  // Custom Lists Routes
  LISTS: {
    DISCOVER: `${API_BASE_URL}/lists/discover`,
    GET_MY_LISTS: `${API_BASE_URL}/lists/me`,
    CREATE: `${API_BASE_URL}/lists`,
    GET_BY_ID: (id) => `${API_BASE_URL}/lists/${id}`,
    UPDATE: (id) => `${API_BASE_URL}/lists/${id}`,
    DELETE: (id) => `${API_BASE_URL}/lists/${id}`,
    ADD_ITEM: (id) => `${API_BASE_URL}/lists/${id}/items`,
    REMOVE_ITEM: (id, itemId) => `${API_BASE_URL}/lists/${id}/items/${itemId}`,
  },

  // Match Routes
  MATCH: {
    GET_MATCHES: `${API_BASE_URL}/match`,
    GET_COMPATIBILITY: (userId) => `${API_BASE_URL}/match/compatibility/${userId}`,
    ANALYZE_MATCH: (userId) => `${API_BASE_URL}/match/${userId}/analyze`,
  },

  // Network Routes
  NETWORK: {
    GET_CONNECTIONS: `${API_BASE_URL}/users/connections`,
  },

  // Feed Routes
  FEED: {
    GET_FEED: `${API_BASE_URL}/feed`,
    GET_TOP_PICKS: `${API_BASE_URL}/feed/top-picks`,
    GET_RECOMMENDATIONS: `${API_BASE_URL}/feed/recommendations`,
    GET_POPULAR_THIS_WEEK: `${API_BASE_URL}/feed/popular-this-week`,
  },

  // Direct Messages / Conversations
  CONVERSATIONS: {
    GET_ALL: `${API_BASE_URL}/conversations`,
    GET_OR_CREATE: `${API_BASE_URL}/conversations`,
    GET_MESSAGES: (id) => `${API_BASE_URL}/conversations/${id}/messages`,
    MARK_READ: (id) => `${API_BASE_URL}/conversations/${id}/read`,
    SEND_MESSAGE: (id) => `${API_BASE_URL}/conversations/${id}/messages`,
  },

  // Community / Groups Routes
  GROUPS: {
    GET_ALL: `${API_BASE_URL}/groups`,
    GET_BY_SLUG: (slug) => `${API_BASE_URL}/groups/${slug}`,
    JOIN: (slug) => `${API_BASE_URL}/groups/${slug}/join`,
    LEAVE: (slug) => `${API_BASE_URL}/groups/${slug}/leave`,
    GET_MEMBERS: (slug) => `${API_BASE_URL}/groups/${slug}/members`,
    GET_MESSAGES: (slug) => `${API_BASE_URL}/groups/${slug}/messages`,
    SEND_MESSAGE: (slug) => `${API_BASE_URL}/groups/${slug}/messages`,
  },
};

/**
 * Application Constants
 */
export const APP_CONSTANTS = {
  // Pagination
  ITEMS_PER_PAGE: 12,
  
  // Rating
  MAX_RATING: 10,
  MIN_RATING: 1,

  // Content Types
  CONTENT_TYPES: {
    MOVIE: 'movie',
    SERIES: 'series',
  },

  // Local Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'cinephix_auth_token',
    USER: 'cinephix_user',
    THEME: 'cinephix_theme',
    PREFERENCES: 'cinephix_preferences',
  },

  // Timeouts (in ms)
  TIMEOUTS: {
    API: 10000,
    DEBOUNCE: 300,
    TOAST: 3000,
  },

  // Messages
  MESSAGES: {
    SUCCESS: {
      LOGIN: 'Login successful!',
      REGISTER: 'Registration successful! Please log in.',
      UPDATE: 'Profile updated successfully!',
      RATING_ADDED: 'Rating added successfully!',
      RATING_UPDATED: 'Rating updated!',
      REVIEW_ADDED: 'Review posted!',
    },
    ERROR: {
      NETWORK: 'Network error. Please try again.',
      UNAUTHORIZED: 'Please log in to continue.',
      NOT_FOUND: 'Item not found.',
      SERVER_ERROR: 'Server error. Please try again later.',
      VALIDATION: 'Please check your input.',
    },
    INFO: {
      LOADING: 'Loading...',
      NO_RESULTS: 'No results found.',
    },
  },
};

export default API_ROUTES;
