// models/Notification.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

// An in-app notification. Created only through services/notifications.js.
//
// Data specific to one type lives in that type's own subdocument, so every
// notification carries what it needs to be shown — and later sent as a push
// notification — on its own.
const notificationSchema = new Schema({
    // Who receives it
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Who acted. For share_like, whoever liked the share most recently.
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['follow', 'message', 'share_like'],
        required: true
    },
    // type "message": the conversation. Top-level rather than inside `message`
    // because per-conversation unread counts and the web client read it here.
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        default: null
    },
    // type "message"
    message: {
        messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
        // The start of the message text (utils/notificationPayload.js).
        preview: { type: String, maxlength: 200 },
        // The message's own type: text, recommendation, analysis_share, profile_share.
        kind: { type: String }
    },
    // type "share_like": one notification per share, however many people like it.
    share: {
        shareId: { type: Schema.Types.ObjectId, ref: 'Share' },
        shareType: { type: String },
        // How many people like the share, not counting its author.
        likerCount: { type: Number }
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// ===== DATABASE INDEXES (Issue #13) =====
// Fast lookups for user's notifications
notificationSchema.index({ user: 1 });

// Fast lookups for unread notifications
notificationSchema.index({ user: 1, read: 1 });

// Fast lookups by sender
notificationSchema.index({ sender: 1 });

// Compound index for sorting notifications by creation time
notificationSchema.index({ user: 1, createdAt: -1 });

// The app pages newest-first by _id ("everything before this id"), with and
// without the unread filter (utils/notificationFeed.js).
notificationSchema.index({ user: 1, _id: -1 });
notificationSchema.index({ user: 1, read: 1, _id: -1 });

// At most one "liked your share" notification per share.
notificationSchema.index(
    { user: 1, 'share.shareId': 1 },
    { unique: true, partialFilterExpression: { type: 'share_like' } }
);

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
