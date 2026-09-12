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
    // IMPORT is what the unified importer writes; the two per-platform
    // values remain so historical rows still validate and stay revertible.
    enum: ['IMPORT', 'IMPORT_TVTIME', 'IMPORT_LETTERBOXD', 'RATE', 'ADD_WATCHLIST'],
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
    // Which platform an IMPORT came from. Unknown paths are stripped by
    // Mongoose's strict mode, so this has to be declared to survive.
    source: { type: String },
    addedWatchlistIds: [{ type: String }],
    addedRatingIds: [{ type: Schema.Types.ObjectId, ref: 'Rating' }],
    updatedCineGraph: { type: Boolean, default: false }
  }
}, { timestamps: true });

activityLogSchema.index({ userId: 1, createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
