import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { findMatches, getMatchWithUser } from "../controllers/matchController.js";
import { validateRequest, validationSchemas } from "../middleware/validation.js";

const router = express.Router();

// POST because we're sending filters
router.post("/", authMiddleware, validateRequest(validationSchemas.findMatches), findMatches);

// NEW: Calculate match with single user
router.post("/:targetUserId", authMiddleware, getMatchWithUser);

export default router;
