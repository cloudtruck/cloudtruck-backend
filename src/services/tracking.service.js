import Tracking from '../models/tracking.model.js';
import Booking from '../models/booking.model.js';
import Driver from '../models/driver.model.js';
import EwayBill from '../models/ewayBill.model.js';
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

    // Reverse geocode in the background — non-blocking, best-effort
    if (process.env.GOOGLE_MAPS_API_KEY) {
      LocationService.reverseGeocode(latitude, longitude).then((geo) => {
        if (geo) {
          Tracking.findByIdAndUpdate(tracking._id, {
            place: geo.formattedAddress,
            city: geo.city,
            state: geo.state
          }).catch(() => {});
        }
      }).catch(() => {});
    }

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
      query.ts = { $gte: new Date(filters.fromTime) };
    }

    if (filters.toTime) {
      query.ts = query.ts || {};
      query.ts.$lte = new Date(filters.toTime);
    }

    const trackingData = await Tracking.find(query)
      .populate('driver', 'name phone')
      .sort({ ts: 1 })
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
      .select('bookingId status lastKnownLocation lastLocationUpdate driver vehicle pickup drop')
      .lean();

    if (!booking) throw new ApiError(404, 'Booking not found');

    const lastTracking = await Tracking.findOne({ booking: bookingId })
      .sort({ ts: -1 })
      .select('location speed heading battery ts')
      .lean();

    return {
      booking: {
        id: booking._id,
        bookingId: booking.bookingId,
        status: booking.status,
        route: {
          from: booking.pickup?.city,
          to: booking.drop?.city
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
          timestamp: lastTracking.ts
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
      .sort({ ts: 1 })
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

    const firstUpdate = trackingData[0].ts;
    const lastUpdate = trackingData[trackingData.length - 1].ts;
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
      .sort({ ts: 1 })
      .select('location ts speed')
      .lean();

    if (allTracking.length === 0) return [];

    // Downsample data based on interval
    const downsampledData = [];
    let lastTimestamp = null;

    for (const point of allTracking) {
      if (!lastTimestamp || (point.ts - lastTimestamp) >= interval * 60 * 1000) {
        downsampledData.push({
          latitude: point.location.coordinates[1],
          longitude: point.location.coordinates[0],
          speed: point.speed,
          timestamp: point.ts
        });
        lastTimestamp = point.ts;
      }
    }

    // Always include the last point
    if (downsampledData[downsampledData.length - 1]?.timestamp !== allTracking[allTracking.length - 1].ts) {
      const lastPoint = allTracking[allTracking.length - 1];
      downsampledData.push({
        latitude: lastPoint.location.coordinates[1],
        longitude: lastPoint.location.coordinates[0],
        speed: lastPoint.speed,
        timestamp: lastPoint.ts
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
      ts: { $lt: cutoffDate }
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

  /**
   * Get unified tracking summary for the customer tracking screen.
   * Returns all data needed in a single call:
   * route, driver, vehicle, current location, distances, ETA, e-way bill, timeline.
   * @param {String} bookingId - ObjectId or readable bookingId
   * @returns {Promise<Object>}
   */
  static async getTrackingSummary(bookingId) {
    const booking = await Booking.findOne({
      $or: [
        ...(bookingId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: bookingId }] : []),
        { bookingId }
      ],
      isDeleted: false
    })
      .populate('driver', 'name phone profileImage')
      .populate('vehicle', 'vehicleNumber truckType bodyType')
      .lean();

    if (!booking) throw new ApiError(404, 'Booking not found');

    // Last GPS ping — fall back to booking's stored last location if no Tracking records exist yet
    const lastTracking = await Tracking.findOne({ booking: booking._id })
      .sort({ ts: -1 })
      .select('location speed heading battery ts place city state')
      .lean();

    let currentLocation = null;
    if (lastTracking) {
      currentLocation = {
        latitude: lastTracking.location.coordinates[1],
        longitude: lastTracking.location.coordinates[0],
        speed: lastTracking.speed,
        heading: lastTracking.heading,
        battery: lastTracking.battery,
        timestamp: lastTracking.ts,
        place: lastTracking.place || null,
        city: lastTracking.city || null,
        state: lastTracking.state || null
      };
    } else if (booking.lastKnownLocation?.coordinates?.length === 2) {
      currentLocation = {
        latitude: booking.lastKnownLocation.coordinates[1],
        longitude: booking.lastKnownLocation.coordinates[0],
        speed: null,
        heading: null,
        battery: null,
        timestamp: booking.lastLocationUpdate || null,
        place: null,
        city: null,
        state: null
      };
    }

    // Distance traveled from GPS history
    const distanceTraveled = await this.calculateDistanceTraveled(booking._id.toString());

    // Auto-compute planned route if not cached — getPlannedRoute caches result on booking
    let estimatedRoute = booking.estimatedRoute?.distance ? booking.estimatedRoute : null;
    if (!estimatedRoute && booking.pickup?.location?.coordinates && booking.drop?.location?.coordinates) {
      try {
        estimatedRoute = await this.getPlannedRoute(booking._id.toString());
      } catch {
        // Google Maps unavailable or not configured — degrade gracefully
        estimatedRoute = null;
      }
    }

    // Total planned route distance in km (estimatedRoute.distance is in metres from Google Maps)
    const totalDistanceKm = estimatedRoute?.distance
      ? Math.round(estimatedRoute.distance / 100) / 10
      : null;

    const distanceRemaining = totalDistanceKm != null
      ? Math.max(0, Math.round((totalDistanceKm - distanceTraveled) * 10) / 10)
      : null;

    // ETA: prefer stored expectedDeliveryDate, else compute from loadDate + route duration (seconds)
    let eta = null;
    if (booking.expectedDeliveryDate) {
      eta = booking.expectedDeliveryDate;
    } else if (estimatedRoute?.duration && booking.loadDate) {
      eta = new Date(new Date(booking.loadDate).getTime() + estimatedRoute.duration * 1000);
    }

    const isOnTime = eta ? new Date() <= new Date(eta) : null;

    // E-way bill — most recent active/draft bill
    const ewayBill = await EwayBill.findOne({
      bookingId: booking._id,
      isDeleted: false,
      status: { $in: ['active', 'draft'] }
    })
      .select('ewayBillNumber status expiryTracking')
      .sort({ createdAt: -1 })
      .lean();

    // Load timestamp from statusHistory
    const loadedEntry = (booking.statusHistory || []).find(h => h.status === 'loaded');

    // Timeline — all status changes in order
    const STATUS_LABELS = {
      'created': 'Booking Created',
      'under-review': 'Under Review',
      'assigned': 'Driver Assigned',
      'driver-en-route': 'Driver En Route',
      'reached-pickup': 'Driver at Pickup',
      'loaded': 'Goods Loaded',
      'in-transit': 'In Transit',
      'reached-destination': 'Reached Destination',
      'delivered': 'Delivered',
      'pod-received': 'POD Received',
      'closed': 'Booking Closed',
      'cancelled': 'Cancelled'
    };

    const timeline = (booking.statusHistory || []).map(h => ({
      status: h.status,
      label: STATUS_LABELS[h.status] || h.status,
      timestamp: h.timestamp,
      notes: h.notes || null
    }));

    return {
      bookingId: booking.bookingId,
      status: booking.status,
      route: {
        from: {
          city: booking.pickup?.city,
          address: booking.pickup?.address,
          lat: booking.pickup?.location?.coordinates?.[1] ?? null,
          lng: booking.pickup?.location?.coordinates?.[0] ?? null
        },
        to: {
          city: booking.drop?.city,
          address: booking.drop?.address,
          lat: booking.drop?.location?.coordinates?.[1] ?? null,
          lng: booking.drop?.location?.coordinates?.[0] ?? null
        }
      },
      driver: booking.driver ? {
        name: booking.driver.name,
        phone: booking.driver.phone,
        profileImage: booking.driver.profileImage || null
      } : null,
      vehicle: booking.vehicle ? {
        vehicleNumber: booking.vehicle.vehicleNumber,
        truckType: booking.vehicle.truckType,
        bodyType: booking.vehicle.bodyType
      } : null,
      currentLocation,
      distanceTraveled,
      totalDistance: totalDistanceKm,
      distanceRemaining,
      eta,
      isOnTime,
      loadDate: booking.loadDate || null,
      loadTimestamp: loadedEntry?.timestamp || null,
      expectedDeliveryDate: booking.expectedDeliveryDate || null,
      ewayBill: ewayBill ? {
        ewayBillNumber: ewayBill.ewayBillNumber,
        status: ewayBill.status,
        validFrom: ewayBill.expiryTracking?.validFrom || null,
        validUpto: ewayBill.expiryTracking?.validUpto || null,
        isExpired: ewayBill.expiryTracking?.validUpto
          ? new Date() > new Date(ewayBill.expiryTracking.validUpto)
          : false
      } : null,
      timeline
    };
  }
}

export default TrackingService;
