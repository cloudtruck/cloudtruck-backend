import Route from '../models/route.model.js';
import Customer from '../models/customer.model.js';
import ApiError from '../utils/ApiError.js';

/**
 * Route Service
 * Handles saved route templates for repeat customers
 */
class RouteService {
  /**
   * Create saved route
   * @param {Object} data - Route data
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Created route
   */
  static async createRoute(data, customerId) {
    const {
      name,
      description,
      pickupCity,
      pickupLat,
      pickupLng,
      pickupAddress,
      pickupPincode,
      pickupLandmark,
      pickupContactName,
      pickupContactPhone,
      dropCity,
      dropLat,
      dropLng,
      dropAddress,
      dropPincode,
      dropLandmark,
      dropContactName,
      dropContactPhone,
      preferredTruckType,
      preferredBodyType,
      distance,
      estimatedDuration,
      notes,
      specialInstructions,
      category,
      tags,
      isFavorite
    } = data;

    // Verify customer exists
    const customer = await Customer.findOne({ user: customerId, isDeleted: false });
    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    // Build pickup location
    const pickup = {
      city: pickupCity,
      address: pickupAddress,
      location: {
        type: 'Point',
        coordinates: [pickupLng, pickupLat]
      }
    };

    if (pickupPincode) pickup.pincode = pickupPincode;
    if (pickupLandmark) pickup.landmark = pickupLandmark;
    if (pickupContactName || pickupContactPhone) {
      pickup.contactPerson = {};
      if (pickupContactName) pickup.contactPerson.name = pickupContactName;
      if (pickupContactPhone) pickup.contactPerson.phone = pickupContactPhone;
    }

    // Build drop location
    const drop = {
      city: dropCity,
      address: dropAddress,
      location: {
        type: 'Point',
        coordinates: [dropLng, dropLat]
      }
    };

    if (dropPincode) drop.pincode = dropPincode;
    if (dropLandmark) drop.landmark = dropLandmark;
    if (dropContactName || dropContactPhone) {
      drop.contactPerson = {};
      if (dropContactName) drop.contactPerson.name = dropContactName;
      if (dropContactPhone) drop.contactPerson.phone = dropContactPhone;
    }

    // Create route
    const route = await Route.create({
      customer: customer._id,
      name,
      description,
      pickup,
      drop,
      preferredTruckType,
      preferredBodyType,
      distance: distance ? { value: distance, unit: 'km' } : undefined,
      estimatedDuration,
      notes,
      specialInstructions,
      category,
      tags,
      isFavorite: isFavorite || false,
      createdBy: customerId
    });

    return route;
  }

  /**
   * Get route by ID
   * @param {string} routeId - Route ID
   * @param {string} customerId - Customer ID (for authorization)
   * @returns {Promise<Object>} Route details
   */
  static async getRouteById(routeId, customerId) {
    const route = await Route.findOne({ _id: routeId, isDeleted: false })
      .populate('customer', 'companyName')
      .populate('createdBy', 'phone email');

    if (!route) {
      throw new ApiError(404, 'Route not found');
    }

    // Authorization check - only customer who created can access
    const customer = await Customer.findOne({ user: customerId });
    if (route.customer._id.toString() !== customer._id.toString()) {
      throw new ApiError(403, 'Access denied');
    }

    return route;
  }

