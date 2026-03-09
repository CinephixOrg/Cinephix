/**
 * Rating Service
 * Handles all rating-related API calls
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';

export const ratingService = {
  getRatings: async () => {
    try {
      const response = await API.get(API_ROUTES.RATINGS.GET_ALL);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch ratings' };
    }
  },

  createRating: async (ratingData) => {
    try {
      const response = await API.post(API_ROUTES.RATINGS.CREATE, ratingData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to create rating' };
    }
  },

  updateRating: async (ratingId, ratingData) => {
    try {
      const response = await API.put(API_ROUTES.RATINGS.UPDATE(ratingId), ratingData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update rating' };
    }
  },

  deleteRating: async (ratingId) => {
    try {
      const response = await API.delete(API_ROUTES.RATINGS.DELETE(ratingId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete rating' };
    }
  },
};

export default ratingService;
