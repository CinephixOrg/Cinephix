/**
 * Validation utilities for request data
 * Provides regex patterns, validation functions, and middleware
 */

// Validation patterns
export const validators = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-zA-Z0-9_]{3,20}$/, // 3-20 alphanumeric/underscore
  mongoId: /^[0-9a-fA-F]{24}$/, // 24 hex characters
  password: /^(?=.{6,})/, // At least 6 characters
  url: /^(https?:\/\/)?([\da-z\-]+)\.([a-z\.]{2,6})([\/\w \-]*)*\/?$/i,
};

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  return validators.email.test(email.trim());
};

/**
 * Validate MongoDB ObjectId format
 * @param {string} id
 * @returns {boolean}
 */
export const validateMongoId = (id) => {
  if (!id || typeof id !== "string") return false;
  return validators.mongoId.test(id.trim());
};

/**
 * Validate username format
 * @param {string} username
 * @returns {boolean}
 */
export const validateUsername = (username) => {
  if (!username || typeof username !== "string") return false;
  return validators.username.test(username.trim());
};

/**
 * Validate password strength
 * @param {string} password
 * @returns {boolean} - True if password is at least 6 characters
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== "string") return false;
  return password.length >= 6;
};

/**
 * Validate rating value
 * @param {number} rating
 * @returns {boolean} - True if rating is an integer between 1-10
 */
export const validateRating = (rating) => {
  const num = parseFloat(rating);
  return Number.isInteger(num) && num >= 1 && num <= 10;
};

/**
 * Validate array of MongoDB IDs
 * @param {array} ids
 * @returns {boolean}
 */
export const validateMongoIdArray = (ids) => {
  if (!Array.isArray(ids)) return false;
  return ids.every((id) => validateMongoId(id));
};

/**
 * Validation middleware factory
 * Validates req.body, req.query, and req.params against provided schema
 * @param {object} schema - Validation schema with body, query, params keys
 * @returns {function} - Express middleware function
 */
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = {};

    // Validate body
    if (schema.body) {
      const bodyErrors = validateObject(req.body, schema.body);
      if (Object.keys(bodyErrors).length > 0) {
        Object.assign(errors, { body: bodyErrors });
      }
    }

    // Validate query
    if (schema.query) {
      const queryErrors = validateObject(req.query, schema.query);
      if (Object.keys(queryErrors).length > 0) {
        Object.assign(errors, { query: queryErrors });
      }
    }

    // Validate params
    if (schema.params) {
      const paramsErrors = validateObject(req.params, schema.params);
      if (Object.keys(paramsErrors).length > 0) {
        Object.assign(errors, { params: paramsErrors });
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    next();
  };
};

/**
 * Validates an object against a validation schema
 * @param {object} data - Data to validate
 * @param {object} schema - Validation rules
 * @returns {object} - Object with field names as keys and error messages as values
 */
const validateObject = (data, schema) => {
  const errors = {};

  Object.keys(schema).forEach((field) => {
    const rule = schema[field];
    const value = data[field];

    // Check required fields
    if (rule.required && (!value || (typeof value === "string" && !value.trim()))) {
      errors[field] = `${field} is required`;
      return;
    }

    // Skip validation if field is not provided and not required
    if (!rule.required && !value) {
      return;
    }

    // Validate based on type
    if (rule.type === "email" && value && !validateEmail(value)) {
      errors[field] = `Invalid email format for ${field}`;
    } else if (rule.type === "mongoId" && value && !validateMongoId(value)) {
      errors[field] = `Invalid MongoDB ID format for ${field}`;
    } else if (rule.type === "username" && value && !validateUsername(value)) {
      errors[field] = `Username must be 3-20 alphanumeric characters (underscores allowed)`;
    } else if (rule.type === "password" && value && !validatePassword(value)) {
      errors[field] = `Password must be at least 6 characters`;
    } else if (rule.type === "rating" && value !== undefined && !validateRating(value)) {
      errors[field] = `Rating must be an integer between 1 and 10`;
    } else if (rule.type === "number" && value && isNaN(value)) {
      errors[field] = `${field} must be a number`;
    } else if (rule.type === "string" && value && typeof value !== "string") {
      errors[field] = `${field} must be a string`;
    } else if (rule.type === "array" && value && !Array.isArray(value)) {
      errors[field] = `${field} must be an array`;
    }

    // Validate length constraints
    if (rule.minLength && value && value.length < rule.minLength) {
      errors[field] = `${field} must be at least ${rule.minLength} characters`;
    }
    if (rule.maxLength && value && value.length > rule.maxLength) {
      errors[field] = `${field} must be at most ${rule.maxLength} characters`;
    }

    // Validate min/max for numbers
    if (rule.min !== undefined && value && parseFloat(value) < rule.min) {
      errors[field] = `${field} must be at least ${rule.min}`;
    }
    if (rule.max !== undefined && value && parseFloat(value) > rule.max) {
      errors[field] = `${field} must be at most ${rule.max}`;
    }

    // Validate enum/allowed values
    if (rule.enum && value && !rule.enum.includes(value)) {
      errors[field] = `${field} must be one of: ${rule.enum.join(", ")}`;
    }

    // Run custom validator if provided
    if (rule.custom && value) {
      const customError = rule.custom(value);
      if (customError) {
        errors[field] = customError;
      }
    }
  });

  return errors;
};

