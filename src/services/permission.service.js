import Permission from '../models/permission.model.js';
import AuditLog from '../models/auditLog.model.js';
import ApiError from '../utils/ApiError.js';

class PermissionService {
  /**
   * Get all permissions with optional filters
   */
  async getAllPermissions(filters = {}) {
    const query = { ...filters };
    
    const permissions = await Permission.find(query)
      .sort({ resource: 1, action: 1 })
      .lean();

    return permissions;
  }

  /**
   * Get permissions grouped by resource
   */
  async getPermissionsGroupedByResource() {
    const permissions = await Permission.find({ isActive: true, isDeleted: false })
      .sort({ resource: 1, action: 1 })
      .lean();

    const grouped = permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {});

    return grouped;
  }

  /**
   * Get permission by ID
   */
  async getPermissionById(permissionId) {
    const permission = await Permission.findById(permissionId);

    if (!permission) {
      throw new ApiError(404, 'Permission not found');
    }

    return permission;
  }

  /**
   * Create new permission
   */
  async createPermission(permissionData, userId) {
    // Check if permission with same key already exists
    const existingPermission = await Permission.findOne({ key: permissionData.key });
    if (existingPermission) {
      throw new ApiError(400, 'Permission with this key already exists');
    }

    const permission = await Permission.create(permissionData);

    // Create audit log
    await AuditLog.create({
      user: userId,
      action: 'create',
      resource: 'Permission',
      resourceId: permission._id,
      details: { permissionKey: permission.key },
    });

    return permission;
  }

  /**
   * Update permission
   */
  async updatePermission(permissionId, updateData, userId) {
    const permission = await Permission.findById(permissionId);

    if (!permission) {
      throw new ApiError(404, 'Permission not found');
    }

    // If updating key, check for duplicates
    if (updateData.key && updateData.key !== permission.key) {
      const existingPermission = await Permission.findOne({ key: updateData.key });
      if (existingPermission) {
        throw new ApiError(400, 'Permission with this key already exists');
      }
    }

    Object.assign(permission, updateData);
    await permission.save();

    // Create audit log
    await AuditLog.create({
      user: userId,
      action: 'update',
      resource: 'Permission',
      resourceId: permission._id,
      details: { updates: updateData },
    });

    return permission;
  }

  /**
   * Delete permission (soft delete)
   */
  async deletePermission(permissionId, userId) {
    const permission = await Permission.findById(permissionId);

    if (!permission) {
      throw new ApiError(404, 'Permission not found');
    }

    // Soft delete
    permission.isActive = false;
    permission.isDeleted = true;
    await permission.save();

    // Create audit log
    await AuditLog.create({
      user: userId,
      action: 'delete',
      resource: 'Permission',
      resourceId: permission._id,
      details: { permissionKey: permission.key },
    });

    return permission;
  }
}

export default new PermissionService();
