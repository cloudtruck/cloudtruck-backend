import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import Branch from '../models/branch.model.js';
import Staff from '../models/staff.model.js';
import Vehicle from '../models/vehicle.model.js';

// @desc    Get all branches
// @route   GET /api/v1/branches
// @access  Super-admin
export const getBranches = asyncHandler(async (req, res) => {
  const { region, isActive } = req.query;
  
  const query = { isDeleted: false };
  if (region) query.region = region;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  const branches = await Branch.find(query)
    .populate('branchManager', 'name email phone department')
    .populate('employees', 'name email department')
    .populate('vehicles', 'vehicleNumber vehicleType')
    .sort({ region: 1, branchName: 1 });
  
  res.json(
    new ApiResponse(200, branches, 'Branches fetched successfully')
  );
});

// @desc    Get single branch
// @route   GET /api/v1/branches/:id
// @access  Super-admin
export const getBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findOne({
    _id: req.params.id,
    isDeleted: false
  })
    .populate('branchManager', 'name email phone department title')
    .populate('employees', 'name email phone department title')
    .populate('vehicles', 'vehicleNumber vehicleType bodyType')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
  
  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }
  
  res.json(
    new ApiResponse(200, branch, 'Branch fetched successfully')
  );
});

// @desc    Create branch
// @route   POST /api/v1/branches
// @access  Super-admin
export const createBranch = asyncHandler(async (req, res) => {
  const {
    branchCode,
    branchName,
    assignedCities,
    region,
    branchManager,
    address,
    contactDetails
  } = req.body;
  
  // Check if branch code already exists
  const existing = await Branch.findOne({
    branchCode,
    isDeleted: false
  });
  
  if (existing) {
    throw new ApiError(400, 'Branch with this code already exists');
  }
  
  // Check for city conflicts
  if (assignedCities && assignedCities.length > 0) {
    const conflicts = await Branch.checkCityConflict(assignedCities);
    if (conflicts) {
      throw new ApiError(
        400,
        `City conflict detected: ${conflicts.map(c => `${c.cities.join(', ')} already assigned to ${c.branch}`).join('; ')}`
      );
    }
  }
  
  const branch = await Branch.create({
    branchCode,
    branchName,
    assignedCities,
    region,
    branchManager,
    address,
    contactDetails,
    createdBy: req.user._id
  });
  
  await branch.populate('branchManager', 'name email phone department');
  
  res.status(201).json(
    new ApiResponse(201, branch, 'Branch created successfully')
  );
});

// @desc    Update branch
// @route   PATCH /api/v1/branches/:id
// @access  Super-admin
export const updateBranch = asyncHandler(async (req, res) => {
  const {
    branchCode,
    branchName,
    assignedCities,
    region,
    branchManager,
    address,
    contactDetails,
    isActive
  } = req.body;
  
  const branch = await Branch.findOne({
    _id: req.params.id,
    isDeleted: false
  });
  
  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }
  
  // Check if new branch code conflicts
  if (branchCode && branchCode !== branch.branchCode) {
    const existing = await Branch.findOne({
      branchCode,
      isDeleted: false,
      _id: { $ne: branch._id }
    });
    
    if (existing) {
      throw new ApiError(400, 'Branch with this code already exists');
    }
  }
  
  // Check for city conflicts
  if (assignedCities && assignedCities.length > 0) {
    const conflicts = await Branch.checkCityConflict(assignedCities, branch._id);
    if (conflicts) {
      throw new ApiError(
        400,
        `City conflict detected: ${conflicts.map(c => `${c.cities.join(', ')} already assigned to ${c.branch}`).join('; ')}`
      );
    }
  }
  
  if (branchCode) branch.branchCode = branchCode;
  if (branchName) branch.branchName = branchName;
  if (assignedCities) branch.assignedCities = assignedCities;
  if (region) branch.region = region;
  if (branchManager !== undefined) branch.branchManager = branchManager;
  if (address) branch.address = { ...branch.address, ...address };
  if (contactDetails) branch.contactDetails = { ...branch.contactDetails, ...contactDetails };
  if (isActive !== undefined) branch.isActive = isActive;
  branch.updatedBy = req.user._id;
  
  await branch.save();
  await branch.populate('branchManager', 'name email phone department');
  
  res.json(
    new ApiResponse(200, branch, 'Branch updated successfully')
  );
});

// @desc    Delete branch
// @route   DELETE /api/v1/branches/:id
// @access  Super-admin
export const deleteBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findOne({
    _id: req.params.id,
    isDeleted: false
  });
  
  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }
  
  // Check if branch has employees or vehicles
  if (branch.employees.length > 0) {
    throw new ApiError(400, `Cannot delete - branch has ${branch.employees.length} employees. Reassign them first.`);
  }
  
  if (branch.vehicles.length > 0) {
    throw new ApiError(400, `Cannot delete - branch has ${branch.vehicles.length} vehicles. Reassign them first.`);
  }
  
  await branch.softDelete(req.user._id);
  
  res.json(
    new ApiResponse(200, null, 'Branch deleted successfully')
  );
});

// @desc    Assign employee to branch
// @route   PATCH /api/v1/branches/:id/employees/:staffId
// @access  Super-admin
export const assignEmployee = asyncHandler(async (req, res) => {
  const { id, staffId } = req.params;
  
  const branch = await Branch.findOne({ _id: id, isDeleted: false });
  const staff = await Staff.findOne({ _id: staffId, isDeleted: false });
  
  if (!branch) throw new ApiError(404, 'Branch not found');
  if (!staff) throw new ApiError(404, 'Staff not found');
  
  // Update staff's branch
  staff.branch = branch._id;
  await staff.save();
  
  // Add to branch employees
  await branch.addEmployee(staffId);
  
  res.json(
    new ApiResponse(200, branch, 'Employee assigned to branch successfully')
  );
});

// @desc    Remove employee from branch
// @route   DELETE /api/v1/branches/:id/employees/:staffId
// @access  Super-admin
export const removeEmployee = asyncHandler(async (req, res) => {
  const { id, staffId } = req.params;
  
  const branch = await Branch.findOne({ _id: id, isDeleted: false });
  const staff = await Staff.findOne({ _id: staffId, isDeleted: false });
  
  if (!branch) throw new ApiError(404, 'Branch not found');
  if (!staff) throw new ApiError(404, 'Staff not found');
  
  // Update staff's branch
  staff.branch = null;
  await staff.save();
  
  // Remove from branch employees
  await branch.removeEmployee(staffId);
  
  res.json(
    new ApiResponse(200, branch, 'Employee removed from branch successfully')
  );
});

// @desc    Get branch performance metrics
// @route   GET /api/v1/branches/:id/metrics
// @access  Super-admin
export const getBranchMetrics = asyncHandler(async (req, res) => {
  const branch = await Branch.findOne({
    _id: req.params.id,
    isDeleted: false
  });
  
  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }
  
  res.json(
    new ApiResponse(200, branch.metrics, 'Branch metrics fetched successfully')
  );
});
