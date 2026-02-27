import Tracking from '../models/tracking.model.js';
import Booking from '../models/booking.model.js';
import Driver from '../models/driver.model.js';
import LocationService from './location.service.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import NotificationService from './notification.service.js';
import Customer from '../models/customer.model.js';

class TrackingService {
  /**
   * Record GPS location
   * @param {String} bookingId - Booking ID
   * @param {String} driverId - Driver ID
   * @param {Object} location - Location data
   * @returns {Promise<Tracking>}
   */
  static async recordLocation(bookingId, driverId, location) {
    const { latitude, longitude, accuracy, speed, heading } = location;

    // Reject low-accuracy pings — prevents noisy/inaccurate points from polluting route history
    const MAX_ACCURACY_METERS = 100;
    if (accuracy !== undefined && accuracy > MAX_ACCURACY_METERS) {
      throw new ApiError(422, `GPS accuracy too low (${accuracy}m). Minimum required: ${MAX_ACCURACY_METERS}m or better.`);
    }

    // Validate booking
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    if (!['driver-en-route', 'reached-pickup', 'loaded', 'in-transit', 'reached-destination'].includes(booking.status)) {
      throw new ApiError(400, 'Tracking not available for current booking status');
    }

    // Create tracking record
    const tracking = await Tracking.create({
      booking: bookingId,
      driver: driverId,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      accuracy,
      speed: speed || 0,
      heading: heading || 0,
      battery: location.battery,
      networkType: location.networkType,
      ts: new Date()
    });

    // Update driver's last known location and timestamp
    await Driver.findByIdAndUpdate(driverId, {
      lastKnownLocation: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      lastLocationAt: new Date(),
      updatedAt: new Date()
    });

    // Update booking's last known location
    booking.lastKnownLocation = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };
    booking.lastLocationUpdate = new Date();
    await booking.save();

    // Feature 3: Check Geofence Alerts
    await TrackingService._checkGeofence(booking, driverId, latitude, longitude);

