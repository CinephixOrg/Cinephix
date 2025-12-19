import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { findMatches } from "../controllers/matchController.js";

const router = express.Router();

// POST çünkü filtre göndereceğiz
router.post("/", authMiddleware, findMatches);

export default router;