  /**
   * Get customer's saved routes
   * @param {string} customerId - Customer ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Routes list
   */
  static async getCustomerRoutes(customerId, filters = {}, pagination = {}) {
    const customer = await Customer.findOne({ user: customerId, isDeleted: false });
    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    const { truckType, preferredTruckType, isFavorite, city } = filters;

    const query = {
      customer: customer._id,
      isDeleted: false
    };

    // Prefer explicit preferredTruckType, fall back to legacy truckType param
    if (preferredTruckType) query.preferredTruckType = preferredTruckType;
    else if (truckType) query.preferredTruckType = truckType;

    if (typeof isFavorite === 'boolean') query.isFavorite = isFavorite;
    if (city) {
      query.$or = [
        { 'pickup.city': new RegExp(city, 'i') },
        { 'drop.city': new RegExp(city, 'i') }
      ];
    }

    const result = await Route.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      sort: pagination.sort || { usageCount: -1, lastUsed: -1 }
    });

    return result;
  }

  /**
   * Search routes by cities
   * @param {string} customerId - Customer ID
   * @param {string} pickupCity - Pickup city
   * @param {string} dropCity - Drop city
   * @returns {Promise<Array>} Matching routes
   */
  static async searchRoutes(customerId, pickupCity, dropCity) {
    const customer = await Customer.findOne({ user: customerId });
    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    const routes = await Route.findBetweenCities(customer._id, pickupCity, dropCity);

    return routes;
  }

  /**
   * Update route
   * @param {string} routeId - Route ID
   * @param {Object} updateData - Data to update
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Updated route
   */
  static async updateRoute(routeId, updateData, customerId) {
    const customer = await Customer.findOne({ user: customerId });
    const route = await Route.findOne({
      _id: routeId,
      customer: customer._id,
      isDeleted: false
    });

    if (!route) {
      throw new ApiError(404, 'Route not found');
    }

    // Update allowed fields
    const allowedFields = [
      'name',
      'description',
      'preferredTruckType',
      'preferredBodyType',
      'notes',
      'specialInstructions',
      'category',
      'tags',
      'isFavorite'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        route[field] = updateData[field];
      }
    });

    route.updatedBy = customerId;
    await route.save();

    return route;
  }

  /**
   * Mark route as used (when creating booking from saved route)
   * @param {string} routeId - Route ID
   * @returns {Promise<Object>} Updated route
   */
  static async markAsUsed(routeId) {
    const route = await Route.findById(routeId);

    if (!route) {
      throw new ApiError(404, 'Route not found');
    }

    await route.markAsUsed();

    return route;
  }

  /**
   * Toggle favorite status
   * @param {string} routeId - Route ID
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Updated route
   */
  static async toggleFavorite(routeId, customerId) {
    const customer = await Customer.findOne({ user: customerId });
    const route = await Route.findOne({
      _id: routeId,
      customer: customer._id,
      isDeleted: false
    });

    if (!route) {
      throw new ApiError(404, 'Route not found');
    }

    route.isFavorite = !route.isFavorite;
    await route.save();

    return route;
  }

  /**
   * Update route statistics
   * @param {string} routeId - Route ID
   * @param {Object} bookingData - Booking data
   * @returns {Promise<Object>} Updated route
   */
  static async updateStatistics(routeId, bookingData) {
    const { actualCost, actualDistance } = bookingData;

    const route = await Route.findById(routeId);

    if (!route) {
      throw new ApiError(404, 'Route not found');
    }

    await route.updateStatistics(actualCost, actualDistance);

    return route;
  }

  /**
   * Clone route
   * @param {string} routeId - Route ID
   * @param {string} newName - New route name
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Cloned route
   */
  static async cloneRoute(routeId, newName, customerId) {
    const customer = await Customer.findOne({ user: customerId });
    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    const route = await Route.findOne({
      _id: routeId,
      customer: customer._id,
      isDeleted: false
    });

    if (!route) {
      throw new ApiError(404, 'Route not found');
    }

    // Pass the acting user's id so the cloned document fulfills required `createdBy`
    const clonedRoute = await route.clone(newName, customerId);

    return clonedRoute;
  }

  /**
   * Get popular routes for customer
   * @param {string} customerId - Customer ID
   * @param {number} limit - Number of routes to return
   * @returns {Promise<Array>} Popular routes
   */
  static async getPopularRoutes(customerId, limit = 5) {
    const customer = await Customer.findOne({ user: customerId });
    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    const routes = await Route.find({
      customer: customer._id,
      isDeleted: false
    })
      .sort({ usageCount: -1, lastUsed: -1 })
      .limit(limit)
      .lean();

    return routes;
  }

  /**
   * Get favorite routes
   * @param {string} customerId - Customer ID
   * @returns {Promise<Array>} Favorite routes
   */
  static async getFavoriteRoutes(customerId) {
    const customer = await Customer.findOne({ user: customerId });
    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    const routes = await Route.find({
      customer: customer._id,
      isFavorite: true,
      isDeleted: false
    })
      .sort({ name: 1 })
      .lean();

    return routes;
  }

  /**
   * Get route statistics
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Route statistics
   */
  static async getRouteStatistics(customerId) {
    const customer = await Customer.findOne({ user: customerId });
    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    const stats = await Route.aggregate([
      {
        $match: {
          customer: customer._id,
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          totalRoutes: { $sum: 1 },
          favoriteRoutes: {
            $sum: { $cond: ['$isFavorite', 1, 0] }
          },
          totalUsage: { $sum: '$usageCount' },
          avgCostPerRoute: { $avg: '$statistics.avgCost' },
          totalDistance: { $sum: '$statistics.avgDistance' }
        }
      }
    ]);

    return stats[0] || {
      totalRoutes: 0,
      favoriteRoutes: 0,
      totalUsage: 0,
      avgCostPerRoute: 0,
      totalDistance: 0
    };
  }

  /**
   * Soft delete route
   * @param {string} routeId - Route ID
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Deleted route
   */
  static async deleteRoute(routeId, customerId) {
    const customer = await Customer.findOne({ user: customerId });
    const route = await Route.findOne({
      _id: routeId,
      customer: customer._id,
      isDeleted: false
    });

    if (!route) {
      throw new ApiError(404, 'Route not found');
    }

    await route.softDelete(customerId);

    return route;
  }
}

export default RouteService;
