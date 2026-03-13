import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { findMatches } from "../controllers/matchController.js";
import { validateRequest, validationSchemas } from "../utils/validation.js";

const router = express.Router();

// POST çünkü filtre göndereceğiz
router.post("/", authMiddleware, validateRequest(validationSchemas.findMatches), findMatches);

export default router;
