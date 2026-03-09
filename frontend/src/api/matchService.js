/**
 * Match Service
 * Handles all matching/compatibility API calls
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';

export const matchService = {
  getMatches: async (page = 1, limit = 10) => {
    try {
      const response = await API.get(API_ROUTES.MATCH.GET_MATCHES, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch matches' };
    }
  },

  getCompatibility: async (userId) => {
    try {
      const response = await API.get(API_ROUTES.MATCH.GET_COMPATIBILITY(userId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch compatibility' };
    }
  },
};

export default matchService;
