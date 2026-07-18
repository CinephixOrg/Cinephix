import mongoose from 'mongoose';
const { Schema } = mongoose;

const activityLogSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actionType: {
    type: String,
    enum: ['IMPORT_TVTIME', 'IMPORT_LETTERBOXD', 'RATE', 'ADD_WATCHLIST'],
    required: true
  },
  details: {
    type: String
  },
  isReverted: {
    type: Boolean,
    default: false
  },
  payload: {
    addedWatchlistIds: [{ type: String }],
    addedRatingIds: [{ type: Schema.Types.ObjectId, ref: 'Rating' }],
    updatedCineGraph: { type: Boolean, default: false }
  }
}, { timestamps: true });

activityLogSchema.index({ userId: 1, createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
