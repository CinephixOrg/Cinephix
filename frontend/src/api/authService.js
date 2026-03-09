/**
 * Authentication Service
 * Handles all auth-related API calls
 */

import API from './axios';
import { API_ROUTES } from '../constants/apiRoutes';

export const authService = {
  login: async (email, password) => {
    try {
      const response = await API.post(API_ROUTES.AUTH.LOGIN, { email, password });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Login failed' };
    }
  },

  register: async (username, email, password) => {
    try {
      const response = await API.post(API_ROUTES.AUTH.REGISTER, {
        username,
        email,
        password,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Registration failed' };
    }
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem(import.meta.env.VITE_AUTH_TOKEN_KEY || 'cinephix_auth_token');
  },
};

export default authService;
