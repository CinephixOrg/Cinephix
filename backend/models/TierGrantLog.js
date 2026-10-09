import mongoose from "mongoose";
const { Schema } = mongoose;

export const TIER_GRANT_ACTIONS = ["grant", "extend", "revoke", "expire"];

// The audit trail of admin-granted tiers (services/tierGrants.js): every
// grant, extension and revocation, and every grant that ran out. Written
// once and never edited. `admin` is empty for "expire", which nobody does.
const tierGrantLogSchema = new Schema(
  {
    action: { type: String, enum: TIER_GRANT_ACTIONS, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String },
    admin: { type: Schema.Types.ObjectId, ref: "User" },
    adminUsername: { type: String },
    tier: { type: String },
    tierBefore: { type: String },
    tierAfter: { type: String },
    expiresAtBefore: { type: Date },
    expiresAtAfter: { type: Date },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

tierGrantLogSchema.index({ user: 1, createdAt: -1 });
tierGrantLogSchema.index({ createdAt: -1 });

export default mongoose.model("TierGrantLog", tierGrantLogSchema);
