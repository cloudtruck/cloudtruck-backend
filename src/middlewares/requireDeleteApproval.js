import OrganizationSettings from '../models/organizationSettings.model.js';
import DeleteRequest from '../models/deleteRequest.model.js';
import ApiResponse from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';

let redisClient = null;
const CACHE_KEY = 'org:deletion-policy';
const CACHE_TTL = 300; // 5 minutes

async function getRedis() {
  if (redisClient) return redisClient;
  try {
    const { getRedisClient } = await import('../config/redis.js');
    redisClient = getRedisClient();
  } catch (_) {
    // Redis unavailable
  }
  return redisClient;
}

async function getDeletionPolicy() {
  try {
    const redis = await getRedis();
    if (redis && redis.isOpen) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    }
  } catch (_) {
    // Cache miss — fall through
  }

  const settings = await OrganizationSettings.getInstance();
  const policy = settings.deletionPolicy || { requireApprovalFor: [] };

  try {
    const redis = await getRedis();
    if (redis && redis.isOpen) {
      await redis.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(policy));
    }
  } catch (_) {
    // Non-critical
  }

  return policy;
}

/**
 * Middleware factory: requireDeleteApproval(resource, resourceModel, getSnapshotFn?)
 *
 * If the requesting user is 'staff' AND the resource is in the org's deletionPolicy.requireApprovalFor:
 *   - Creates a DeleteRequest document
 *   - Emits socket notifications to internal + super-admin roles
 *   - Returns 202 Accepted (does NOT execute the delete)
 *
 * Otherwise: calls next() and the actual delete handler runs normally.
 *
 * @param {string} resource    - e.g. 'driver'
 * @param {string} modelName   - Mongoose model name e.g. 'Driver'
 * @param {Function} [getSnapshot] - Optional async fn(req) returning plain object snapshot for display
 */
export const requireDeleteApproval = (resource, modelName, getSnapshot = null) => {
  return async (req, res, next) => {
    try {
      // Only intercept for 'staff' role — internal and super-admin delete directly
      if (!req.user || req.user.role !== 'staff') {
        return next();
      }

      const policy = await getDeletionPolicy();
      if (!policy.requireApprovalFor || !policy.requireApprovalFor.includes(resource)) {
        return next();
      }

      const resourceId = req.params.id;
      if (!resourceId) {
        return next();
      }

      // Fetch snapshot for context in the approver queue
      let resourceSnapshot = {};
      if (getSnapshot) {
        try {
          resourceSnapshot = await getSnapshot(req) || {};
        } catch (_) {
          // Non-critical
        }
      }

      const deleteRequest = await DeleteRequest.create({
        resource,
        resourceId,
        resourceModel: modelName,
        resourceSnapshot,
        requestedBy: req.user._id,
        reason: req.body?.reason || undefined
      });

      // Notify approvers via Socket.io (fire-and-forget)
      try {
        const io = req.app.get('io');
        if (io) {
          const { emitNotificationToRole } = await import('../sockets/notification.socket.js');
          const notification = {
            type: 'delete_request',
            title: 'Deletion Approval Required',
            message: `${req.user.name || 'A staff member'} has requested deletion of a ${resource} record.`,
            data: {
              deleteRequestId: deleteRequest._id,
              resource,
              resourceId,
              requestedBy: req.user._id
            }
          };
          emitNotificationToRole(io, 'internal', notification);
          emitNotificationToRole(io, 'super-admin', notification);
        }
      } catch (socketErr) {
        logger.error('Failed to emit delete-request notification:', socketErr);
      }

      return res.status(202).json(
        new ApiResponse(202, { deleteRequestId: deleteRequest._id }, `Deletion request submitted for approval. A manager will review your request.`)
      );
    } catch (err) {
      logger.error('requireDeleteApproval middleware error:', err);
      next(err);
    }
  };
};
