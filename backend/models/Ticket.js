import mongoose from "mongoose";
const { Schema } = mongoose;

export const TICKET_TYPES = ["Bug Report", "Feature Request", "General Support", "Other"];
export const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

// One person's support ticket: a bug, an idea, a question. Written from the
// app's Help & Feedback screen, answered by a moderator from the web
// dashboard.
//
// `adminReply` is the answer the app shows — the latest one. Every answer is
// also kept in `replies`, so a ticket answered more than once reads as the
// conversation it was rather than only its last line. `userReadAt` is when
// the person last opened the ticket, which is what makes a new answer show
// as unread in their list.
const ticketSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: TICKET_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: TICKET_STATUSES, default: "Open" },
    adminReply: { type: String, trim: true, maxlength: 4000 },
    replies: [
      {
        text: { type: String, trim: true, maxlength: 4000 },
        adminId: { type: Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    repliedAt: { type: Date },
    statusChangedAt: { type: Date },
    userReadAt: { type: Date },
  },
  { timestamps: true }
);

// Their own history, newest first.
ticketSchema.index({ userId: 1, createdAt: -1 });
// The admin queue, by status and by type.
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ type: 1, status: 1, createdAt: -1 });

const Ticket = mongoose.model("Ticket", ticketSchema);
export default Ticket;
