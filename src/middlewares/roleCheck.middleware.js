import ApiError from '../utils/ApiError.js';

/**
 * Check User Role Middleware
 * Verifies if authenticated user has one of the required roles
 * 
 * @param {...string} roles - Allowed roles (e.g., 'customer', 'driver', 'staff', 'internal', 'super-admin')
 * @returns {Function} Express middleware
 * 
 * @example
 * // Single role
 * router.post('/bookings', verifyJWT, checkRole('customer'), bookingController.create);
 * 
 * @example
 * // Multiple roles
 * router.get('/bookings/:id', verifyJWT, checkRole('customer', 'staff', 'internal'), bookingController.getById);
 */
export const checkRole = (...roles) => {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      throw new ApiError(401, "Unauthorized - Authentication required");
    }
    
    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        403, 
        `Access denied - Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      );
    }
    
    next();
  };
};

/**
 * Check if user is a customer
 * Shorthand for checkRole('customer')
 */
export const isCustomer = checkRole('customer');

/**
 * Check if user is a driver
 * Shorthand for checkRole('driver')
 */
export const isDriver = checkRole('driver');

/**
 * Check if user is staff
 * Shorthand for checkRole('staff')
 */
export const isStaff = checkRole('staff');

/**
 * Check if user is internal
 * Shorthand for checkRole('internal')
 */
export const isInternal = checkRole('internal');

/**
 * Check if user is super-admin
 * Shorthand for checkRole('super-admin')
 */
export const isSuperAdmin = checkRole('super-admin');

/**
 * Check if user is staff or higher (staff, internal, super-admin)
 * Used for operations that require elevated privileges
 */
export const isStaffOrAbove = checkRole('staff', 'internal', 'super-admin');

/**
 * Check if user is internal or higher (internal, super-admin)
 * Used for operations that require high-level privileges
 */
export const isInternalOrAbove = checkRole('internal', 'super-admin');

/**
 * Check if user can assign drivers
 * Only staff, internal, and super-admin can assign drivers
 */
export const canAssignDriver = checkRole('staff', 'internal', 'super-admin');

/**
 * Check if user can view all bookings
 * Only staff, internal, and super-admin can view all bookings
 */
export const canViewAllBookings = checkRole('staff', 'internal', 'super-admin');

/**
 * Check if user can approve drivers/vehicles
 * Only internal and super-admin can approve drivers/vehicles
 */
export const canApprove = checkRole('internal', 'super-admin');

/**
 * Check if user can manage payments
 * Only staff, internal, and super-admin can manage payments
 */
export const canManagePayments = checkRole('staff', 'internal', 'super-admin');

/**
 * Shorthand for checkRole('supplier')
 * Company supplier owners (web portal access)
 */
export const isSupplier = checkRole('supplier');

/**
 * Supplier or any staff tier
 */
export const isSupplierOrAbove = checkRole('supplier', 'staff', 'internal', 'super-admin');

/**
 * Check if user can view audit logs
 * Only internal and super-admin can view audit logs
 */
export const canViewAuditLogs = checkRole('internal', 'super-admin');

/**
 * Check if user can manage users
 * Only internal and super-admin can manage users
 */
export const canManageUsers = checkRole('internal', 'super-admin');

/**
 * Check if resource belongs to user
 * Used for checking ownership of resources
 * 
 * @param {Function} getResourceOwner - Function that extracts owner ID from resource
 * @returns {Function} Express middleware
 * 
 * @example
 * // Check if booking belongs to customer
 * router.get('/bookings/:id', 
 *   verifyJWT, 
 *   checkOwnership(async (req) => {
 *     const booking = await Booking.findById(req.params.id);
 *     return booking.customer;
 *   }), 
 *   bookingController.getById
 * );
 */
export const checkOwnership = (getResourceOwner) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, "Unauthorized - Authentication required");
      }

      // Super-admins, internal users, and staff can access all resources
      if (['super-admin', 'internal', 'staff'].includes(req.user.role)) {
        return next();
      }

      // Get the resource owner ID
      const ownerId = await getResourceOwner(req);
      
      if (!ownerId) {
        throw new ApiError(404, "Resource not found");
      }

      // Check if user is the owner
      if (ownerId.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Access denied - You don't own this resource");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user can perform action on their own resource
 * Customers can only access their own bookings/data
 * Drivers can only access their own trips/data
 * 
 * @param {string} resourceType - Type of resource ('booking', 'driver', 'customer', etc.)
 * @returns {Function} Express middleware
 */
export const checkSelfAccess = (resourceType) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized - Authentication required");
    }

    // Super-admins, internal users, and staff can access all resources
    if (['super-admin', 'internal', 'staff'].includes(req.user.role)) {
      return next();
    }

    // Check resource-specific access
    const resourceId = req.params.id || req.body[`${resourceType}Id`];
    const userResourceId = req.user[resourceType];

    if (resourceType === 'customer' && req.user.role === 'customer') {
      if (resourceId && resourceId !== req.user._id.toString()) {
        throw new ApiError(403, "Access denied - Can only access your own data");
      }
      return next();
    }

    if (resourceType === 'driver' && req.user.role === 'driver') {
      if (resourceId && resourceId !== req.user._id.toString()) {
        throw new ApiError(403, "Access denied - Can only access your own data");
      }
      return next();
    }

    throw new ApiError(403, "Access denied - Insufficient permissions");
  };
};

export default checkRole;
