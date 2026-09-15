/**
 * User Service
 * Handles all user-related API calls with caching
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';
import { setCacheItem, getCacheItem, clearCacheItem, clearCacheByPattern, CACHE_KEYS } from './cacheService';

export const userService = {
  getCurrentUser: async () => {
    try {
      // Check cache first
      const cached = getCacheItem(CACHE_KEYS.CURRENT_USER);
      if (cached) return cached;

      const response = await API.get(API_ROUTES.USERS.GET_CURRENT);
      const data = response.data;
      
      // Cache for 5 minutes
      setCacheItem(CACHE_KEYS.CURRENT_USER, data, 5 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch current user' };
    }
  },

  getProfileAnalysis: async () => {
    try {
      const response = await API.get(API_ROUTES.USERS.GET_PROFILE_ANALYSIS);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch profile analysis' };
    }
  },

  getProfile: async (userId) => {
    try {
      // Check cache first
      const cached = getCacheItem(CACHE_KEYS.USER(userId));
      if (cached) return cached;

      const response = await API.get(API_ROUTES.USERS.GET_PROFILE(userId));
      const data = response.data;
      
      // Cache for 10 minutes
      setCacheItem(CACHE_KEYS.USER(userId), data, 10 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch profile' };
    }
  },

  getFavorites: async (userId) => {
    try {
      // Check cache first
      const cached = getCacheItem(CACHE_KEYS.FAVORITES(userId));
      if (cached) return cached;

      const response = await API.get(API_ROUTES.USERS.GET_FAVORITES(userId));
      const data = response.data;
      
      // Cache for 10 minutes
      setCacheItem(CACHE_KEYS.FAVORITES(userId), data, 10 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch favorites' };
    }
  },

  getCineGraphData: async (userId) => {
    try {
      // Check cache first
      const cached = getCacheItem(CACHE_KEYS.CINE_GRAPH(userId));
      if (cached) return cached;

      const response = await API.get(API_ROUTES.USERS.GET_CINE_GRAPH(userId));
      const data = response.data;
      
      // Cache for 15 minutes (less frequently changes)
      setCacheItem(CACHE_KEYS.CINE_GRAPH(userId), data, 15 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch cine graph data' };
    }
  },

  updateProfile: async (profileData) => {
    try {
      const response = await API.put(API_ROUTES.USERS.UPDATE_PROFILE, profileData);
      const data = response.data;
      
      // Invalidate cache after update
      clearCacheItem(CACHE_KEYS.CURRENT_USER);
      clearCacheByPattern('user:');
      
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update profile' };
    }
  },

  uploadProfilePic: async (userId, formData) => {
    try {
      const response = await API.post(API_ROUTES.USERS.UPLOAD_PROFILE_PIC(userId), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      // Invalidate cache after upload
      clearCacheItem(CACHE_KEYS.CURRENT_USER);
      clearCacheItem(CACHE_KEYS.USER(userId));
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to upload profile picture' };
    }
  },

  updateBio: async (userId, bio) => {
    try {
      const response = await API.patch(API_ROUTES.USERS.UPDATE_BIO(userId), { bio });
      
      // Invalidate cache after update
      clearCacheItem(CACHE_KEYS.CURRENT_USER);
      clearCacheItem(CACHE_KEYS.USER(userId));
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update bio' };
    }
  },

  updatePassword: async (oldPassword, newPassword) => {
    try {
      const response = await API.put(API_ROUTES.USERS.UPDATE_PASSWORD, {
        oldPassword,
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update password' };
    }
  },

  deleteAccount: async () => {
    try {
      const response = await API.delete(API_ROUTES.USERS.DELETE_ACCOUNT);
      
      // Clear all cache on account deletion
      clearCacheByPattern('user');
      clearCacheByPattern('watchlist');
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete account' };
    }
  },

  addToWatchlist: async (contentId, contentType) => {
    try {
      const response = await API.post(API_ROUTES.USERS.ADD_TO_WATCHLIST, {
        id: contentId,
        type: contentType,
      });
      
      // Invalidate watchlist cache
      clearCacheItem(CACHE_KEYS.WATCHLIST);
      clearCacheItem(CACHE_KEYS.CURRENT_USER);
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to add to watchlist' };
    }
  },

  removeFromWatchlist: async (contentId, contentType) => {
    try {
      const response = await API.delete(API_ROUTES.USERS.REMOVE_FROM_WATCHLIST(contentId, contentType));
      
      // Invalidate watchlist cache
      clearCacheItem(CACHE_KEYS.WATCHLIST);
      clearCacheItem(CACHE_KEYS.CURRENT_USER);
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to remove from watchlist' };
    }
  },

  getWatchlist: async () => {
    try {
      // Check cache first
      const cached = getCacheItem(CACHE_KEYS.WATCHLIST);
      if (cached) return cached;

      const response = await API.get(API_ROUTES.USERS.GET_WATCHLIST);
      const data = response.data;
      
      // Cache for 10 minutes
      setCacheItem(CACHE_KEYS.WATCHLIST, data, 10 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch watchlist' };
    }
  },

  addToToWatchList: async (contentId, contentType) => {
    try {
      const response = await API.post(API_ROUTES.USERS.ADD_TO_TO_WATCH_LIST, {
        id: contentId,
        type: contentType,
      });
      clearCacheItem(CACHE_KEYS.TO_WATCH_LIST);
      clearCacheItem(CACHE_KEYS.CURRENT_USER);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to add to watchlist' };
    }
  },

  removeFromToWatchList: async (contentId, contentType) => {
    try {
      const response = await API.delete(API_ROUTES.USERS.REMOVE_FROM_TO_WATCH_LIST(contentId, contentType));
      clearCacheItem(CACHE_KEYS.TO_WATCH_LIST);
      clearCacheItem(CACHE_KEYS.CURRENT_USER);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to remove from watchlist' };
    }
  },

  getToWatchList: async () => {
    try {
      const cached = getCacheItem(CACHE_KEYS.TO_WATCH_LIST);
      if (cached) return cached;
      const response = await API.get(API_ROUTES.USERS.GET_TO_WATCH_LIST);
      const data = response.data;
      setCacheItem(CACHE_KEYS.TO_WATCH_LIST, data, 10 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch watchlist' };
    }
  },

  updateWatchlist: async (watchlistData) => {
    try {
      const response = await API.put(API_ROUTES.USERS.UPDATE_WATCHLIST, watchlistData);
      
      // Invalidate cache
      clearCacheItem(CACHE_KEYS.WATCHLIST);
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update watchlist' };
    }
  },

  follow: async (userId) => {
    try {
      const response = await API.post('/users/follow', { targetId: userId });
      
      // Invalidate profiles and user caches
      clearCacheItem(CACHE_KEYS.CURRENT_USER);
      clearCacheByPattern('user:');
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to follow user' };
    }
  },

  unfollow: async (userId) => {
    try {
      const response = await API.post('/users/unfollow', { targetId: userId });
      
      // Invalidate profiles and user caches
      clearCacheItem(CACHE_KEYS.CURRENT_USER);
      clearCacheByPattern('user:');
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to unfollow user' };
    }
  },

  getSuggestions: async (limit = 5) => {
    try {
      const response = await API.get(API_ROUTES.USERS.GET_SUGGESTIONS, { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch suggestions' };
    }
  },

  getConnections: async () => {
    try {
      const response = await API.get(API_ROUTES.NETWORK.GET_CONNECTIONS);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch connections' };
    }
  },
};

export default userService;
