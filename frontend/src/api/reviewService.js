/**
 * Review Service
 * Handles all review-related API calls with caching
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';
import { setCacheItem, getCacheItem, clearCacheItem, CACHE_KEYS } from './cacheService';

export const reviewService = {
  getReviewsByContent: async (contentId, pagination = {}) => {
    try {
      // Check cache first
      const cached = getCacheItem(CACHE_KEYS.REVIEWS(contentId));
      if (cached) return cached;

      const response = await API.get(API_ROUTES.REVIEWS.GET_BY_CONTENT(contentId), {
        params: pagination,
      });
      const data = response.data;
      
      // Cache for 10 minutes
      setCacheItem(CACHE_KEYS.REVIEWS(contentId), data, 10 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch reviews' };
    }
  },

  createReview: async (reviewData) => {
    try {
      const response = await API.post(API_ROUTES.REVIEWS.CREATE, reviewData);
      
      // Invalidate review cache for this content
      clearCacheItem(CACHE_KEYS.REVIEWS(reviewData.contentId));
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to create review' };
    }
  },

  updateReview: async (reviewId, reviewData) => {
    try {
      const response = await API.put(API_ROUTES.REVIEWS.UPDATE(reviewId), reviewData);
      
      // Invalidate relevant caches
      if (reviewData.contentId) {
        clearCacheItem(CACHE_KEYS.REVIEWS(reviewData.contentId));
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update review' };
    }
  },

  deleteReview: async (reviewId) => {
    try {
      const response = await API.delete(API_ROUTES.REVIEWS.DELETE(reviewId));
      
      // Invalidate review caches (we don't know the content ID, so clear all reviews)
      clearCacheItem('reviews:');
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete review' };
    }
  },
};

export default reviewService;
