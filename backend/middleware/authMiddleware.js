import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function authMiddleware(req, res, next) {
  try {
    // Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token not found" });

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ message: "Invalid token" });

    // Find user by ID
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Attach user to request
    req.user = user;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token verification failed" });
  }
}

// Like authMiddleware but never blocks — attaches req.user if token is valid.
// Used on routes that return extra data for authenticated users (e.g. isMember).
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id) {
        const user = await User.findById(decoded.id);
        if (user) req.user = user;
      }
    }
  } catch {
    // Invalid token — proceed without user attached
  }
  next();
};
