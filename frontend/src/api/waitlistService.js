import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';

export const waitlistService = {
  join: async (email) => {
    try {
      const response = await API.post(API_ROUTES.WAITLIST.JOIN, { email });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Something went wrong. Please try again.' };
    }
  },
};
