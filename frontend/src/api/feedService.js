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
};

export default feedService;
