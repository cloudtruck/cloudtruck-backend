import mongoose from 'mongoose';

const agentContactSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, trim: true },
    // Stored as +91XXXXXXXXXX so the customer app can use it directly in a tel: link
    phone: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// One contact per state, regardless of letter case
agentContactSchema.index(
  { state: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

export default mongoose.model('AgentContact', agentContactSchema);
