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
    // 'pro' kept alongside 'plus' for backward compatibility with existing
    // history rows written before the pro->plus rename — this is an
    // append-only historical log (what tier the user actually was at
    // analysis time), never re-saved after creation, so old rows are left
    // as-is rather than migrated.
    enum: ['free', 'pro', 'plus', 'premium', 'dev'],
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
