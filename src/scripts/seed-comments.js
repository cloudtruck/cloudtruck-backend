/**
 * seed-comments.js
 * Seeds realistic audit log entries + manual notes on all existing bookings.
 *
 * Run:   node --env-file .env src/scripts/seed-comments.js
 * Clean: node --env-file .env src/scripts/seed-comments.js --clean
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Booking from '../models/booking.model.js';
import AuditLog from '../models/auditLog.model.js';
import User from '../models/user.model.js';

const CLEAN_MODE = process.argv.includes('--clean');
const SEED_TAG = 'SEED_COMMENTS';

// ─── Status → human-readable descriptions ────────────────────────────────────
const STATUS_COMMENTS = {
  'created':              { action: 'CREATE_BOOKING',         description: 'New trip created' },
  'under-review':         { action: 'UPDATE_BOOKING_STATUS',  description: 'Trip moved to under review' },
  'confirmed':            { action: 'UPDATE_BOOKING_STATUS',  description: 'Trip confirmed by traffic manager' },
  'assigned':             { action: 'ASSIGN_DRIVER',          description: 'Driver assigned to trip' },
  'reported-at-source':   { action: 'UPDATE_BOOKING_STATUS',  description: 'Reported at source' },
  'loading':              { action: 'UPDATE_BOOKING_STATUS',  description: 'Loading started at source' },
  'in-transit':           { action: 'UPDATE_BOOKING_STATUS',  description: 'Vehicle departed, in transit' },
  'reached-destination':  { action: 'UPDATE_BOOKING_STATUS',  description: 'Vehicle reached destination' },
  'unloading':            { action: 'UPDATE_BOOKING_STATUS',  description: 'Unloading in progress' },
  'delivered':            { action: 'UPDATE_BOOKING_STATUS',  description: 'Goods delivered successfully' },
  'pod-received':         { action: 'UPDATE_BOOKING_STATUS',  description: 'POD received and verified' },
  'cancelled':            { action: 'CANCEL_BOOKING',         description: 'Trip cancelled by admin' },
};

const EXTRA_NOTES = [
  'Vehicle inspection completed before departure',
  'Customer confirmed delivery window',
  'Driver contacted — ETA on schedule',
  'Advance payment released to driver',
  'Route updated due to highway closure',
  'Weight verified at loading point',
  'E-way bill generated and attached',
  'GPS tracker installed and active',
  'Customer requested expedited delivery',
  'Loading completed ahead of schedule',
];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000);
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  if (CLEAN_MODE) {
    const deleted = await AuditLog.deleteMany({ 'context.tags': SEED_TAG });
    console.log(`Cleaned ${deleted.deletedCount} seeded audit logs`);
    await mongoose.disconnect();
    return;
  }

  // Find a staff/admin user to attribute logs to
  const adminUser = await User.findOne({ role: { $in: ['super-admin', 'internal', 'staff'] } });
  if (!adminUser) {
    console.error('No admin/staff user found — run seed:org first');
    await mongoose.disconnect();
    return;
  }

  const bookings = await Booking.find({}).lean();
  console.log(`Found ${bookings.length} bookings`);

  let totalLogs = 0;

  for (const booking of bookings) {
    const logs = [];
    const statusHistory = booking.statusHistory || [];

    // 1. Generate one audit log per status history entry
    let baseTime = new Date(booking.createdAt || Date.now()).getTime();
    for (let i = 0; i < statusHistory.length; i++) {
      const entry = statusHistory[i];
      const statusKey = entry.status;
      const template = STATUS_COMMENTS[statusKey] || {
        action: 'UPDATE_BOOKING_STATUS',
        description: `Status updated to ${statusKey}`,
      };

      logs.push({
        user: entry.updatedBy || adminUser._id,
        action: template.action,
        entityType: 'booking',
        entityId: booking._id,
        context: {
          module: 'booking-management',
          description: template.description,
          severity: 'low',
          tags: [SEED_TAG],
        },
        status: 'success',
        timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(baseTime + i * 600000),
      });
    }

    // 2. Add 1–3 random manual notes
    const noteCount = randomBetween(1, 3);
    const shuffled = [...EXTRA_NOTES].sort(() => Math.random() - 0.5).slice(0, noteCount);
    const baseHoursAgo = randomBetween(2, 48);

    for (let j = 0; j < shuffled.length; j++) {
      logs.push({
        user: adminUser._id,
        action: 'ADD_BOOKING_NOTE',
        entityType: 'booking',
        entityId: booking._id,
        context: {
          module: 'booking-management',
          description: shuffled[j],
          severity: 'low',
          tags: [SEED_TAG],
        },
        status: 'success',
        timestamp: hoursAgo(baseHoursAgo - j * 2),
      });
    }

    if (logs.length > 0) {
      await AuditLog.insertMany(logs);
      totalLogs += logs.length;
    }
  }

  console.log(`Seeded ${totalLogs} audit log entries across ${bookings.length} bookings`);
  await mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
