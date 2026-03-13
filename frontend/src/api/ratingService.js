/**
 * Rating Service
 * Handles all rating-related API calls with caching
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';
import { setCacheItem, getCacheItem, clearCacheItem, CACHE_KEYS } from './cacheService';

export const ratingService = {
  getRatings: async () => {
    try {
      const response = await API.get(API_ROUTES.RATINGS.GET_ALL);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch ratings' };
    }
  },

  getMyRating: async (contentId) => {
    try {
      const response = await API.get(API_ROUTES.RATINGS.GET_MY_RATING(contentId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch rating' };
    }
  },

  createRating: async (ratingData) => {
    try {
      const response = await API.post(API_ROUTES.RATINGS.CREATE, ratingData);
      
      // Invalidate cine graph cache when rating changes
      clearCacheItem('cineGraph:*');
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to create rating' };
    }
  },

  updateRating: async (ratingId, ratingData) => {
    try {
      const response = await API.put(API_ROUTES.RATINGS.UPDATE(ratingId), ratingData);
      
      // Invalidate cine graph cache when rating changes
      clearCacheItem('cineGraph:*');
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update rating' };
    }
  },

  deleteRating: async (ratingId) => {
    try {
      const response = await API.delete(API_ROUTES.RATINGS.DELETE(ratingId));
      
      // Invalidate cine graph cache when rating is deleted
      clearCacheItem('cineGraph:*');
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete rating' };
    }
  },
};

export default ratingService;
