// models/WaitlistSignup.js
import mongoose from "mongoose";

// The marketing landing page's own email capture (frontend/, "Coming Soon"
// section) — collected before the app has real App Store/Google Play
// listings, purely so there's a real list to notify at launch. Deliberately
// its own tiny model rather than folding onto User: a waitlist signup has
// no account, no password, nothing else in common with a real User doc.
const waitlistSignupSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("WaitlistSignup", waitlistSignupSchema);
