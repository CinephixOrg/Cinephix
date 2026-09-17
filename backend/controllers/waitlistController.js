import WaitlistSignup from "../models/WaitlistSignup.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/waitlist — the marketing landing page's own "notify me at
// launch" form. Public, unauthenticated (a landing-page visitor has no
// account) — protected from abuse by the same global /api/ rate limiter
// every other route already sits behind.
export const joinWaitlist = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return sendError(res, "Please enter a valid email address.", 400);
  }

  const existing = await WaitlistSignup.findOne({ email }).select("_id").lean();
  if (existing) {
    // Not an error — a repeat signup should read as "you're already in,"
    // not fail the form the visitor just filled out correctly. `alreadyJoined`
    // lets the form show a distinct "you're already on the list" message.
    return sendSuccess(res, { alreadyJoined: true }, "Already on the waitlist");
  }

  await WaitlistSignup.create({ email });
  sendSuccess(res, { alreadyJoined: false }, "Joined waitlist", 201);
});
