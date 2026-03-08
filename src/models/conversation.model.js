import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const { Schema } = mongoose;

const lastMessageSchema = new Schema(
  {
    text: { type: String, default: '' },
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: { type: lastMessageSchema, default: {} },
    unreadCounts: { type: Map, of: Number, default: {} },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

conversationSchema.index({ booking: 1, driver: 1 }, { unique: true });
conversationSchema.plugin(paginationPlugin);

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
