import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import RoleTemplate from '../models/roleTemplate.model.js';
import Staff from '../models/staff.model.js';

// @desc    Get all role templates
// @route   GET /api/v1/role-templates
// @access  Super-admin
export const getRoleTemplates = asyncHandler(async (req, res) => {
  const { category, isActive } = req.query;
  
  const query = { isDeleted: false };
  if (category) query.category = category;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  const templates = await RoleTemplate.find(query)
    .populate('permissions', 'key name description resource action')
    .populate('employeeCount')
    .sort({ category: 1, templateName: 1 });
  
  res.json(
    new ApiResponse(200, templates, 'Role templates fetched successfully')
  );
});

// @desc    Get single role template
// @route   GET /api/v1/role-templates/:id
// @access  Super-admin
export const getRoleTemplate = asyncHandler(async (req, res) => {
  const template = await RoleTemplate.findOne({
    _id: req.params.id,
    isDeleted: false
  })
    .populate('permissions', 'key name description resource action')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
  
  if (!template) {
    throw new ApiError(404, 'Role template not found');
  }
  
  const employeeCount = await template.getEmployeeCount();
  
  res.json(
    new ApiResponse(200, { ...template.toObject(), employeeCount }, 'Role template fetched successfully')
  );
});

// @desc    Create role template
// @route   POST /api/v1/role-templates
// @access  Super-admin
export const createRoleTemplate = asyncHandler(async (req, res) => {
  const { templateName, description, permissions, category, isActive } = req.body;
  
  // Check if template with same name exists
  const existingTemplate = await RoleTemplate.findOne({
    templateName,
    isDeleted: false
  });
  
  if (existingTemplate) {
    throw new ApiError(400, 'Role template with this name already exists');
  }
  
  const template = await RoleTemplate.create({
    templateName,
    description,
    permissions,
    category,
    isActive,
    createdBy: req.user._id
  });
  
  await template.populate('permissions', 'key name description resource action');
  
  res.status(201).json(
    new ApiResponse(201, template, 'Role template created successfully')
  );
});

// @desc    Update role template
// @route   PATCH /api/v1/role-templates/:id
// @access  Super-admin
export const updateRoleTemplate = asyncHandler(async (req, res) => {
  const { templateName, description, permissions, category, isActive } = req.body;
  
  const template = await RoleTemplate.findOne({
    _id: req.params.id,
    isDeleted: false
  });
  
  if (!template) {
    throw new ApiError(404, 'Role template not found');
  }
  
  // Check if new name conflicts with existing template
  if (templateName && templateName !== template.templateName) {
    const existingTemplate = await RoleTemplate.findOne({
      templateName,
      isDeleted: false,
      _id: { $ne: template._id }
    });
    
    if (existingTemplate) {
      throw new ApiError(400, 'Role template with this name already exists');
    }
  }
  
  // Update fields
  if (templateName) template.templateName = templateName;
  if (description) template.description = description;
  if (permissions) template.permissions = permissions;
  if (category) template.category = category;
  if (isActive !== undefined) template.isActive = isActive;
  template.updatedBy = req.user._id;
  
  await template.save();
  
  // Auto-propagate permissions to all staff using this template
  const affectedCount = await Staff.updateMany(
    { roleTemplate: template._id, isDeleted: false },
    { $set: { permissions: template.permissions } }
  );
  
  await template.populate('permissions', 'key name description resource action');
  
  res.json(
    new ApiResponse(
      200, 
      { 
        template, 
        affectedEmployees: affectedCount.modifiedCount 
      }, 
      `Role template updated - ${affectedCount.modifiedCount} employees affected`
    )
  );
});

// @desc    Delete role template
// @route   DELETE /api/v1/role-templates/:id
// @access  Super-admin
export const deleteRoleTemplate = asyncHandler(async (req, res) => {
  const template = await RoleTemplate.findOne({
    _id: req.params.id,
    isDeleted: false
  });
  
  if (!template) {
    throw new ApiError(404, 'Role template not found');
  }
  
  // Check if template is in use
  const inUse = await template.isInUse();
  const employeeCount = await template.getEmployeeCount();
  
  if (inUse) {
    throw new ApiError(
      400, 
      `Cannot delete - ${employeeCount} employees using this template. Reassign them first.`
    );
  }
  
  await template.softDelete(req.user._id);
  
  res.json(
    new ApiResponse(200, null, 'Role template deleted successfully')
  );
});

// @desc    Get role template categories
// @route   GET /api/v1/role-templates/categories
// @access  Super-admin, Staff
export const getCategories = asyncHandler(async (req, res) => {
  const categories = [
    { value: 'operations', label: 'Operations' },
    { value: 'finance', label: 'Finance' },
    { value: 'support', label: 'Customer Support' },
    { value: 'management', label: 'Management' },
    { value: 'admin', label: 'Administration' },
    { value: 'custom', label: 'Custom' }
  ];
  
  res.json(
    new ApiResponse(200, categories, 'Categories fetched successfully')
  );
});
