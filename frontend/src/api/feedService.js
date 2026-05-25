// frontend/src/api/feedService.js
import API from "./axios";
import { API_ROUTES } from "../constants/apiRoutes";

export const feedService = {
  getTopPicks: async (limit = 10) => {
    try {
      const response = await API.get(API_ROUTES.FEED.GET_TOP_PICKS, { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Failed to fetch top picks" };
    }
  },

  getFeed: async (page = 1, limit = 20) => {
    try {
      const response = await API.get(API_ROUTES.FEED.GET_FEED, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Failed to fetch feed" };
    }
  },

  getRecommendations: async (limit = 20, type = "all") => {
    try {
      const response = await API.get(API_ROUTES.FEED.GET_RECOMMENDATIONS, {
        params: { limit, type },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Failed to fetch recommendations" };
    }
  },

  getPopularThisWeek: async (limit = 20) => {
    try {
      const response = await API.get(API_ROUTES.FEED.GET_POPULAR_THIS_WEEK, { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Failed to fetch popular this week" };
    }
  },
};

export default feedService;
