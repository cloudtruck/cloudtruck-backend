import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Permission from '../models/permission.model.js';
import Staff from '../models/staff.model.js';

const IMPLICIT_PERMISSIONS = {
  customer: [
    ['booking', 'create'], ['booking', 'read'],
    ['customer', 'read'], ['customer', 'update'],
    ['document', 'read'],
    ['tracking', 'read'],
    ['payment', 'create'], ['payment', 'read'],
  ],
  driver: [
    ['booking', 'read'], ['booking', 'update'],
    ['driver', 'read'], ['driver', 'update'],
    ['document', 'create'], ['document', 'read'],
    ['tracking', 'create'], ['tracking', 'read'],
    ['vehicle', 'read'],
  ],
};

function hasImplicitPermission(role, resource, action) {
  const list = IMPLICIT_PERMISSIONS[role];
  if (!list) return false;
  return list.some(([r, a]) => r === resource && a === action);
}

/**
 * Check if user has required permission
 * RBAC middleware for fine-grained access control
 * 
 * @param {string} resource - Resource name (e.g., 'booking', 'driver', 'vehicle')
 * @param {string} action - Action name (e.g., 'create', 'read', 'update', 'delete')
 * @returns {Function} Express middleware
 * 
 * @example
 * router.post('/bookings', 
 *   verifyJWT, 
 *   requirePermission('booking', 'create'), 
 *   bookingController.create
 * );
 */
export const requirePermission = (resource, action) => {
  return asyncHandler(async (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      throw new ApiError(401, "Unauthorized - Authentication required");
    }

    const user = req.user;

    // Super admins and internal admins have all permissions
    if (user.role === 'super-admin' || user.role === 'internal') {
      return next();
    }

    // Customers have implicit permissions for their own resources
    if (user.role === 'customer') {
      if (hasImplicitPermission('customer', resource, action)) {
        return next();
      }
      throw new ApiError(403, `Access denied - Insufficient permissions for ${action} on ${resource}`);
    }

    // Drivers have implicit permissions for assigned bookings
    if (user.role === 'driver') {
      if (hasImplicitPermission('driver', resource, action)) {
        return next();
      }
      throw new ApiError(403, `Access denied - Insufficient permissions for ${action} on ${resource}`);
    }

    // For staff and internal users, check permissions from database
    if (user.role === 'staff') {
      try {
        // Find staff record with permissions
        const staff = await Staff.findOne({ user: user._id })
          .populate('permissions', 'resource action')
          .lean();

        if (!staff) {
          throw new ApiError(403, "Staff record not found");
        }

        // Check if user has the required permission
        const hasPermission = staff.permissions.some(
          permission => 
            permission.resource === resource && 
            permission.action === action
        );

        if (!hasPermission) {
          throw new ApiError(
            403, 
            `Access denied - Missing permission: ${action} on ${resource}`
          );
        }

        return next();
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(500, "Error checking permissions");
      }
    }

    // If role is not recognized, deny access
    throw new ApiError(403, "Access denied - Invalid role");
  });
};

/**
 * Check if user has any of the required permissions
 * User needs at least one of the specified permissions
 * 
 * @param {Array<{resource: string, action: string}>} permissions - Array of permission objects
 * @returns {Function} Express middleware
 * 
 * @example
 * router.get('/bookings', 
 *   verifyJWT, 
 *   requireAnyPermission([
 *     { resource: 'booking', action: 'read' },
 *     { resource: 'booking', action: 'readAll' }
 *   ]), 
 *   bookingController.getAll
 * );
 */
export const requireAnyPermission = (permissions) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized - Authentication required");
    }

    const user = req.user;

    // Super admins and internal admins have all permissions
    if (user.role === 'super-admin' || user.role === 'internal') {
      return next();
    }

    // Check implicit permissions for customers and drivers
    if (['customer', 'driver'].includes(user.role)) {
      const hasAny = permissions.some(p => hasImplicitPermission(user.role, p.resource, p.action));
      if (hasAny) {
        return next();
      }
      throw new ApiError(403, `Access denied - Insufficient permissions`);
    }

    // For staff and internal users, check database permissions
    if (user.role === 'staff') {
      try {
        const staff = await Staff.findOne({ user: user._id })
          .populate('permissions', 'resource action')
          .lean();

        if (!staff) {
          throw new ApiError(403, "Staff record not found");
        }

        // Check if user has any of the required permissions
        const hasAnyPermission = permissions.some(reqPerm =>
          staff.permissions.some(
            userPerm =>
              userPerm.resource === reqPerm.resource &&
              userPerm.action === reqPerm.action
          )
        );

        if (!hasAnyPermission) {
          const permList = permissions
            .map(p => `${p.action} on ${p.resource}`)
            .join(', ');
          throw new ApiError(
            403,
            `Access denied - Need one of: ${permList}`
          );
        }

        return next();
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(500, "Error checking permissions");
      }
    }

    throw new ApiError(403, "Access denied - Invalid role");
  });
};

/**
 * Check if user has all of the required permissions
 * User needs all specified permissions
 * 
 * @param {Array<{resource: string, action: string}>} permissions - Array of permission objects
 * @returns {Function} Express middleware
 */
export const requireAllPermissions = (permissions) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized - Authentication required");
    }

    const user = req.user;

    // Super admins and internal admins have all permissions
    if (user.role === 'super-admin' || user.role === 'internal') {
      return next();
    }

    // For staff and internal users, check database permissions
    if (user.role === 'staff') {
      try {
        const staff = await Staff.findOne({ user: user._id })
          .populate('permissions', 'resource action')
          .lean();

        if (!staff) {
          throw new ApiError(403, "Staff record not found");
        }

        // Check if user has all required permissions
        const hasAllPermissions = permissions.every(reqPerm =>
          staff.permissions.some(
            userPerm =>
              userPerm.resource === reqPerm.resource &&
              userPerm.action === reqPerm.action
          )
        );

        if (!hasAllPermissions) {
          const permList = permissions
            .map(p => `${p.action} on ${p.resource}`)
            .join(', ');
          throw new ApiError(
            403,
            `Access denied - Need all of: ${permList}`
          );
        }

        return next();
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(500, "Error checking permissions");
      }
    }

    throw new ApiError(403, "Access denied - Invalid role");
  });
};

export default requirePermission;
