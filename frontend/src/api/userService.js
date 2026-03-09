/**
 * User Service
 * Handles all user-related API calls
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';

export const userService = {
  getProfile: async (userId) => {
    try {
      const response = await API.get(API_ROUTES.USERS.GET_PROFILE(userId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch profile' };
    }
  },

  updateProfile: async (profileData) => {
    try {
      const response = await API.put(API_ROUTES.USERS.UPDATE_PROFILE, profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update profile' };
    }
  },

  getWatchlist: async () => {
    try {
      const response = await API.get(API_ROUTES.USERS.GET_WATCHLIST);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch watchlist' };
    }
  },

  updateWatchlist: async (watchlistData) => {
    try {
      const response = await API.put(API_ROUTES.USERS.UPDATE_WATCHLIST, watchlistData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update watchlist' };
    }
  },

  follow: async (userId) => {
    try {
      const response = await API.post(API_ROUTES.USERS.FOLLOW(userId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to follow user' };
    }
  },

  unfollow: async (userId) => {
    try {
      const response = await API.post(API_ROUTES.USERS.UNFOLLOW(userId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to unfollow user' };
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
