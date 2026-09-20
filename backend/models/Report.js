import mongoose from "mongoose";
const { Schema } = mongoose;

export const REPORT_ENTITY_TYPES = ["User", "List", "Review", "Comment", "Share", "Message"];
export const REPORT_REASONS = ["spam", "harassment", "inappropriate", "spoiler", "impersonation", "other"];
export const REPORT_STATUSES = ["pending", "resolved", "dismissed"];

// One user's report about one piece of user-generated content, or a user.
// Polymorphic: `reportedEntityId` points into whichever collection
// `entityType` names. `reportedUserId` — whoever made the reported thing —
// is resolved when the report is filed, so moderators can see everyone
// reported about a person without joining six collections.
const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportedEntityId: { type: Schema.Types.ObjectId, required: true },
    entityType: { type: String, enum: REPORT_ENTITY_TYPES, required: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    description: { type: String, trim: true, maxlength: 1000 },
    // What was reported, as it was then — content can be edited or deleted
    // after the fact, and moderators need to see what the reporter saw.
    snapshot: { type: Schema.Types.Mixed },
    status: { type: String, enum: REPORT_STATUSES, default: "pending" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    resolutionNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

// The moderation queue: newest first, by status and type.
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ entityType: 1, status: 1, createdAt: -1 });
reportSchema.index({ reportedUserId: 1, createdAt: -1 });
// One open report per person per thing: reporting it again while it's
// still pending is a no-op, not a second queue entry.
reportSchema.index(
  { reporterId: 1, entityType: 1, reportedEntityId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

const Report = mongoose.model("Report", reportSchema);
export default Report;
