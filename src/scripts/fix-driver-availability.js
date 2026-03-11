/**
 * fix-driver-availability.js
 *
 * One-time script to reset drivers whose availability is stuck at 'on-trip'
 * but whose current/next booking is in a terminal state (delivered, pod-received, closed, cancelled).
 *
 * Run: node src/scripts/fix-driver-availability.js
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

import Driver from '../models/driver.model.js';
import Booking from '../models/booking.model.js';

const TERMINAL_STATUSES = ['delivered', 'pod-received', 'closed', 'cancelled'];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const stuckDrivers = await Driver.find({ availability: 'on-trip' });
  console.log(`Found ${stuckDrivers.length} driver(s) marked on-trip`);

  let fixed = 0;

  for (const driver of stuckDrivers) {
    // Check if their currentBooking is actually terminal
    let isActuallyFree = true;

    if (driver.currentBooking) {
      const booking = await Booking.findById(driver.currentBooking).select('status');
      if (booking && !TERMINAL_STATUSES.includes(booking.status)) {
        isActuallyFree = false;
      }
    }

    if (isActuallyFree) {
      driver.availability = 'available';
      driver.currentBooking = null;
      driver.nextBooking = null;
      await driver.save();
      console.log(`  Fixed driver: ${driver.name} (${driver._id})`);
      fixed++;
    } else {
      console.log(`  Skipped driver: ${driver.name} — booking still active`);
    }
  }

  console.log(`\nDone. Fixed ${fixed} driver(s).`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
