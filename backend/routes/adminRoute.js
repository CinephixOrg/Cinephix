import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/requireAdmin.js";
import {
  adminUserReviews,
  adminUserSummary,
  decideReport,
  deleteContent,
  listReports,
  reportStats,
  setSuspension,
} from "../controllers/moderationController.js";
import { listTickets, ticketStats, updateTicket } from "../controllers/ticketController.js";
import {
  getUserCineGraph,
  getUserCollectionEntries,
  getUserCollections,
  getUserFavorites,
  getUserProfile,
  getUserRatings,
} from "../controllers/userController.js";
import { getUserShares } from "../controllers/shareController.js";
import {
  extendTierGrant,
  grantTier,
  listActiveGrants,
  listGrantLog,
  revokeTierGrant,
  searchGrantUsers,
} from "../controllers/tierGrantController.js";

// The moderation API behind the admin dashboard. Every route: signed in, and an admin.
const router = express.Router();
router.use(authMiddleware, requireAdmin);

router.get("/reports", listReports);
router.get("/reports/stats", reportStats);
router.patch("/reports/:id", decideReport);

// Support tickets: the queue, and answering one.
router.get("/tickets", listTickets);
router.get("/tickets/stats", ticketStats);
router.patch("/tickets/:id", updateTicket);
router.get("/users/:id", adminUserSummary);

// Taking content down, and suspending an account. Both are permanent enough
// that the dashboard asks twice before calling them.
router.delete("/content/:type/:id", deleteContent);
router.patch("/users/:id/suspension", setSuspension);

// Time-limited Plus/Premium (the dashboard's "Premium grants" tab): finding
// people, granting, extending and revoking, the running grants, and the
// audit log of every change.
router.get("/tier-grants", listActiveGrants);
router.get("/tier-grants/users", searchGrantUsers);
router.get("/tier-grants/log", listGrantLog);
router.post("/users/:id/tier-grant", grantTier);
router.patch("/users/:id/tier-grant", extendTierGrant);
router.delete("/users/:id/tier-grant", revokeTierGrant);

// The same endpoints the mobile public profile is built from, read here as
// a moderator: requireAdmin has already turned the block filter off, so a
// moderator investigating someone they blocked still sees everything, and
// the lists include the private ones (showPrivate below).
const showPrivate = (req, _res, next) => {
  req.showPrivate = true;
  next();
};
router.get("/users/:id/profile", showPrivate, getUserProfile);
router.get("/users/:id/cinegraph", getUserCineGraph);
router.get("/users/:id/favorites", getUserFavorites);
router.get("/users/:id/collections", showPrivate, getUserCollections);
router.get("/users/:id/collections/:kind", getUserCollectionEntries);
router.get("/users/:id/ratings", getUserRatings);
router.get("/users/:id/reviews", adminUserReviews);
// getUserShares reads :userId, not :id.
router.get("/users/:userId/shares", getUserShares);

export default router;
