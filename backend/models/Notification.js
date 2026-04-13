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
    // Bildirim tipi (gelecekte 'like', 'comment' gibi tipler de ekleyebilirsiniz)
    type: {
        type: String,
        enum: ['follow'], // Currently only 'follow'
        required: true
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