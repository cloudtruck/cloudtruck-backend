import axios from 'axios';
import ApiError from '../utils/ApiError.js';

// Sandbox: https://integration.freighttiger.com  (uses ?token= query param)
// Production: https://api.freighttiger.com        (uses Bearer header)
const FT_BASE_URL = process.env.FREIGHTTIGER_BASE_URL || 'https://integration.freighttiger.com';
const FT_TOKEN    = process.env.FREIGHTTIGER_API_TOKEN || '';

function ftHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${FT_TOKEN}` };
}

// Append token as query param for sandbox compatibility
function withToken(path) {
  return `${FT_BASE_URL}${path}?token=${FT_TOKEN}`;
}

/**
 * Register a trip on FreightTiger when a booking is dispatched.
 * @param {Object} booking - Populated Booking document (driver, vehicle populated)
 * @returns {Promise<{ tripId: number, feedUniqueId: string, shareUrl: string }>}
 */
export async function addTrip(booking) {
  if (!FT_TOKEN) {
    throw new ApiError(500, 'FreightTiger API token not configured');
  }

  const payload = {
    vehicleNumber: booking.vehicle?.registrationNumber || booking.vehicle?.vehicleNumber,
    locationSource: 'sim',
    driverName: booking.driver?.name,
    driverNumbers: booking.driver?.phone ? [booking.driver.phone] : [],
    lrnumber: booking.lrDetails?.lrNumber || '',
    feedUniqueId: booking._id.toString(),
    loading: {
      lat: booking.pickup.location.coordinates[1],
      lng: booking.pickup.location.coordinates[0],
      address: booking.pickup.address,
      area: booking.pickup.city,
      uniqueId: `LOAD-${booking._id.toString()}`
    },
    unloading: {
      lat: booking.drop.location.coordinates[1],
      lng: booking.drop.location.coordinates[0],
      address: booking.drop.address,
      area: booking.drop.city,
      uniqueId: `UNLOAD-${booking._id.toString()}`
    },
    customValues: {
      ewayBillNo: booking.lrDetails?.ewayBillNumber || ''
    },
    primary_attributes: {
      gate_in: booking.loadDate ? new Date(booking.loadDate).toISOString() : undefined
    }
  };

  try {
    const { data } = await axios.post(withToken('/saas/trip/add'), payload, { headers: ftHeaders(), timeout: 10000 });

    if (!data.status) {
      throw new ApiError(422, `FreightTiger AddTrip failed: ${JSON.stringify(data.message)}`);
    }

    return {
      tripId: data.result.id,
      feedUniqueId: data.result.feed_unique_id,
      shareUrl: data.result.shareUrl
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const message = err.response?.data?.message || err.message;
    throw new ApiError(502, `FreightTiger API error: ${message}`);
  }
}

/**
 * Pull trip details for one or more bookings from FreightTiger.
 * @param {Object} params
 * @param {string[]} [params.feedUniqueIds]
 * @param {string[]} [params.vehicleNumbers]
 * @param {number[]} [params.tripIds]
 * @param {'OPEN'|'CLOSED'} [params.status]
 * @returns {Promise<Array>}
 */
export async function getTrips({ feedUniqueIds = [], vehicleNumbers = [], tripIds = [], status = 'OPEN' } = {}) {
  if (!FT_TOKEN) {
    throw new ApiError(500, 'FreightTiger API token not configured');
  }

  try {
    const { data } = await axios.get(withToken('/saas/trips'), {
      headers: ftHeaders(),
      params: {
        feedunique_id: feedUniqueIds.length ? feedUniqueIds.join(',') : undefined,
        vehicle_no: vehicleNumbers.length ? vehicleNumbers.join(',') : undefined,
        trip_id: tripIds.length ? tripIds.join(',') : undefined,
        status,
        size: 100
      }
    });

    if (!data.success) {
      throw new ApiError(422, 'FreightTiger GetTrips failed');
    }

    return data.data.trips;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const message = err.response?.data?.message || err.message;
    throw new ApiError(502, `FreightTiger API error: ${message}`);
  }
}
