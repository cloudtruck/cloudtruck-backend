import StaffService from '../services/staff.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Create Staff Profile
 * POST /api/v1/staff
 */
export const createStaff = asyncHandler(async (req, res) => {
  const staffData = req.body;
  const createdBy = req.user._id;

  const staff = await StaffService.createStaff(staffData, createdBy);

  return res.status(201).json(
    new ApiResponse(201, staff, 'Staff profile created successfully')
  );
});

/**
 * Get Staff by ID
 * GET /api/v1/staff/:id
 */
export const getStaffById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const staff = await StaffService.getStaffById(id);

  return res.status(200).json(
    new ApiResponse(200, staff, 'Staff fetched successfully')
  );
});

/**
 * Get All Staff
 * GET /api/v1/staff
 */
export const getAllStaff = asyncHandler(async (req, res) => {
  const { department, isActive, reportingManager, search, page, limit, sort } = req.query;

  const filters = {
    department,
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    reportingManager,
    search
  };

  const pagination = { page, limit, sort };

  const result = await StaffService.getStaff(filters, pagination);

  return res.status(200).json(
    new ApiResponse(200, result, 'Staff fetched successfully')
  );
});

/**
 * Update Staff Profile
 * PATCH /api/v1/staff/:id
 */
export const updateStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userId = req.user._id;

  const staff = await StaffService.updateStaff(id, updateData, userId);

  return res.status(200).json(
    new ApiResponse(200, staff, 'Staff updated successfully')
  );
});

/**
 * Assign Permissions to Staff
 * POST /api/v1/staff/:id/permissions
 */
export const assignPermissions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permissionIds } = req.body;
  const userId = req.user._id;

  const staff = await StaffService.assignPermissions(id, permissionIds, userId);

  return res.status(200).json(
    new ApiResponse(200, staff, 'Permissions assigned successfully')
  );
});

/**
 * Check Staff Permission
 * GET /api/v1/staff/:id/has-permission/:permissionKey
 */
export const hasPermission = asyncHandler(async (req, res) => {
  const { id, permissionKey } = req.params;

  const hasPermission = await StaffService.hasPermission(id, permissionKey);

  return res.status(200).json(
    new ApiResponse(200, { hasPermission }, 'Permission checked successfully')
  );
});

/**
 * Get Staff Workload
 * GET /api/v1/staff/:id/workload
 */
export const getWorkload = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const workload = await StaffService.getWorkload(id);

  return res.status(200).json(
    new ApiResponse(200, workload, 'Workload fetched successfully')
  );
});

/**
 * Get My Workload (Staff)
 * GET /api/v1/staff/my-workload
 */
export const getMyWorkload = asyncHandler(async (req, res) => {
  const staffId = req.user._id;

  const workload = await StaffService.getWorkload(staffId);

  return res.status(200).json(
    new ApiResponse(200, workload, 'Workload fetched successfully')
  );
});

/**
 * Get Staff Performance Metrics
 * GET /api/v1/staff/:id/performance
 */
export const getPerformanceMetrics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const dateRange = { startDate, endDate };

  const metrics = await StaffService.getPerformanceMetrics(id, dateRange);

  return res.status(200).json(
    new ApiResponse(200, metrics, 'Performance metrics fetched successfully')
  );
});

/**
 * Get My Performance (Staff)
 * GET /api/v1/staff/my-performance
 */
export const getMyPerformance = asyncHandler(async (req, res) => {
  const staffId = req.user._id;
  const { startDate, endDate } = req.query;

  const dateRange = { startDate, endDate };

  const metrics = await StaffService.getPerformanceMetrics(staffId, dateRange);

  return res.status(200).json(
    new ApiResponse(200, metrics, 'Performance metrics fetched successfully')
  );
});

/**
 * Get Team Members
 * GET /api/v1/staff/:id/team
 */
export const getTeam = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const team = await StaffService.getTeam(id);

  return res.status(200).json(
    new ApiResponse(200, team, 'Team members fetched successfully')
  );
});

/**
 * Get My Team (Manager)
 * GET /api/v1/staff/my-team
 */
export const getMyTeam = asyncHandler(async (req, res) => {
  const managerId = req.user._id;

  const team = await StaffService.getTeam(managerId);

  return res.status(200).json(
    new ApiResponse(200, team, 'Team members fetched successfully')
  );
});

/**
 * Activate/Deactivate Staff
 * PATCH /api/v1/staff/:id/active-status
 */
export const setActiveStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const userId = req.user._id;

  const staff = await StaffService.setActiveStatus(id, isActive, userId);

  return res.status(200).json(
    new ApiResponse(200, staff, 'Active status updated successfully')
  );
});

/**
 * Delete Staff
 * DELETE /api/v1/staff/:id
 */
export const deleteStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deletedBy = req.user._id;

  const staff = await StaffService.deleteStaff(id, deletedBy);

  return res.status(200).json(
    new ApiResponse(200, staff, 'Staff deleted successfully')
  );
});

/**
 * Get My Profile (Staff)
 * GET /api/v1/staff/my-profile
 */
export const getMyProfile = asyncHandler(async (req, res) => {
  const staffId = req.user._id;

  const staff = await StaffService.getStaffById(staffId);

  return res.status(200).json(
    new ApiResponse(200, staff, 'Profile fetched successfully')
  );
});
