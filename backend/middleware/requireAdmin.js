// Admin-only routes (the moderation API). Runs after authMiddleware. The
// admin flag is read from the database-backed user on the request, never
// from the token, so revoking it takes effect within the auth cache's few
// seconds. Admins see everything, so the block filter is off for them here.
export default function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ success: false, message: "Admins only" });
  req.skipBlockFilter = true;
  next();
}
