import mongoose from 'mongoose';
import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';

const { Schema } = mongoose;

const supportTicketSchema = new Schema(
  {
    ticketId: { type: String, unique: true, index: true },
    
    // Who reported
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userRole: { type: String, enum: ['driver', 'customer', 'staff'], required: true },
    
    // Optional reference to a booking
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    bookingIdStr: { type: String, index: true }, // The readable BK... ID
    
    // Complaint details
    category: {
      type: String,
      required: true,
      enum: [
        'booking-issue',
        'payment-issue',
        'delivery-delay',
        'damaged-goods',
        'driver-behavior',
        'app-issue',
        'pod-issue',
        'other'
      ],
      index: true
    },
    
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    
    // Status & Priority
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open',
      index: true
    },
    
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true
    },
    
    // Management
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Staff', index: true },
    resolvedAt: Date,
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: String,
    
    // Attachments (up to 5 optional images/docs)
    attachments: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
    
    // Thread
    replies: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        message: String,
        timestamp: { type: Date, default: Date.now },
        attachments: [{ type: Schema.Types.ObjectId, ref: 'Document' }]
      }
    ],
    
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Adds SupportTicket.paginate()
supportTicketSchema.plugin(paginationPlugin);

// Helper for human-readable ticket ID (TIC2402000001)
async function generateTicketId() {
  const coll = mongoose.connection.collection('counters');
  const result = await coll.findOneAndUpdate(
    { _id: 'support_ticket' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = result.value ? result.value.seq : 1;
  const date = new Date();
  const year = String(date.getFullYear()).substr(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seqStr = String(seq).padStart(6, '0');
  return `TIC${year}${month}${seqStr}`;
}

supportTicketSchema.pre('save', async function (next) {
  if (!this.ticketId) {
    this.ticketId = await generateTicketId();
  }
  next();
});

export default mongoose.model('SupportTicket', supportTicketSchema);
