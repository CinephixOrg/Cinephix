/**
 * Simple Rate Limiting Middleware
 * Limits requests per IP address without external dependencies
 * Issue #20: Add rate limiting
 */

const requestCounts = new Map();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100000; // Temporarily raised significantly for testing throughput

/**
 * Simple rate limiter middleware
 * Limits each IP to 100 requests per 15 minutes
 */
export const simpleRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip);

  // Remove old timestamps outside the window
  const validTimestamps = timestamps.filter(time => now - time < WINDOW_MS);
  requestCounts.set(ip, validTimestamps);

  // Check if limit exceeded
  if (validTimestamps.length >= MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((validTimestamps[0] + WINDOW_MS - now) / 1000)
    });
  }

  // Add current request
  validTimestamps.push(now);

  // Set rate limit headers
  res.set('X-RateLimit-Limit', MAX_REQUESTS);
  res.set('X-RateLimit-Remaining', MAX_REQUESTS - validTimestamps.length);
  res.set('X-RateLimit-Reset', new Date(now + WINDOW_MS).toISOString());

  next();
};

/**
 * Cleanup old entries periodically to prevent memory leak
 * Run cleanup every hour
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestCounts.entries()) {
    const validTimestamps = timestamps.filter(time => now - time < WINDOW_MS);
    if (validTimestamps.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, validTimestamps);
    }
  }
}, 60 * 60 * 1000); // Every hour

/**
 * Strict rate limiter for auth endpoints (login/register)
 * Limits each IP to 10 requests per 15 minutes — brute-force protection
 */
const authRequestCounts = new Map();
const AUTH_MAX_REQUESTS = 10000; // Temporarily raised significantly for testing throughput

export const authRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!authRequestCounts.has(ip)) {
    authRequestCounts.set(ip, []);
  }

  const timestamps = authRequestCounts.get(ip);
  const validTimestamps = timestamps.filter(time => now - time < WINDOW_MS);
  authRequestCounts.set(ip, validTimestamps);

  if (validTimestamps.length >= AUTH_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil((validTimestamps[0] + WINDOW_MS - now) / 1000)
    });
  }

  validTimestamps.push(now);
  next();
};

export default simpleRateLimiter;
