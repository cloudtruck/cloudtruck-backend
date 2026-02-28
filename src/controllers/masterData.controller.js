import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import MasterData from '../models/masterData.model.js';
import DocumentService from '../services/document.service.js';

// @desc    Get all master data by category
// @route   GET /api/v1/master-data
// @access  Super-admin, Staff
export const getMasterData = asyncHandler(async (req, res) => {
  const { category, isActive } = req.query;
  
  const query = { isDeleted: false };
  if (category) query.category = category;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  const data = await MasterData.find(query)
    .sort({ category: 1, displayOrder: 1, displayName: 1 });
  
  res.json(
    new ApiResponse(200, data, 'Master data fetched successfully')
  );
});

// @desc    Get master data by category
// @route   GET /api/v1/master-data/category/:category
// @access  Super-admin, Staff
export const getMasterDataByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { includeInactive } = req.query;
  
  const data = await MasterData.findByCategory(category, includeInactive === 'true');
  
  res.json(
    new ApiResponse(200, data, `${category} data fetched successfully`)
  );
});

// @desc    Create master data
// @route   POST /api/v1/master-data
// @access  Super-admin
export const createMasterData = asyncHandler(async (req, res) => {
  let { category, key, displayName, description, metadata, displayOrder, isActive } = req.body;
  
  // Parse metadata if it's a string (happens with multipart/form-data)
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch (e) {
      metadata = {};
    }
  }

  // Check if key already exists in category
  const existing = await MasterData.findOne({
    category,
    key,
    isDeleted: false
  });
  
  if (existing) {
    throw new ApiError(400, `${key} already exists in ${category}`);
  }
  
  let imageUrl = undefined;
  if (req.file) {
    const uploadResult = await DocumentService.uploadDocument(
      req.file.path,
      'master-data',
      { entityType: 'master-data', entityId: key }
    );
    imageUrl = uploadResult.url;
  }

  const data = await MasterData.create({
    category,
    key,
    displayName,
    description,
    imageUrl,
    metadata,
    displayOrder,
    isActive,
    createdBy: req.user._id
  });
  
  res.status(201).json(
    new ApiResponse(201, data, 'Master data created successfully')
  );
});

// @desc    Update master data
// @route   PATCH /api/v1/master-data/:id
// @access  Super-admin
export const updateMasterData = asyncHandler(async (req, res) => {
  let { key, displayName, description, metadata, displayOrder, isActive } = req.body;
  
  // Parse metadata if it's a string (happens with multipart/form-data)
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch (e) {
      metadata = {};
    }
  }

  const data = await MasterData.findOne({
    _id: req.params.id,
    isDeleted: false
  });
  
  if (!data) {
    throw new ApiError(404, 'Master data not found');
  }
  
  // Check if new key conflicts
  if (key && key !== data.key) {
    const existing = await MasterData.findOne({
      category: data.category,
      key,
      isDeleted: false,
      _id: { $ne: data._id }
    });
    
    if (existing) {
      throw new ApiError(400, `${key} already exists in ${data.category}`);
    }
  }
  
  if (key) data.key = key;
  if (displayName) data.displayName = displayName;
  if (description !== undefined) data.description = description;
  if (metadata) data.metadata = metadata;
  if (displayOrder !== undefined) data.displayOrder = displayOrder;
  if (isActive !== undefined) data.isActive = isActive;

  if (req.file) {
    const uploadResult = await DocumentService.uploadDocument(
      req.file.path,
      'master-data',
      { entityType: 'master-data', entityId: data.key }
    );
    data.imageUrl = uploadResult.url;
  }

  data.updatedBy = req.user._id;
  
  await data.save();
  
  res.json(
    new ApiResponse(200, data, 'Master data updated successfully')
  );
});

// @desc    Update display order for multiple items
// @route   PATCH /api/v1/master-data/reorder
// @access  Super-admin
export const reorderMasterData = asyncHandler(async (req, res) => {
  const { items } = req.body; // Array of { id, displayOrder }
  
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Items array is required');
  }
  
  const updatePromises = items.map(item =>
    MasterData.findByIdAndUpdate(
      item.id,
      { displayOrder: item.displayOrder, updatedBy: req.user._id },
      { new: true }
    )
  );
  
  await Promise.all(updatePromises);
  
  res.json(
    new ApiResponse(200, null, 'Display order updated successfully')
  );
});

// @desc    Delete master data
// @route   DELETE /api/v1/master-data/:id
// @access  Super-admin
export const deleteMasterData = asyncHandler(async (req, res) => {
  const data = await MasterData.findOne({
    _id: req.params.id,
    isDeleted: false
  });
  
  if (!data) {
    throw new ApiError(404, 'Master data not found');
  }
  
  // Check if item is in use
  if (data.usageCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete - item is used in ${data.usageCount} records. Deactivate instead.`
    );
  }
  
  await data.softDelete(req.user._id);
  
  res.json(
    new ApiResponse(200, null, 'Master data deleted successfully')
  );
});

// @desc    Get master data categories
// @route   GET /api/v1/master-data/categories
// @access  Super-admin, Staff
export const getCategories = asyncHandler(async (req, res) => {
  const categories = [
    { value: 'truck-type', label: 'Truck Types', icon: 'truck' },
    { value: 'material-type', label: 'Material Types', icon: 'box' },
    { value: 'charge-type', label: 'Charge Types', icon: 'currency' },
    { value: 'body-type', label: 'Body Types', icon: 'cube' },
    { value: 'document-type', label: 'Document Types', icon: 'file' }
  ];
  
  res.json(
    new ApiResponse(200, categories, 'Categories fetched successfully')
  );
});
