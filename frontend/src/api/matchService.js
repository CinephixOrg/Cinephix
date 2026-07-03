/**
 * Match Service
 * Handles all matching/compatibility API calls with Hybrid Algorithm
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';

export const matchService = {
  /**
   * HYBRID APPROACH: Kullanıcılar için eşleşme önerileri getir
   * 
   * @param {Object} filters - Filter options
   * @param {String} filters.type - "movie" | "series"
   * @param {Array} filters.genres - Optional: Tür filtreleri
   * @param {Boolean} filters.useCount - Tür sayısını kullan?
   * @param {Boolean} filters.useAvgRating - Rating'i kullan?
   * @param {Boolean} filters.hybridMode - Hybrid algoritma kullan?
   * @param {Number} page - Page number
   * @param {Number} limit - Items per page
   * @returns {Object} { data: matches[], pagination: {...} }
   */
  getMatches: async (filters = {}, page = 1, limit = 10) => {
    try {
      const payload = {
        type: filters.type || 'movie',
        genres: filters.genres || [],
        useCount: filters.useCount !== undefined ? filters.useCount : true,
        useAvgRating: filters.useAvgRating !== undefined ? filters.useAvgRating : true,
        hybridMode: filters.hybridMode !== undefined ? filters.hybridMode : true,
        page,
        limit,
      };

      const response = await API.post(API_ROUTES.MATCH.GET_MATCHES, payload);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch matches' };
    }
  },

  /**
   * İki kullanıcı arasında detaylı uyum skoru
   */
  getCompatibility: async (userId) => {
    try {
      const response = await API.get(API_ROUTES.MATCH.GET_COMPATIBILITY(userId));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch compatibility' };
    }
  },

  /**
   * YENİ: Belirli bir kullanıcıyla olan match yüzdesini hesapla
   */
  getMatchWithUser: async (targetUserId, type = 'movie', filters = {}) => {
    try {
      const payload = {
        type: filters.type || type,
        genres: filters.genres || [],
        useCount: filters.useCount !== undefined ? filters.useCount : true,
        useAvgRating: filters.useAvgRating !== undefined ? filters.useAvgRating : true,
      };
      const response = await API.post(`${API_ROUTES.MATCH.GET_MATCHES}/${targetUserId}`, payload);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to calculate match' };
    }
  },

  /**
   * Trending matches (şu anda diğer kullanıcılar tarafından en çok arananlar)
   */
  getTrendingMatches: async (type = 'movie', limit = 10) => {
    try {
      const response = await API.get(`${API_ROUTES.MATCH.GET_MATCHES}?type=${type}&trending=true&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch trending matches' };
    }
  },

  /**
   * Favori film/diziye dayalı match'ler
   */
  getContentBasedMatches: async (contentId, contentType = 'movie', limit = 10) => {
    try {
      const response = await API.get(`${API_ROUTES.MATCH.GET_MATCHES}?contentId=${contentId}&type=${contentType}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch content-based matches' };
    }
  },

  analyzeMatchWithUser: async (targetUserId, type = 'movie', mock = false) => {
    try {
      const url = `${API_ROUTES.MATCH.ANALYZE_MATCH(targetUserId)}${mock ? '?mock=true' : ''}`;
      const response = await API.post(url, { type });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to analyze match' };
    }
  },
};

export default matchService;
