import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Staff from '../models/staff.model.js';
import Permission from '../models/permission.model.js';

/**
 * Field-level permission middleware
 * Checks if user has permission to update specific fields
 * 
 * @param {string} permissionKey - Dot-notation permission key (e.g., 'booking.update.price')
 * @returns {Function} Express middleware
 * 
 * @example
 * router.patch('/bookings/:id/price', 
 *   verifyJWT, 
 *   requireFieldPermission('booking.update.price'),
 *   bookingController.updatePrice
 * );
 */
export const requireFieldPermission = (permissionKey) => {
  return asyncHandler(async (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      throw new ApiError(401, "Unauthorized - Authentication required");
    }

    const user = req.user;

    // Super admins have all permissions
    if (user.role === 'super-admin') {
      return next();
    }

    // Customers and drivers don't have field-level permissions
    if (['customer', 'driver'].includes(user.role)) {
      throw new ApiError(
        403, 
        `Access denied - Field permission required: ${permissionKey}`
      );
    }

    // For staff and internal users, check field permissions
    if (['staff', 'internal'].includes(user.role)) {
      try {
        // Find staff record with permissions
        const staff = await Staff.findOne({ user: user._id })
          .populate('permissions', 'key resource action')
          .lean();

        if (!staff) {
          throw new ApiError(403, "Staff record not found");
        }

        // Check if user has the required field permission
        // Support both dot-notation keys (booking.update.price) and 
        // resource.action combinations
        const hasPermission = staff.permissions.some(permission => {
          // Direct key match
          if (permission.key === permissionKey) {
            return true;
          }
          
          // Parse dot-notation (e.g., booking.update.price)
          const parts = permissionKey.split('.');
          if (parts.length >= 2) {
            const resource = parts[0];
            const action = parts[1];
            
            // Check if permission matches resource.action pattern
            if (permission.resource === resource && permission.action === action) {
              return true;
            }
            
            // Check wildcard permissions (e.g., booking.update.*)
            if (permission.key === `${resource}.${action}.*`) {
              return true;
            }
          }
          
          return false;
        });

        if (!hasPermission) {
          throw new ApiError(
            403, 
            `Access denied - Missing field permission: ${permissionKey}`
          );
        }

        return next();
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(500, "Error checking field permissions");
      }
    }

    // If role is not recognized, deny access
    throw new ApiError(403, "Access denied - Invalid role");
  });
};

/**
 * Check if user has any of the required field permissions
 * 
 * @param {Array<string>} permissionKeys - Array of dot-notation permission keys
 * @returns {Function} Express middleware
 */
export const requireAnyFieldPermission = (permissionKeys) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized - Authentication required");
    }

    const user = req.user;

    // Super admins have all permissions
    if (user.role === 'super-admin') {
      return next();
    }

    if (['staff', 'internal'].includes(user.role)) {
      try {
        const staff = await Staff.findOne({ user: user._id })
          .populate('permissions', 'key resource action')
          .lean();

        if (!staff) {
          throw new ApiError(403, "Staff record not found");
        }

        // Check if user has any of the required field permissions
        const hasAnyPermission = permissionKeys.some(permKey =>
          staff.permissions.some(permission => {
            if (permission.key === permKey) return true;
            
            const parts = permKey.split('.');
            if (parts.length >= 2) {
              const resource = parts[0];
              const action = parts[1];
              
              if (permission.resource === resource && permission.action === action) {
                return true;
              }
              
              if (permission.key === `${resource}.${action}.*`) {
                return true;
              }
            }
            
            return false;
          })
        );

        if (!hasAnyPermission) {
          throw new ApiError(
            403,
            `Access denied - Need one of: ${permissionKeys.join(', ')}`
          );
        }

        return next();
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(500, "Error checking field permissions");
      }
    }

    throw new ApiError(403, "Access denied - Invalid role");
  });
};

export default requireFieldPermission;
