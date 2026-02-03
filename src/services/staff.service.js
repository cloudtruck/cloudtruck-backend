import Staff from '../models/staff.model.js';
import User from '../models/user.model.js';
import Booking from '../models/booking.model.js';
import Permission from '../models/permission.model.js';
import RoleTemplate from '../models/roleTemplate.model.js';
import AuditLog from '../models/auditLog.model.js';
import NotificationService from './notification.service.js';
import ApiError from '../utils/ApiError.js';

/**
 * Staff Service
 * Handles staff/operations team management
 */
class StaffService {
  static async _findStaffByStaffIdOrUserId(staffIdOrUserId) {
    return Staff.findOne({
      $or: [{ _id: staffIdOrUserId }, { user: staffIdOrUserId }],
      isDeleted: false
    });
  }

  /**
   * Create staff profile
   * @param {Object} data - Staff data
   * @param {string} createdBy - User ID
   * @returns {Promise<Object>} Created staff
   */
  static async createStaff(data, createdBy) {
    let {
      userId,
      email,
      password,
      phone,
      name,
      department,
      title,
      roleTemplate: templateIdOrName,
      reportingManager,
      workingHours,
      permissions
    } = data;

    let targetUserId = userId;

    // If userId not provided, create a user first
    if (!targetUserId) {
      if (!email || !password) {
        throw new ApiError(400, 'Either userId or email and password must be provided');
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email, isDeleted: false });
      if (existingUser) {
        throw new ApiError(400, 'User with this email already exists');
      }

      const user = await User.create({
        email,
        phone,
        password,
        role: 'staff',
        status: 'active',
        createdBy
      });
      targetUserId = user._id;
    }

    // Check if staff profile already exists
    const existingStaff = await Staff.findOne({ user: targetUserId });
    if (existingStaff) {
      throw new ApiError(400, 'Staff profile already exists for this user');
    }

    // Resolve Role Template if provided
    let resolvedRoleTemplateId = null;
    let templateEntity = null;
    if (templateIdOrName) {
      // Check if it's an ObjectId or a name
      if (templateIdOrName.match(/^[0-9a-fA-F]{24}$/)) {
        templateEntity = await RoleTemplate.findById(templateIdOrName);
      } else {
        templateEntity = await RoleTemplate.findOne({ templateName: new RegExp(templateIdOrName, 'i') });
      }

      if (templateEntity) {
        resolvedRoleTemplateId = templateEntity._id;
        // If title not provided, use template name as title
        if (!title) title = templateEntity.templateName;
        // If permissions not provided, use template permissions
        if (!permissions || permissions.length === 0) {
          permissions = templateEntity.permissions.map(p => p.toString());
        }
      }
    }

    // Verify user exists and has appropriate role
    const user = await User.findById(targetUserId);
    if (!user || user.isDeleted) {
      throw new ApiError(404, 'User not found');
    }

    if (!['staff', 'internal', 'super-admin'].includes(user.role)) {
      throw new ApiError(400, 'User role not eligible for staff profile');
    }

    // Verify reporting manager if provided
    if (reportingManager) {
      // Check for self-reporting
      if (reportingManager.toString() === targetUserId.toString()) {
        throw new ApiError(400, 'Staff member cannot report to themselves');
      }
      
      const manager = await Staff.findById(reportingManager);
      if (!manager || manager.isDeleted) {
        throw new ApiError(404, 'Reporting manager not found');
      }
    }

    let permissionIds = permissions;

