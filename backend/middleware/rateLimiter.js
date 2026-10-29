/**
 * Simple Rate Limiting Middleware
 * Limits requests per IP address without external dependencies
 * Issue #20: Add rate limiting
 */

const requestCounts = new Map();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
// Was temporarily raised to 100000 "for testing throughput" and left that
// way — meant no real rate limiting was live at all. 600/15min (~40/min)
// is generous enough for this app's own normal usage (e.g. the unread-
// count poll alone is ~90 requests/15min) while still capping scripted
// abuse. Per-IP, so a shared IP (NAT, campus wifi) splits this across
// however many real people are behind it — a real limitation of a plain
// per-IP limiter, not fixed here, just worth knowing.
const MAX_REQUESTS = 600;

/**
 * Simple rate limiter middleware
 * Limits each IP to MAX_REQUESTS requests per 15 minutes
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
 * Strict rate limiter for auth endpoints (register/login/send-verification/
 * verify-email/forgot-password/reset-password — see userRoute.js) — these
 * share one counter per IP, so this is the real brute-force/credential-
 * stuffing defense for the whole account-security surface. Same "was
 * raised to 10000 for testing, left that way" issue as MAX_REQUESTS above
 * — meant login/reset had no real protection at all.
 */
const authRequestCounts = new Map();
const AUTH_MAX_REQUESTS = 20;

// Exported so server.js's own startup log can report the real numbers
// instead of a hardcoded string that silently goes stale (as the old
// "100 requests per 15 minutes" log did once MAX_REQUESTS was bumped).
export const RATE_LIMIT_WINDOW_MINUTES = WINDOW_MS / 60000;
export { MAX_REQUESTS, AUTH_MAX_REQUESTS };

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
