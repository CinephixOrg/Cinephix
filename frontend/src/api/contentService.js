/**
 * Content Service
 * Handles movie and series API calls
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';

export const contentService = {
  // Movie Methods
  getMovies: async (page = 1, limit = 12) => {
    try {
      const response = await API.get(API_ROUTES.MOVIES.GET_ALL, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch movies' };
    }
  },

  getMovieById: async (movieId) => {
    try {
      const response = await API.get(API_ROUTES.MOVIES.GET_BY_ID(movieId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch movie' };
    }
  },

  searchMovies: async (query) => {
    try {
      const response = await API.get(API_ROUTES.MOVIES.SEARCH, {
        params: { q: query },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Search failed' };
    }
  },

  // Series Methods
  getSeries: async (page = 1, limit = 12) => {
    try {
      const response = await API.get(API_ROUTES.SERIES.GET_ALL, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch series' };
    }
  },

  getSeriesById: async (seriesId) => {
    try {
      const response = await API.get(API_ROUTES.SERIES.GET_BY_ID(seriesId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch series' };
    }
  },

  searchSeries: async (query) => {
    try {
      const response = await API.get(API_ROUTES.SERIES.SEARCH, {
        params: { q: query },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Search failed' };
    }
  },
};

export default contentService;