    // Verify permissions if provided manually or through template
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({
        _id: { $in: permissions },
        isDeleted: false
      });
      if (validPermissions.length !== permissions.length) {
        throw new ApiError(400, 'One or more invalid permissions');
      }
      permissionIds = validPermissions.map((perm) => perm._id);
    }

    // Create staff
    const staff = await Staff.create({
      user: targetUserId,
      name,
      department,
      title: title || 'Staff Member',
      roleTemplate: resolvedRoleTemplateId,
      reportingManager,
      workingHours,
      permissions: permissionIds || [],
      action: 'CREATE_STAFF_PROFILE',
      entityType: 'staff',
      entityId: staff._id,
      changes: {
        before: null,
        after: staff.toObject()
      }
    });

    return staff;
  }

  /**
   * Get staff by ID
   * @param {string} staffId - Staff ID or User ID
   * @returns {Promise<Object>} Staff details
   */
  static async getStaffById(staffId) {
    const staff = await Staff.findOne({
      $or: [{ _id: staffId }, { user: staffId }],
      isDeleted: false
    })
      .populate('user', 'email phone status lastLogin role')
      .populate('reportingManager', 'name department title')
      .populate('permissions', 'name key description')
      .populate('roleTemplate', 'templateName description')
      .populate({
        path: 'assignedBookings',
        select: 'bookingId status pickup drop customer',
        populate: { path: 'customer', select: 'companyName' }
      });

    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    return staff;
  }

  /**
   * Get staff list with filters
   * @param {Object} filters - Query filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Staff list
   */
  static async getStaff(filters = {}, pagination = {}) {
    const {
      department,
      isActive,
      reportingManager,
      search
    } = filters;

    const query = { isDeleted: false };

    if (department) query.department = department;
    if (typeof isActive === 'boolean') query.isActive = isActive;
    if (reportingManager) query.reportingManager = reportingManager;

    // Search by name or title
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { title: new RegExp(search, 'i') }
      ];
    }

    const result = await Staff.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      sort: pagination.sort || { createdAt: -1 },
      populate: [
        { path: 'user', select: 'email phone status role' },
        { path: 'reportingManager', select: 'name department' },
        { path: 'permissions', select: 'name key' },
        { path: 'roleTemplate', select: 'templateName description' },
      ],
    });

    return result;
  }

  /**
   * Update staff profile
   * @param {string} staffId - Staff ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User performing update
   * @returns {Promise<Object>} Updated staff
   */
  static async updateStaff(staffId, updateData, userId) {
    const staff = await Staff.findOne({ _id: staffId, isDeleted: false });

    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    const oldData = staff.toObject();

    // Update allowed fields
    const allowedFields = [
      'name',
      'department',
      'title',
      'reportingManager',
      'workingHours',
      'isActive',
      'roleTemplate',
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        staff[field] = updateData[field];
      }
    });

    // Update associated User model if email, phone, or status is provided
    if (updateData.email || updateData.phone || updateData.status) {
      const user = await User.findById(staff.user);
      if (user) {
        if (updateData.email) user.email = updateData.email;
        if (updateData.phone) user.phone = updateData.phone;
        if (updateData.status) user.status = updateData.status;
        await user.save();
      }
    }

    staff.updatedBy = userId;
    await staff.save();

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'UPDATE_STAFF_PROFILE',
      entityType: 'staff',
      entityId: staff._id,
      changes: {
        before: oldData,
        after: staff.toObject()
      }
    });

    return staff;
  }

  /**
   * Assign permissions to staff
   * @param {string} staffId - Staff ID
   * @param {Array} permissionIds - Permission IDs
   * @param {string} userId - User performing update
   * @returns {Promise<Object>} Updated staff
   */
  static async assignPermissions(staffId, permissionIds, userId) {
    const staff = await Staff.findById(staffId);

    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    // Verify all permissions exist
    const validPermissions = await Permission.find({
      _id: { $in: permissionIds },
      isDeleted: false
    });

    if (validPermissions.length !== permissionIds.length) {
      throw new ApiError(400, 'One or more invalid permissions');
    }

    const oldPermissions = [...staff.permissions];

    staff.permissions = permissionIds;
    staff.updatedBy = userId;
    await staff.save();

    // Audit log
    await AuditLog.create({
      user: userId,
      action: 'UPDATE_STAFF_PERMISSIONS',
      entityType: 'staff',
      entityId: staff._id,
      changes: {
        before: { permissions: oldPermissions },
        after: { permissions: permissionIds }
      }
    });

    return staff.populate('permissions', 'name key description');
  }

  /**
   * Check if staff has specific permission
   * @param {string} staffId - Staff ID
   * @param {string} permissionKey - Permission key (e.g., 'booking.assign')
   * @returns {Promise<boolean>} Has permission
   */
  static async hasPermission(staffId, permissionKey) {
    const staff = await (await this._findStaffByStaffIdOrUserId(staffId))?.populate('permissions', 'key');

    if (!staff || staff.isDeleted || !staff.isActive) {
      return false;
    }

    // Super admin has all permissions
    const user = await User.findById(staff.user);
    if (user && user.role === 'super-admin') {
      return true;
    }

    // Check if permission exists in staff's permissions
    const hasPermission = staff.permissions.some(p => p.key === permissionKey);

    return hasPermission;
  }

  /**
   * Get staff workload
   * @param {string} staffId - Staff ID
   * @returns {Promise<Object>} Workload details
   */
  static async getWorkload(staffId) {
    const staff = await this._findStaffByStaffIdOrUserId(staffId);

    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    // Get active bookings
    const activeBookings = await Booking.find({
      assignedBy: staff._id,
      status: { $nin: ['delivered', 'pod-received', 'closed', 'cancelled'] },
      isDeleted: false
    });

    // Get today's assigned bookings
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaysAssignments = await Booking.countDocuments({
      assignedBy: staff._id,
      assignedAt: { $gte: todayStart, $lte: todayEnd },
      isDeleted: false
    });

    return {
      staff: {
        name: staff.name,
        department: staff.department,
        title: staff.title
      },
      workload: {
        currentBookings: staff.currentWorkload,
        activeBookings: activeBookings.length,
        todaysAssignments,
        totalAssigned: staff.performance.bookingsAssigned
      },
      performance: staff.performance
    };
  }

  /**
   * Get staff performance metrics
   * @param {string} staffId - Staff ID
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Performance metrics
   */
  static async getPerformanceMetrics(staffId, dateRange = {}) {
    const staff = await this._findStaffByStaffIdOrUserId(staffId);

    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    const { startDate, endDate } = dateRange;
    const matchStage = {
      assignedBy: staff._id,
      isDeleted: false
    };

    if (startDate || endDate) {
      matchStage.assignedAt = {};
      if (startDate) matchStage.assignedAt.$gte = new Date(startDate);
      if (endDate) matchStage.assignedAt.$lte = new Date(endDate);
    }

    const stats = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalAssigned: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [
                { $in: ['$status', ['delivered', 'pod-received', 'closed']] },
                1,
                0
              ]
            }
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
            }
          },
          avgResolutionTime: {
            $avg: {
              $subtract: ['$actualDeliveryTime', '$assignedAt']
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalAssigned: 0,
      completed: 0,
      cancelled: 0,
      avgResolutionTime: 0
    };

    return {
      staff: {
        name: staff.name,
        department: staff.department
      },
      period: { startDate, endDate },
      metrics: {
        ...result,
        completionRate: result.totalAssigned > 0
          ? (result.completed / result.totalAssigned) * 100
          : 0,
        avgResolutionTimeHours: result.avgResolutionTime
          ? result.avgResolutionTime / (1000 * 60 * 60)
          : 0
      }
    };
  }

  /**
   * Get team hierarchy
   * @param {string} managerId - Manager staff ID
   * @returns {Promise<Array>} Team members
   */
  static async getTeam(managerId) {
    const manager = await this._findStaffByStaffIdOrUserId(managerId);

    if (!manager) {
      throw new ApiError(404, 'Manager not found');
    }

    const team = await Staff.find({
      reportingManager: manager._id,
      isDeleted: false
    })
      .populate('user', 'email phone status')
      .select('name department title isActive performance assignedBookings');

    return team;
  }

  /**
   * Activate/Deactivate staff
   * @param {string} staffId - Staff ID
   * @param {boolean} isActive - Active status
   * @param {string} userId - User performing action
   * @returns {Promise<Object>} Updated staff
   */
  static async setActiveStatus(staffId, isActive, userId) {
    const staff = await Staff.findById(staffId);

    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    staff.isActive = isActive;
    staff.updatedBy = userId;
    await staff.save();

    // Update user status
    await User.findByIdAndUpdate(staff.user, {
      status: isActive ? 'active' : 'inactive'
    });

    // Notify staff
    await NotificationService.sendNotification({
      recipient: staff.user,
      type: isActive ? 'account_activated' : 'account_deactivated',
      title: isActive ? 'Account Activated' : 'Account Deactivated',
      message: isActive
        ? 'Your account has been activated'
        : 'Your account has been deactivated',
      entityType: 'staff',
      entityId: staff._id,
      channels: ['in-app']
    });

    return staff;
  }

  /**
   * Soft delete staff
   * @param {string} staffId - Staff ID
   * @param {string} deletedBy - User ID
   * @returns {Promise<Object>} Deleted staff
   */
  static async deleteStaff(staffId, deletedBy) {
    const staff = await Staff.findById(staffId);

    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    // Check for active assignments
    const activeAssignments = await Booking.countDocuments({
      assignedBy: staffId,
      status: { $nin: ['delivered', 'pod-received', 'closed', 'cancelled'] },
      isDeleted: false
    });

    if (activeAssignments > 0) {
      throw new ApiError(
        400,
        'Cannot delete staff with active booking assignments. Please reassign bookings first.'
      );
    }

    await staff.softDelete(deletedBy);

    // Audit log
    await AuditLog.create({
      user: deletedBy,
      action: 'DELETE_STAFF',
      entityType: 'staff',
      entityId: staff._id,
      changes: {
        before: staff.toObject(),
        after: { isDeleted: true }
      }
    });

    return staff;
  }
}

export default StaffService;
