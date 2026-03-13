/**
 * Request Validation Middleware
 * Validates incoming request data
 */

export const validateRequest = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors,
    });
  }

  req.body = value;
  next();
};

/**
 * Common validators using Joi or simple validation objects
 */
export const validators = {
  email: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  username: (username) => {
    return username && username.length >= 3 && username.length <= 20;
  },

  password: (password) => {
    return password && password.length >= 6;
  },

  rating: (rating) => {
    const num = Number(rating);
    return num >= 1 && num <= 10 && Number.isInteger(num);
  },

  mongoId: (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  },
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateMongoId = (id) => {
  if (!validators.mongoId(id)) {
    throw new Error(`Invalid ID format: ${id}`);
  }
};

export default validateRequest;
