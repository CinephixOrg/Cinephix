/**
 * Routes Registration
 * Centralized route registration for the entire application
 */

import userRoute from './userRoute.js';
import movieRoute from './movieRoute.js';
import seriesRoute from './seriesRoute.js';
import reviewRoutes from './reviewRoutes.js';
import ratingRoutes from './rating.js';
import matchRoute from './matchRoute.js';
import userWatchlistRoute from './userWatchlistRoute.js';
import userToWatchListRoute from './userToWatchListRoute.js';

/**
 * Initializes all API routes
 * @param {Express.Application} app - Express app instance
 */
export const setupRoutes = (app) => {
  // Base API prefix
  const API_PREFIX = '/api';

  // User Authentication & Profile Routes
  app.use(`${API_PREFIX}/users`, userRoute);
  
  // Custom User Lists Routes
  app.use(`${API_PREFIX}/users/me`, userWatchlistRoute);
  app.use(`${API_PREFIX}/users/me`, userToWatchListRoute);

  // Content Routes
  app.use(`${API_PREFIX}/movies`, movieRoute);
  app.use(`${API_PREFIX}/series`, seriesRoute);

  // User Interaction Routes
  app.use(`${API_PREFIX}/ratings`, ratingRoutes);
  app.use(`${API_PREFIX}/reviews`, reviewRoutes);

  // Social/Match Routes
  app.use(`${API_PREFIX}/match`, matchRoute);

  // Health Check
  app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({
      success: true,
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
    });
  });
};

/**
 * Routes Documentation
 * 
 * Authentication:
 * - POST /api/users/register - Register new user
 * - POST /api/users/login - Login user
 * - POST /api/users/logout - Logout user
 * 
 * User Profile:
 * - GET /api/users/:id - Get user profile
 * - PUT /api/users/profile - Update profile
 * - GET /api/users/watchlist - Get watchlist
 * - PUT /api/users/watchlist - Update watchlist
 * - POST /api/users/:id/follow - Follow user
 * - POST /api/users/:id/unfollow - Unfollow user
 * 
 * Content:
 * - GET /api/movies - Get all movies
 * - GET /api/movies/:id - Get movie details
 * - GET /api/series - Get all series
 * - GET /api/series/:id - Get series details
 * 
 * Ratings:
 * - GET /api/ratings - Get user's ratings
 * - POST /api/ratings - Create rating
 * - PUT /api/ratings/:id - Update rating
 * - DELETE /api/ratings/:id - Delete rating
 * 
 * Reviews:
 * - GET /api/reviews - Get reviews
 * - POST /api/reviews - Create review
 * - PUT /api/reviews/:id - Update review
 * - DELETE /api/reviews/:id - Delete review
 * 
 * Matching:
 * - GET /api/match/suggestions - Get match suggestions
 * - GET /api/match/compatibility/:userId - Get compatibility score
 */

export default setupRoutes;
