/**
 * Request Validation Middleware
 * Validates incoming request data without requiring external schema validators
 */

/**
 * Simple schema validation without Joi dependency
 * @param {Object} schema - Validation rules object
 * @returns {Function} Express middleware
 */
export const validateRequest = (schema) => (req, res, next) => {
  const errors = [];

  // Validate each field in schema
  for (const [field, rules] of Object.entries(schema)) {
    const value = req.body[field];
    const fieldErrors = validateField(field, value, rules);
    errors.push(...fieldErrors);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors,
    });
  }

  next();
};

/**
 * Validate a single field against rules
 * @param {string} field - Field name
 * @param {any} value - Field value
 * @param {Object|string} rules - Validation rules
 * @returns {Array} Array of error objects
 */
function validateField(field, value, rules) {
  const errors = [];

  if (typeof rules === 'string') {
    rules = parseRuleString(rules);
  }

  // Required check
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push({ field, message: `${field} is required` });
    return errors;
  }

  // If not required and empty, skip other validations
  if (!rules.required && (value === undefined || value === null || value === '')) {
    return errors;
  }

  // Type validation
  if (rules.type) {
    if (!validateType(value, rules.type)) {
      errors.push({ field, message: `${field} must be of type ${rules.type}` });
      return errors;
    }
  }

  // Email validation
  if (rules.email && !validateEmail(value)) {
    errors.push({ field, message: `${field} must be a valid email` });
  }

  // Min length
  if (rules.minLength && value.length < rules.minLength) {
    errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
  }

  // Max length
  if (rules.maxLength && value.length > rules.maxLength) {
    errors.push({ field, message: `${field} must not exceed ${rules.maxLength} characters` });
  }

  // Min value (for numbers)
  if (rules.min !== undefined && Number(value) < rules.min) {
    errors.push({ field, message: `${field} must be at least ${rules.min}` });
  }

  // Max value (for numbers)
  if (rules.max !== undefined && Number(value) > rules.max) {
    errors.push({ field, message: `${field} must not exceed ${rules.max}` });
  }

  // Enum validation
  if (rules.enum && !rules.enum.includes(value)) {
    errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
  }

  // Regex validation
  if (rules.regex && !rules.regex.test(value)) {
    errors.push({ field, message: `${field} has invalid format` });
  }

  // MongoDB ID validation
  if (rules.mongoId && !validateMongoId(value)) {
    errors.push({ field, message: `${field} must be a valid ID` });
  }

  // Array validation
  if (rules.isArray && !Array.isArray(value)) {
    errors.push({ field, message: `${field} must be an array` });
  }

  return errors;
}

/**
 * Parse simple rule string format (e.g., "required|email|minLength:6")
 */
function parseRuleString(rulesString) {
  const rules = {};
  const parts = rulesString.split('|');

  for (const part of parts) {
    if (part.includes(':')) {
      const [key, value] = part.split(':');
      if (key === 'minLength' || key === 'maxLength' || key === 'min' || key === 'max') {
        rules[key] = Number(value);
      } else if (key === 'enum') {
        rules[key] = value.split(',');
      }
    } else {
      if (part === 'required') rules.required = true;
      if (part === 'email') rules.email = true;
      if (part === 'mongoId') rules.mongoId = true;
      if (part === 'isArray') rules.isArray = true;
    }
  }

  return rules;
}

/**
 * Type validation helper
 */
function validateType(value, type) {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' || !isNaN(Number(value));
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
  return true;
}

/**
 * Common validators
 */
export const validators = {
  email: (email) => validateEmail(email),
  username: (username) => username && username.length >= 3 && username.length <= 20,
  password: (password) => password && password.length >= 6,
  rating: (rating) => {
    const num = Number(rating);
    return num >= 1 && num <= 10 && Number.isInteger(num);
  },
  mongoId: (id) => validateMongoId(id),
};

/**
 * Email validation helper
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * MongoDB ID validation helper
 */
export const validateMongoId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Validation schemas for common use cases
 */
export const validationSchemas = {
  // User Authentication
  registerUser: {
    username: { required: true, type: 'string', minLength: 3, maxLength: 20 },
    email: { required: true, type: 'string', email: true },
    password: { required: true, type: 'string', minLength: 6 },
    bio: { type: 'string', maxLength: 500 },
  },

  loginUser: {
    email: { required: true, type: 'string', email: true },
    password: { required: true, type: 'string' },
  },

  updateProfile: {
    username: { type: 'string', minLength: 3, maxLength: 20 },
    bio: { type: 'string', maxLength: 500 },
    favoriteGenres: { type: 'array' },
  },

  // Ratings
  createRating: {
    contentId: { required: true },
    contentType: { required: true, enum: ['movie', 'series'] },
    value: { required: true, type: 'number', min: 1, max: 10 },
  },

  addRating: {
    contentId: { required: true },
    contentType: { required: true, enum: ['movie', 'series'] },
    value: { required: true, type: 'number', min: 1, max: 10 },
  },

  // Reviews
  createReview: {
    contentId: { required: true },
    contentType: { required: true, enum: ['movie', 'series'] },
    text: { required: true, type: 'string', minLength: 1, maxLength: 2000 },
  },

  // Watchlist
  addToWatchlist: {
    id: { required: true },
    type: { required: true, enum: ['movie', 'series'] },
  },

  // MongoDB ID validation (for route params)
  mongoIdParam: {
    id: { required: true, mongoId: true },
  },

  // User follow/unfollow
  followUser: {
    id: { required: true, mongoId: true },
  },

  // Search users
  searchUsers: {
    q: { required: true, type: 'string', minLength: 1 },
  },

  // Update favorites
  updateFavorites: {
    type: { required: true, enum: ['movie', 'series'] },
    list: { required: true, isArray: true },
  },

  // Update user bio with ID
  updateUserBioWithId: {
    id: { required: true, mongoId: true },
    bio: { required: true, type: 'string', maxLength: 500 },
  },

  // FindMatches
  findMatches: {
    genres: { type: 'array' },
  },

  swipeMatch: {
    targetUserId: { required: true, type: 'string' },
    decision: { required: true, enum: ['accept', 'reject'] },
  },

  // Update password
  updatePassword: {
    oldPassword: { required: true, type: 'string' },
    newPassword: { required: true, type: 'string', minLength: 6 },
  },

  // Send message
  sendMessage: {
    recipientId: { required: true, type: 'string' },
    message: { required: true, type: 'string', minLength: 1, maxLength: 5000 },
  },
};

export default validateRequest;