/**
 * Validation schemas for common endpoints
 */
export const validationSchemas = {
  // User validation schemas
  userRegister: {
    body: {
      username: {
        required: true,
        type: "username",
      },
      email: {
        required: true,
        type: "email",
      },
      password: {
        required: true,
        type: "password",
      },
    },
  },

  userLogin: {
    body: {
      email: {
        required: true,
        type: "email",
      },
      password: {
        required: true,
      },
    },
  },

  updateUserBio: {
    body: {
      bio: {
        type: "string",
        maxLength: 500,
      },
    },
  },

  updatePassword: {
    body: {
      currentPassword: {
        required: true,
      },
      newPassword: {
        required: true,
        type: "password",
      },
    },
  },

  updateFavorites: {
    body: {
      type: {
        required: true,
        enum: ["movie", "series"],
      },
      list: {
        required: true,
        type: "array",
        custom: (value) => {
          if (!Array.isArray(value)) return "list must be an array";
          if (value.length > 5) return "Maximum 5 favorites allowed";
          for (let id of value) {
            if (!validateMongoId(id)) return `Invalid MongoDB ID in list: ${id}`;
          }
          return null;
        },
      },
    },
  },

  watchlist: {
    body: {
      id: {
        required: true,
        type: "mongoId",
      },
      type: {
        required: true,
        enum: ["movie", "series"],
      },
    },
  },

  // Rating validation schemas
  addRating: {
    body: {
      contentId: {
        required: true,
        type: "mongoId",
      },
      contentType: {
        required: true,
        enum: ["movie", "series"],
      },
      value: {
        required: true,
        type: "rating",
      },
    },
  },

  // Review validation schemas
  addReview: {
    body: {
      contentId: {
        required: true,
        type: "mongoId",
      },
      contentType: {
        required: true,
        enum: ["movie", "series"],
      },
      text: {
        required: true,
        type: "string",
        minLength: 1,
        maxLength: 5000,
      },
    },
  },

  // Query parameter schemas
  pagination: {
    query: {
      page: {
        type: "number",
        min: 1,
      },
      limit: {
        type: "number",
        min: 1,
        max: 100,
      },
    },
  },

  mongoIdParam: {
    params: {
      id: {
        required: true,
        type: "mongoId",
      },
    },
  },

  findMatches: {
    body: {
      type: {
        required: true,
        enum: ["movie", "series"],
      },
      genres: {
        type: "array",
      },
      limit: {
        type: "number",
        min: 1,
        max: 50,
      },
    },
  },

  searchUsers: {
    query: {
      query: {
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      limit: {
        type: "number",
        min: 1,
        max: 50,
      },
    },
  },

  updateUserBioWithId: {
    params: {
      id: {
        required: true,
        type: "mongoId",
      },
    },
    body: {
      bio: {
        type: "string",
        maxLength: 500,
      },
    },
  },
};
