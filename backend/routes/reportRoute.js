import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { createReport } from "../controllers/moderationController.js";

const router = express.Router();

// File a report about a user or a piece of their content.
router.post("/", authMiddleware, createReport);

export default router;
