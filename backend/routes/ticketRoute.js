import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { createTicket, getMyTicket, markTicketRead, myTickets } from "../controllers/ticketController.js";

// Support tickets, from the app's Help & Feedback screen. Everyone signed in
// can open one and read their own; answering them is in routes/adminRoute.js.
const router = express.Router();

router.post("/", authMiddleware, createTicket);
router.get("/me", authMiddleware, myTickets);
router.get("/:id", authMiddleware, getMyTicket);
router.patch("/:id/read", authMiddleware, markTicketRead);

export default router;
