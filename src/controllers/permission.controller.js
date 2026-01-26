import PermissionService from '../services/permission.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Get all permissions
 * @route GET /api/v1/permissions
 * @access Private (requires authentication)
 */
export const getAllPermissions = asyncHandler(async (req, res) => {
  const { resource, action, isActive } = req.query;

  const filters = {};
  if (resource) filters.resource = resource;
  if (action) filters.action = action;
  if (isActive !== undefined) filters.isActive = isActive === 'true';

  const permissions = await PermissionService.getAllPermissions(filters);

  return res
    .status(200)
    .json(new ApiResponse(true, permissions, 'Permissions fetched successfully'));
});

/**
 * Get permission by ID
 * @route GET /api/v1/permissions/:id
 * @access Private
 */
export const getPermissionById = asyncHandler(async (req, res) => {
  const permission = await PermissionService.getPermissionById(req.params.id);

  return res
    .status(200)
    .json(new ApiResponse(true, permission, 'Permission fetched successfully'));
});

/**
 * Create new permission
 * @route POST /api/v1/permissions
 * @access Private (requires admin)
 */
export const createPermission = asyncHandler(async (req, res) => {
  const permission = await PermissionService.createPermission(req.body, req.user._id);

  return res
    .status(201)
    .json(new ApiResponse(true, permission, 'Permission created successfully'));
});

/**
 * Update permission
 * @route PUT /api/v1/permissions/:id
 * @access Private (requires admin)
 */
export const updatePermission = asyncHandler(async (req, res) => {
  const permission = await PermissionService.updatePermission(
    req.params.id,
    req.body,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(true, permission, 'Permission updated successfully'));
});

/**
 * Delete permission (soft delete)
 * @route DELETE /api/v1/permissions/:id
 * @access Private (requires admin)
 */
export const deletePermission = asyncHandler(async (req, res) => {
  await PermissionService.deletePermission(req.params.id, req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(true, null, 'Permission deleted successfully'));
});

/**
 * Get permissions grouped by resource
 * @route GET /api/v1/permissions/grouped
 * @access Private
 */
export const getGroupedPermissions = asyncHandler(async (req, res) => {
  const groupedPermissions = await PermissionService.getPermissionsGroupedByResource();

  return res
    .status(200)
    .json(new ApiResponse(true, groupedPermissions, 'Grouped permissions fetched successfully'));
});
