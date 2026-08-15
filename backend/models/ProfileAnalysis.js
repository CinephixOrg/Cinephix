import mongoose from 'mongoose';

const { Schema } = mongoose;

const profileAnalysisSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tier: {
    type: String,
    enum: ['free', 'pro', 'premium', 'dev'],
    required: true
  },
  schemaVersion: {
    type: Number,
    default: 1
  },
  payload: Schema.Types.Mixed,
  result: Schema.Types.Mixed,
  provider: {
    type: String,
    enum: ['gemini', 'mock']
  }
}, { timestamps: true });

profileAnalysisSchema.index({ user: 1, createdAt: -1 });

const ProfileAnalysis = mongoose.model('ProfileAnalysis', profileAnalysisSchema);

export default ProfileAnalysis;
