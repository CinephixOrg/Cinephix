/**
 * Helper Utilities
 * Common helper functions used across the application
 */

/**
 * Sanitize user object to exclude sensitive fields
 */
export const sanitizeUser = (user) => {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
};

/**
 * Paginate array or query results
 */
export const paginate = (items, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  return items.slice(startIndex, startIndex + limit);
};

/**
 * Extract pagination parameters from request
 */
export const getPaginationParams = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  return { page, limit };
};

/**
 * Parse sort parameters
 */
export const parseSortParams = (req) => {
  const sortBy = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  return { [sortBy]: sortOrder };
};

/**
 * Check if value is a valid MongoDB ID
 */
export const isValidMongoId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Format error response for consistency
 */
export const formatError = (message, details = null) => {
  return {
    message,
    ...(details && { details }),
  };
};

/**
 * Delay execution (for testing)
 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  sanitizeUser,
  paginate,
  getPaginationParams,
  parseSortParams,
  isValidMongoId,
  formatError,
  delay,
};
