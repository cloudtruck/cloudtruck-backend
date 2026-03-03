/**
 * seed-notifications.js
 * Seeds dummy notifications for a customer user.
 * Run: node --env-file .env src/scripts/seed-notifications.js
 * Run (specific customer): node --env-file .env src/scripts/seed-notifications.js --phone 919XXXXXXXXX
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/user.model.js';
import Customer from '../models/customer.model.js';
import Notification from '../models/notification.model.js';

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const phoneArgIdx = args.indexOf('--phone');
const PHONE_ARG = phoneArgIdx !== -1 ? args[phoneArgIdx + 1] : null;
const userIdArgIdx = args.indexOf('--user-id');
const USER_ID_ARG = userIdArgIdx !== -1 ? args[userIdArgIdx + 1] : null;

// ─── Connect ─────────────────────────────────────────────────────────────────
await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected to MongoDB');

// ─── Resolve target user ──────────────────────────────────────────────────────
let user;
if (USER_ID_ARG) {
  user = await User.findById(USER_ID_ARG).lean();
  if (!user) { console.error(`No user found with _id ${USER_ID_ARG}`); process.exit(1); }
} else if (PHONE_ARG) {
  user = await User.findOne({ phone: PHONE_ARG, role: 'customer' }).lean();
  if (!user) { console.error(`No customer user found with phone ${PHONE_ARG}`); process.exit(1); }
} else {
  user = await User.findOne({ role: 'customer' }).lean();
  if (!user) { console.error('No customer user found in DB'); process.exit(1); }
}
console.log(`Seeding notifications for user: ${user.phone} (${user._id})`);

// ─── Dummy notifications ──────────────────────────────────────────────────────
const now = new Date();
const mins = (n) => new Date(now - n * 60 * 1000);

const notifications = [
  {
    user: user._id,
    type: 'in-app',
    channel: 'internal',
    title: 'Booking Confirmed',
    body: 'Your booking #BK-2024-001 has been confirmed. Truck will be dispatched shortly.',
    category: 'truck',
    status: 'delivered',
    priority: 'high',
    sentAt: mins(120),
    deliveredAt: mins(119),
    data: { bookingId: 'BK-2024-001', screen: 'BookingDetail' },
    actions: [{ label: 'View Booking', action: 'view_booking' }]
  },
  {
    user: user._id,
    type: 'in-app',
    channel: 'internal',
    title: 'Loading Started',
    body: 'Loading of your goods has started at the origin warehouse.',
    category: 'loading',
    status: 'delivered',
    priority: 'normal',
    sentAt: mins(90),
    deliveredAt: mins(89),
    data: { bookingId: 'BK-2024-001', screen: 'TrackBooking' }
  },
  {
    user: user._id,
    type: 'in-app',
    channel: 'internal',
    title: 'In Transit',
    body: 'Your shipment is on the way. Current location: NH-48, Pune.',
    category: 'truck',
    status: 'delivered',
    priority: 'normal',
    sentAt: mins(60),
    deliveredAt: mins(59),
    data: { bookingId: 'BK-2024-001', screen: 'TrackBooking' }
  },
  {
    user: user._id,
    type: 'in-app',
    channel: 'internal',
    title: 'Out for Delivery',
    body: 'Your truck is nearby and will reach the destination within 2 hours.',
    category: 'delivery',
    status: 'delivered',
    priority: 'high',
    sentAt: mins(30),
    deliveredAt: mins(29),
    data: { bookingId: 'BK-2024-001', screen: 'TrackBooking' }
  },
  {
    user: user._id,
    type: 'in-app',
    channel: 'internal',
    title: 'Delivery Completed',
    body: 'Your shipment has been delivered. Please check and confirm receipt.',
    category: 'delivery',
    status: 'delivered',
    priority: 'high',
    sentAt: mins(15),
    deliveredAt: mins(14),
    data: { bookingId: 'BK-2024-001', screen: 'BookingDetail' },
    actions: [{ label: 'View POD', action: 'view_pod' }]
  },
  {
    user: user._id,
    type: 'in-app',
    channel: 'internal',
    title: 'POD Uploaded',
    body: 'Proof of Delivery has been uploaded for booking #BK-2024-001.',
    category: 'pod',
    status: 'delivered',
    priority: 'normal',
    sentAt: mins(10),
    deliveredAt: mins(9),
    data: { bookingId: 'BK-2024-001', screen: 'PODDetail' }
  },
  {
    user: user._id,
    type: 'in-app',
    channel: 'internal',
    title: 'Payment Due',
    body: 'Payment of ₹18,500 is pending for booking #BK-2024-001. Please clear dues.',
    category: 'payment',
    status: 'delivered',
    priority: 'urgent',
    sentAt: mins(5),
    deliveredAt: mins(4),
    data: { bookingId: 'BK-2024-001', screen: 'Payment' },
    actions: [{ label: 'Pay Now', action: 'pay_now' }]
  },
  {
    user: user._id,
    type: 'in-app',
    channel: 'internal',
    title: 'Payment Received',
    body: 'We have received your payment of ₹18,500. Thank you!',
    category: 'payment',
    status: 'delivered',
    priority: 'normal',
    readAt: mins(2),
    sentAt: mins(3),
    deliveredAt: mins(3),
    data: { bookingId: 'BK-2024-001', screen: 'Payment' }
  },
  {
    user: user._id,
    type: 'in-app',
    channel: 'internal',
    title: 'LR Document Ready',
    body: 'Your Lorry Receipt for booking #BK-2024-002 is now available for download.',
    category: 'loading',
    status: 'delivered',
    priority: 'normal',
    sentAt: mins(2),
    deliveredAt: mins(2),
    data: { bookingId: 'BK-2024-002', screen: 'LRDetail' }
  },
  {
    user: user._id,
    type: 'in-app',
    channel: 'internal',
    title: 'Welcome to CloudTruck',
    body: 'Your account is ready. Start booking trucks for your logistics needs.',
    category: 'general',
    status: 'delivered',
    priority: 'low',
    readAt: mins(500),
    sentAt: mins(600),
    deliveredAt: mins(599),
    data: { screen: 'Home' }
  }
];

// ─── Insert ───────────────────────────────────────────────────────────────────
await Notification.deleteMany({ user: user._id });
console.log('Cleared existing notifications for user');

const inserted = await Notification.insertMany(notifications);
console.log(`Inserted ${inserted.length} notifications`);

const unread = inserted.filter(n => !n.readAt).length;
console.log(`  ${unread} unread, ${inserted.length - unread} already read`);

await mongoose.disconnect();
console.log('Done.');
