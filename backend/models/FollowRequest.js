import mongoose from 'mongoose';

const { Schema } = mongoose;

const followRequestSchema = new Schema({
  requesterId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

// Compound index to prevent duplicate requests
followRequestSchema.index({ requesterId: 1, targetId: 1 }, { unique: true });

const FollowRequest = mongoose.model('FollowRequest', followRequestSchema);

export default FollowRequest;
