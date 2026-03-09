/**
 * Response Utilities
 * Standardized response formatting for API endpoints
 */

export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res, message = 'Error', statusCode = 400, errors = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};

export const sendPaginated = (res, data = [], total = 0, page = 1, limit = 10, message = 'Success') => {
  res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
};

export default {
  sendSuccess,
  sendError,
  sendPaginated,
};
