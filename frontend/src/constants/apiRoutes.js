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
    GET_PROFILE: (userId) => `${API_BASE_URL}/users/${userId}`,
    UPDATE_PROFILE: `${API_BASE_URL}/users/profile`,
    UPDATE_WATCHLIST: `${API_BASE_URL}/users/watchlist`,
    GET_WATCHLIST: `${API_BASE_URL}/users/watchlist`,
    FOLLOW: (userId) => `${API_BASE_URL}/users/${userId}/follow`,
    UNFOLLOW: (userId) => `${API_BASE_URL}/users/${userId}/unfollow`,
  },

  // Movie Routes
  MOVIES: {
    GET_ALL: `${API_BASE_URL}/movies`,
    GET_BY_ID: (movieId) => `${API_BASE_URL}/movies/${movieId}`,
    SEARCH: `${API_BASE_URL}/movies/search`,
  },

  // Series Routes
  SERIES: {
    GET_ALL: `${API_BASE_URL}/series`,
    GET_BY_ID: (seriesId) => `${API_BASE_URL}/series/${seriesId}`,
    SEARCH: `${API_BASE_URL}/series/search`,
  },

  // Ratings Routes
  RATINGS: {
    GET_ALL: `${API_BASE_URL}/ratings`,
    CREATE: `${API_BASE_URL}/ratings`,
    UPDATE: (ratingId) => `${API_BASE_URL}/ratings/${ratingId}`,
    DELETE: (ratingId) => `${API_BASE_URL}/ratings/${ratingId}`,
  },

  // Reviews Routes
  REVIEWS: {
    GET_ALL: `${API_BASE_URL}/reviews`,
    CREATE: `${API_BASE_URL}/reviews`,
    UPDATE: (reviewId) => `${API_BASE_URL}/reviews/${reviewId}`,
    DELETE: (reviewId) => `${API_BASE_URL}/reviews/${reviewId}`,
  },

  // Match Routes
  MATCH: {
    GET_MATCHES: `${API_BASE_URL}/match/suggestions`,
    GET_COMPATIBILITY: (userId) => `${API_BASE_URL}/match/compatibility/${userId}`,
  },

  // Network Routes
  NETWORK: {
    GET_CONNECTIONS: `${API_BASE_URL}/users/connections`,
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
