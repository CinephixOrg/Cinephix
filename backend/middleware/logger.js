/**
 * Logger Middleware
 * Logs incoming requests and outgoing responses
 */

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();

    console.log(
      `[${timestamp}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`
    );

    // Log request body for POST/PUT requests (exclude sensitive data)
    if (['POST', 'PUT'].includes(req.method) && req.body) {
      const safebody = { ...req.body };
      if (safebody.password) safebody.password = '***';
      if (safebody.token) safebody.token = '***';
      console.log('Request body:', JSON.stringify(safebody, null, 2));
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Console Logger
 * Simple logging utility
 */
export const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()}: ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()}: ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()}: ${msg}`),
  debug: (msg) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()}: ${msg}`);
    }
  },
};

export default requestLogger;
