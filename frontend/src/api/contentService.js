/**
 * Content Service
 * Handles movie and series API calls with caching
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';
import { setCacheItem, getCacheItem, CACHE_KEYS } from './cacheService';

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
      // Check cache first - movies don't change frequently
      const cached = getCacheItem(CACHE_KEYS.MOVIE(movieId));
      if (cached) return cached;

      const response = await API.get(API_ROUTES.MOVIES.GET_BY_ID(movieId));
      const data = response.data;
      
      // Cache for 30 minutes
      setCacheItem(CACHE_KEYS.MOVIE(movieId), data, 30 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch movie' };
    }
  },

  searchMovies: async (query) => {
    try {
      // Check cache first
      const cached = getCacheItem(CACHE_KEYS.MOVIE_SEARCH(query));
      if (cached) return cached;

      const response = await API.get(API_ROUTES.MOVIES.SEARCH, {
        params: { q: query },
      });
      const data = response.data;
      
      // Cache for 20 minutes
      setCacheItem(CACHE_KEYS.MOVIE_SEARCH(query), data, 20 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Search failed' };
    }
  },

  getMoviesBulk: async (movieIds, lightweight = false) => {
    try {
      if (!movieIds || movieIds.length === 0) return [];
      const response = await API.post(API_ROUTES.MOVIES.BULK, { ids: movieIds, lightweight });
      const movies = response.data || [];
      
      // Populate cache for each movie only if it's a full fetch
      if (!lightweight) {
        movies.forEach((movie) => {
          if (movie && movie._id) {
            setCacheItem(CACHE_KEYS.MOVIE(movie._id), movie, 30 * 60 * 1000);
          }
        });
      }
      return movies;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch bulk movies' };
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
      // Check cache first - series don't change frequently
      const cached = getCacheItem(CACHE_KEYS.SERIES(seriesId));
      if (cached) return cached;

      const response = await API.get(API_ROUTES.SERIES.GET_BY_ID(seriesId));
      const data = response.data;
      
      // Cache for 30 minutes
      setCacheItem(CACHE_KEYS.SERIES(seriesId), data, 30 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch series' };
    }
  },

  searchSeries: async (query) => {
    try {
      // Check cache first
      const cached = getCacheItem(CACHE_KEYS.SERIES_SEARCH(query));
      if (cached) return cached;

      const response = await API.get(API_ROUTES.SERIES.SEARCH, {
        params: { q: query },
      });
      const data = response.data;
      
      // Cache for 20 minutes
      setCacheItem(CACHE_KEYS.SERIES_SEARCH(query), data, 20 * 60 * 1000);
      return data;
    } catch (error) {
      throw error.response?.data || { message: 'Search failed' };
    }
  },

  getSeriesBulk: async (seriesIds, lightweight = false) => {
    try {
      if (!seriesIds || seriesIds.length === 0) return [];
      const response = await API.post(API_ROUTES.SERIES.BULK, { ids: seriesIds, lightweight });
      const series = response.data || [];
      
      // Populate cache for each series only if it's a full fetch
      if (!lightweight) {
        series.forEach((s) => {
          if (s && s._id) {
            setCacheItem(CACHE_KEYS.SERIES(s._id), s, 30 * 60 * 1000);
          }
        });
      }
      return series;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch bulk series' };
    }
  },
};

export default contentService;
