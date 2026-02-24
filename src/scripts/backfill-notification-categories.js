/**
 * Backfill notification categories
 * Sets the 'category' field on existing notifications based on their data.event type
 * Run: node src/scripts/backfill-notification-categories.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Notification from '../models/notification.model.js';

dotenv.config();

const deriveCategory = (eventType, data = {}) => {
  if (['driver_assigned', 'vehicle_assigned', 'booking_assigned', 'booking_truck-assigned'].includes(eventType)) {
    return 'truck';
  }
  if (eventType === 'booking_loaded') {
    return 'loading';
  }
  if (['booking_in-transit', 'booking_delivered', 'booking_reached-destination',
       'booking_driver-en-route', 'booking_reached-pickup',
       'booking_delayed', 'delay_notification',
       'driver_available_for_return', 'next_booking_active'].includes(eventType)) {
    return 'delivery';
  }
  if (['booking_pod-received', 'pod_uploaded'].includes(eventType)) {
    return 'pod';
  }
  if (['payment_success', 'payment_received', 'payment_failed'].includes(eventType)) {
    return 'payment';
  }
  if (eventType === 'status_update') {
    const status = data.status;
    if (status === 'loaded') return 'loading';
    if (status === 'pod-received') return 'pod';
    if (['in-transit', 'delivered', 'reached-destination', 'driver-en-route', 'reached-pickup'].includes(status)) return 'delivery';
  }
  return 'general';
};

const backfill = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find all notifications without a category (or with null)
    const notifications = await Notification.find({
      $or: [{ category: null }, { category: { $exists: false } }]
    }).select('data');

    console.log(`Found ${notifications.length} notifications to backfill`);

    let updated = 0;
    const bulkOps = notifications.map((notif) => {
      const eventType = notif.data?.event || notif.data?.type || '';
      const category = deriveCategory(eventType, notif.data || {});

      return {
        updateOne: {
          filter: { _id: notif._id },
          update: { $set: { category } }
        }
      };
    });

    if (bulkOps.length > 0) {
      const result = await Notification.bulkWrite(bulkOps);
      updated = result.modifiedCount;
    }

    console.log(`Backfilled ${updated} notifications with categories`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error backfilling notification categories:', err);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
  }
};

backfill();
