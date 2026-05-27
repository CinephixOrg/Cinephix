/**
 * Review Service
 * Handles all review-related API calls with caching
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';
import { setCacheItem, getCacheItem, clearCacheItem, CACHE_KEYS } from './cacheService';

export const reviewService = {
  getReviewsByContent: async (contentId, sort = "recent") => {
    try {
      const cacheKey = `${CACHE_KEYS.REVIEWS(contentId)}:${sort}`;
      const cached = getCacheItem(cacheKey);
      if (cached) return cached;

      const response = await API.get(API_ROUTES.REVIEWS.GET_BY_CONTENT(contentId), {
        params: { sort, limit: 50 },
      });
      const data = response.data;

      setCacheItem(cacheKey, data, 5 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch reviews' };
    }
  },

  getFriendsReviews: async (contentId) => {
    try {
      const response = await API.get(API_ROUTES.REVIEWS.GET_FRIENDS(contentId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch friends reviews' };
    }
  },

  getPopularReviews: async (limit = 10) => {
    try {
      const response = await API.get(API_ROUTES.REVIEWS.GET_POPULAR, { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch popular reviews' };
    }
  },

  toggleLike: async (reviewId) => {
    try {
      const response = await API.post(API_ROUTES.REVIEWS.TOGGLE_LIKE(reviewId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to toggle like' };
    }
  },

  createReview: async (reviewData) => {
    try {
      const response = await API.post(API_ROUTES.REVIEWS.CREATE, reviewData);
      clearCacheItem(CACHE_KEYS.REVIEWS(reviewData.contentId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to create review' };
    }
  },

  updateReview: async (reviewId, reviewData) => {
    try {
      const response = await API.put(API_ROUTES.REVIEWS.UPDATE(reviewId), reviewData);
      if (reviewData.contentId) {
        clearCacheItem(CACHE_KEYS.REVIEWS(reviewData.contentId));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update review' };
    }
  },

  deleteReview: async (reviewId, contentId) => {
    try {
      const response = await API.delete(API_ROUTES.REVIEWS.DELETE(reviewId));
      if (contentId) clearCacheItem(CACHE_KEYS.REVIEWS(contentId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete review' };
    }
  },
};

export default reviewService;