    logger.debug('Location recorded:', { bookingId, driverId, latitude, longitude });
    return tracking;
  }

  /**
   * Get tracking history for booking
   * @param {String} bookingId - Booking ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>}
   */
  static async getTrackingHistory(bookingId, filters = {}) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    const query = { booking: bookingId };

    if (filters.fromTime) {
      query.timestamp = { $gte: new Date(filters.fromTime) };
    }

    if (filters.toTime) {
      query.timestamp = query.timestamp || {};
      query.timestamp.$lte = new Date(filters.toTime);
    }

    const trackingData = await Tracking.find(query)
      .populate('driver', 'name phone')
      .sort({ timestamp: 1 })
      .select('-__v')
      .lean();

    return trackingData;
  }

  /**
   * Get last known location for booking
   * @param {String} bookingId - Booking ID
   * @returns {Promise<Object>}
   */
  static async getLastKnownLocation(bookingId) {
    const booking = await Booking.findById(bookingId)
      .populate('driver', 'name phone')
      .populate('vehicle', 'vehicleNumber truckType')
      .select('bookingId status lastKnownLocation lastLocationUpdate driver vehicle pickupCity dropCity')
      .lean();

    if (!booking) throw new ApiError(404, 'Booking not found');

    const lastTracking = await Tracking.findOne({ booking: bookingId })
      .sort({ timestamp: -1 })
      .select('location speed heading battery timestamp')
      .lean();

    return {
      booking: {
        id: booking._id,
        bookingId: booking.bookingId,
        status: booking.status,
        route: {
          from: booking.pickupCity,
          to: booking.dropCity
        }
      },
      driver: booking.driver,
      vehicle: booking.vehicle,
      lastLocation: lastTracking
        ? {
          latitude: lastTracking.location.coordinates[1],
          longitude: lastTracking.location.coordinates[0],
          speed: lastTracking.speed,
          heading: lastTracking.heading,
          battery: lastTracking.battery,
          timestamp: lastTracking.timestamp
        }
        : null,
      lastUpdate: booking.lastLocationUpdate
    };
  }

  /**
   * Get live tracking URL for booking
   * @param {String} bookingId - Booking ID
   * @returns {Promise<String>}
   */
  static async getTrackingUrl(bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    const trackingToken = Buffer.from(bookingId).toString('base64');
    const trackingUrl = `${process.env.FRONTEND_URL}/track/${trackingToken}`;

    return trackingUrl;
  }

  /**
   * Calculate distance traveled
   * @param {String} bookingId - Booking ID
   * @returns {Promise<Number>} - Distance in kilometers
   */
  static async calculateDistanceTraveled(bookingId) {
    const trackingData = await Tracking.find({ booking: bookingId })
      .sort({ timestamp: 1 })
      .select('location')
      .lean();

    if (trackingData.length < 2) return 0;

    let totalDistance = 0;

    for (let i = 1; i < trackingData.length; i++) {
      const prev = trackingData[i - 1].location.coordinates;
      const curr = trackingData[i].location.coordinates;

      const distance = this.calculateHaversineDistance(
        prev[1],
        prev[0],
        curr[1],
        curr[0]
      );

      totalDistance += distance;
    }

    return Math.round(totalDistance * 100) / 100; // Round to 2 decimals
  }

  /**
   * Calculate Haversine distance between two points
   * @param {Number} lat1
   * @param {Number} lon1
   * @param {Number} lat2
   * @param {Number} lon2
   * @returns {Number} - Distance in kilometers
   */
  static calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {Number} degrees
   * @returns {Number}
   */
  static toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Get tracking statistics for booking
   * @param {String} bookingId - Booking ID
   * @returns {Promise<Object>}
   */
  static async getTrackingStatistics(bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    const trackingData = await Tracking.find({ booking: bookingId }).lean();

    if (trackingData.length === 0) {
      return {
        totalPoints: 0,
        distanceTraveled: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        firstUpdate: null,
        lastUpdate: null,
        duration: 0
      };
    }

    const speeds = trackingData.map((t) => t.speed || 0);
    const maxSpeed = Math.max(...speeds);
    const averageSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

    const firstUpdate = trackingData[0].timestamp;
    const lastUpdate = trackingData[trackingData.length - 1].timestamp;
    const duration = (lastUpdate - firstUpdate) / (1000 * 60 * 60); // in hours

    const distanceTraveled = await this.calculateDistanceTraveled(bookingId);

    return {
      totalPoints: trackingData.length,
      distanceTraveled: Math.round(distanceTraveled * 100) / 100,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      firstUpdate,
      lastUpdate,
      duration: Math.round(duration * 100) / 100
    };
  }

  /**
   * Get tracking data for map visualization
   * @param {String} bookingId - Booking ID
   * @param {Number} interval - Minutes between points (for downsampling)
   * @returns {Promise<Array>}
   */
  static async getTrackingRoute(bookingId, interval = 5) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    const allTracking = await Tracking.find({ booking: bookingId })
      .sort({ timestamp: 1 })
      .select('location timestamp speed')
      .lean();

    if (allTracking.length === 0) return [];

    // Downsample data based on interval
    const downsampledData = [];
    let lastTimestamp = null;

    for (const point of allTracking) {
      if (!lastTimestamp || (point.timestamp - lastTimestamp) >= interval * 60 * 1000) {
        downsampledData.push({
          latitude: point.location.coordinates[1],
          longitude: point.location.coordinates[0],
          speed: point.speed,
          timestamp: point.timestamp
        });
        lastTimestamp = point.timestamp;
      }
    }

    // Always include the last point
    if (downsampledData[downsampledData.length - 1]?.timestamp !== allTracking[allTracking.length - 1].timestamp) {
      const lastPoint = allTracking[allTracking.length - 1];
      downsampledData.push({
        latitude: lastPoint.location.coordinates[1],
        longitude: lastPoint.location.coordinates[0],
        speed: lastPoint.speed,
        timestamp: lastPoint.timestamp
      });
    }

    return downsampledData;
  }

  /**
   * Clean old tracking data (retention policy)
   * @param {Number} daysToKeep - Number of days to keep data
   * @returns {Promise<Number>} - Number of records deleted
   */
  static async cleanOldTrackingData(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await Tracking.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    logger.info(`Cleaned old tracking data: ${result.deletedCount} records deleted`);
    return result.deletedCount;
  }

  /**
   * Get all live trips (active bookings)
   * @returns {Promise<Array>}
   */
  static async getLiveTrips() {
    const activeStatuses = [
      'assigned',
      'driver-en-route',
      'reached-pickup',
      'loaded',
      'in-transit',
      'reached-destination'
    ];

    const liveBookings = await Booking.find({
      status: { $in: activeStatuses },
      isDeleted: false
    })
      .populate('driver', 'name phone profileImage')
      .populate('vehicle', 'vehicleNumber truckType model bodyType')
      .populate('customer', 'companyName')
      .select('bookingId status lastKnownLocation lastLocationUpdate pickup drop driver vehicle customer materialType loadDate')
      .lean();

    return liveBookings.map(booking => ({
      id: booking._id,
      _id: booking._id, // Add _id for frontend compatibility
      bookingId: booking.bookingId,
      status: booking.status,
      materialType: booking.materialType,
      loadDate: booking.loadDate,
      customer: booking.customer ? {
        _id: booking.customer._id,
        companyName: booking.customer.companyName
      } : null,
      driver: booking.driver ? {
        _id: booking.driver._id,
        name: booking.driver.name,
        phone: booking.driver.phone,
        profileImage: booking.driver.profileImage
      } : null,
      vehicle: booking.vehicle ? {
        _id: booking.vehicle._id,
        vehicleNumber: booking.vehicle.vehicleNumber,
        truckType: booking.vehicle.truckType,
        model: booking.vehicle.model,
        bodyType: booking.vehicle.bodyType
      } : null,
      pickup: {
        city: booking.pickup.city,
        address: booking.pickup.address,
        latLng: booking.pickup.location
      },
      drop: {
        city: booking.drop.city,
        address: booking.drop.address,
        latLng: booking.drop.location
      },
      lastLocation: booking.lastKnownLocation ? {
        location: booking.lastKnownLocation,
        timestamp: booking.lastLocationUpdate
      } : null
    }));
  }

  /**
   * Get planned route for booking (with caching)
   * @param {String} bookingId - Booking ID
   * @returns {Promise<Object>}
   */
  static async getPlannedRoute(bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    // Check if cached route exists and is less than 24 hours old
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (booking.estimatedRoute?.polyline && booking.estimatedRoute.calculatedAt > oneDayAgo) {
      return booking.estimatedRoute;
    }

    // Calculate new route
    const origin = {
      latitude: booking.pickup.location.coordinates[1],
      longitude: booking.pickup.location.coordinates[0]
    };
    const destination = {
      latitude: booking.drop.location.coordinates[1],
      longitude: booking.drop.location.coordinates[0]
    };

    const routeData = await LocationService.calculateRoute(origin, destination);
    if (!routeData) throw new ApiError(500, 'Could not calculate route');

    // Update booking with cached route
    booking.estimatedRoute = {
      polyline: routeData.polyline,
      distance: routeData.distance.value,
      duration: routeData.duration.value,
      calculatedAt: new Date()
    };
    await booking.save();

    return booking.estimatedRoute;
  }

  /**
   * Check if driver has entered pickup or drop geofence and fire one-time alert.
   * Uses the Booking.geofenceAlerts map to avoid duplicate notifications.
   */
  static async _checkGeofence(booking, driverId, latitude, longitude) {
    const RADIUS_KM = 0.5; // 500m

    const checkPoint = async (label, coords, alertKey) => {
      // One-time only: skip if already fired for this booking + point
      if (booking.geofenceAlerts?.[alertKey]) return;

      if (!coords || !Array.isArray(coords) || coords.length !== 2) return;

      const [pLng, pLat] = coords;
      const distKm = TrackingService.calculateHaversineDistance(latitude, longitude, pLat, pLng);

      if (distKm <= RADIUS_KM) {
        // Mark as fired to prevent duplicates
        await Booking.findByIdAndUpdate(booking._id, {
          [`geofenceAlerts.${alertKey}`]: true,
          [`geofenceAlerts.${alertKey}At`]: new Date()
        });

        // FCM push to customer
        const customer = await Customer.findById(booking.customer).populate('user', '_id').lean();
        if (customer?.user) {
          const messages = {
            pickup: { title: 'Driver Arriving', body: `Your driver is ~500m from the pickup location.` },
            drop: { title: 'Driver Arriving', body: `Your driver is ~500m from the delivery location.` }
          };
          await NotificationService.sendNotification({
            recipient: customer.user._id,
            type: `geofence_${alertKey}`,
            title: messages[label].title,
            message: messages[label].body,
            entityType: 'booking',
            entityId: booking._id,
            data: { bookingId: booking._id.toString(), action: 'track_shipment' }
          });
        }

        logger.info(`Geofence alert fired: driver entered ${label} zone`, {
          bookingId: booking._id,
          driverId,
          distKm
        });
      }
    };

    const tasks = [];
    if (booking.pickup?.location?.coordinates) {
      tasks.push(checkPoint('pickup', booking.pickup.location.coordinates, 'pickup'));
    }
    if (booking.drop?.location?.coordinates) {
      tasks.push(checkPoint('drop', booking.drop.location.coordinates, 'drop'));
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }
}

export default TrackingService;
