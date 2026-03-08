import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const { Schema } = mongoose;

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    name: { type: String },
    type: { type: String },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderRole: {
      type: String,
      enum: ['driver', 'staff', 'super-admin', 'internal'],
      required: true,
    },
    text: {
      type: String,
      trim: true,
    },
    attachments: { type: [attachmentSchema], default: [] },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.plugin(paginationPlugin);

const Message = mongoose.model('Message', messageSchema);
export default Message;
