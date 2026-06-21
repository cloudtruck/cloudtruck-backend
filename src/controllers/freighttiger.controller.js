import Booking from '../models/booking.model.js';
import Tracking from '../models/tracking.model.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

/**
 * POST /api/v1/webhooks/ft/trip-created
 * Fired by FreightTiger when a new trip is created on their side.
 * Stores the FT trip_id back on the Booking document.
 */
export async function handleTripCreated(req, res) {
  const event = req.body;

  if (!event.feed_unique_id && !event.trip_id) {
    throw new ApiError(400, 'Missing feed_unique_id or trip_id in webhook payload');
  }

  const update = {};
  if (event.trip_id)   update['ftIntegration.tripId']      = event.trip_id;
  if (event.share_url) update['ftIntegration.shareUrl']    = event.share_url;
  update['ftIntegration.syncedAt'] = new Date();

  if (event.feed_unique_id) {
    await Booking.findByIdAndUpdate(event.feed_unique_id, { $set: update });
  }

  res.json(new ApiResponse(200, null, 'Trip created webhook received'));
}

/**
 * POST /api/v1/webhooks/ft/location-updated
 * Fired by FreightTiger on every GPS ping for a trip.
 * Saves location into the Tracking collection.
 */
export async function handleLocationUpdated(req, res) {
  const event = req.body;

  const lat = event.lat ?? event.latitude;
  const lng = event.lng ?? event.longitude;

  if (!lat || !lng) {
    throw new ApiError(400, 'Missing lat/lng in location webhook payload');
  }

  if (!event.feed_unique_id && !event.trip_id) {
    throw new ApiError(400, 'Missing feed_unique_id or trip_id in location webhook');
  }

  // Resolve booking from feed_unique_id (which is our booking._id)
  let bookingId = null;
  if (event.feed_unique_id) {
    bookingId = event.feed_unique_id;
  } else {
    const booking = await Booking.findOne(
      { 'ftIntegration.tripId': event.trip_id },
      { _id: 1 }
    ).lean();
    bookingId = booking?._id?.toString();
  }

  // Update booking's lastKnownLocation
  if (bookingId) {
    await Booking.findByIdAndUpdate(bookingId, {
      $set: {
        lastKnownLocation: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        lastLocationUpdate: new Date()
      }
    });

    // Find driver linked to this booking
    const booking = await Booking.findById(bookingId, { driver: 1 }).lean();

    if (booking?.driver) {
      await Tracking.create({
        driver: booking.driver,
        booking: bookingId,
        location: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)]
        },
        source: 'device',
        meta: {
          ftTripId: event.trip_id,
          feedUniqueId: event.feed_unique_id,
          rawEvent: event
        },
        ts: event.timestamp ? new Date(event.timestamp) : new Date()
      });
    }
  }

  res.json(new ApiResponse(200, null, 'Location updated'));
}
