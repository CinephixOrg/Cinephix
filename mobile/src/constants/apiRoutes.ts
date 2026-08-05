export const API_ROUTES = {
  AUTH: {
    LOGIN: "/users/login",
    REGISTER: "/users/register",
    SEND_VERIFICATION: "/users/send-verification",
    VERIFY_EMAIL: "/users/verify-email",
  },
  MOVIES: {
    GET_ALL: "/movies",
    GET_BY_ID: (id: string) => `/movies/${id}`,
    SEARCH: "/movies/search",
  },
  SERIES: {
    GET_ALL: "/series",
    GET_BY_ID: (id: string) => `/series/${id}`,
    SEARCH: "/series/search",
  },
  RATINGS: {
    CREATE_OR_UPDATE: "/ratings",
    GET_MY_RATING: (contentId: string) => `/ratings/me/${contentId}`,
  },
  WATCHLIST: {
    GET: "/users/me/watchlist",
    ADD: "/users/me/watchlist",
    REMOVE: (itemId: string, itemType: string) =>
      `/users/me/watchlist/${itemId}?itemType=${itemType}`,
  },
  USERS: {
    GET_PROFILE: (id: string) => `/users/profile/${id}`,
    GET_CINEGRAPH: (id: string) => `/users/cinegraph-data/${id}`,
    UPDATE_BIO: (id: string) => `/users/profile/${id}/bio`,
    UPLOAD_AVATAR: (id: string) => `/users/profile/${id}/upload-profile-pic`,
    UPDATE_PASSWORD: "/users/profile/password",
    UPDATE_VISIBILITY: "/users/me/visibility",
    DELETE_ACCOUNT: "/users/profile",
    GET_FOLLOWING: "/users/me/following",
    GET_FOLLOWERS: "/users/me/followers",
  },
  LISTS: {
    GET_MY_LISTS: "/lists/me",
    CREATE: "/lists",
    GET_BY_ID: (id: string) => `/lists/${id}`,
    UPDATE: (id: string) => `/lists/${id}`,
    DELETE: (id: string) => `/lists/${id}`,
    ADD_ITEM: (id: string) => `/lists/${id}/items`,
    REMOVE_ITEM: (id: string, itemId: string, itemType: string) =>
      `/lists/${id}/items/${itemId}?itemType=${itemType}`,
  },
  HEALTH: "/health",
};

export const STORAGE_KEYS = {
  TOKEN: "cinephix_token",
  USER: "cinephix_user",
};
