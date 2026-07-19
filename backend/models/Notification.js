// models/Notification.js (NEW FILE - ES6 Module Format)
import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificationSchema = new Schema({
    // User who receives notification
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // User who triggered the action (e.g., person following you)
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Bildirim tipi: follow, message, follow_request, follow_accepted
    type: {
        type: String,
        enum: ['follow', 'message', 'follow_request', 'follow_accepted'],
        required: true
    },
    // Mesaj bildiriminde konuşma ID'si
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        default: null
    },
    // Bildirim okundu mu?
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true }); // To know when the notification arrived

// ===== DATABASE INDEXES (Issue #13) =====
// Fast lookups for user's notifications
notificationSchema.index({ user: 1 });

// Fast lookups for unread notifications
notificationSchema.index({ user: 1, read: 1 });

// Fast lookups by sender
notificationSchema.index({ sender: 1 });

// Compound index for sorting notifications by creation time
notificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;