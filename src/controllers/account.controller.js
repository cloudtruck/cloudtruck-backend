import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import Account from '../models/account.model.js';

// @desc    Get all accounts
// @route   GET /api/v1/accounts
// @access  Super-admin
export const getAccounts = asyncHandler(async (req, res) => {
  const { isActive } = req.query;
  
  const query = { isDeleted: false };
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  const accounts = await Account.find(query)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .sort({ isPrimary: -1, createdAt: -1 });
  
  res.json(
    new ApiResponse(200, accounts, 'Accounts fetched successfully')
  );
});

// @desc    Get single account
// @route   GET /api/v1/accounts/:id
// @access  Super-admin
export const getAccount = asyncHandler(async (req, res) => {
  const account = await Account.findOne({
    _id: req.params.id,
    isDeleted: false
  })
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
  
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }
  
  res.json(
    new ApiResponse(200, account, 'Account fetched successfully')
  );
});

// @desc    Get primary account
// @route   GET /api/v1/accounts/primary
// @access  Super-admin, Staff
export const getPrimaryAccount = asyncHandler(async (req, res) => {
  const account = await Account.getPrimary();
  
  if (!account) {
    throw new ApiError(404, 'No primary account set');
  }
  
  res.json(
    new ApiResponse(200, account, 'Primary account fetched successfully')
  );
});

// @desc    Create account
// @route   POST /api/v1/accounts
// @access  Super-admin
export const createAccount = asyncHandler(async (req, res) => {
  const {
    accountNumber,
    ifscCode,
    accountHolderName,
    bankName,
    branchName,
    accountType,
    isPrimary,
    upiId,
    swiftCode
  } = req.body;
  
  // Check if account number already exists
  const existing = await Account.findOne({
    accountNumber,
    isDeleted: false
  });
  
  if (existing) {
    throw new ApiError(400, 'Account with this number already exists');
  }
  
  const account = await Account.create({
    accountNumber,
    ifscCode,
    accountHolderName,
    bankName,
    branchName,
    accountType,
    isPrimary,
    upiId,
    swiftCode,
    createdBy: req.user._id
  });
  
  res.status(201).json(
    new ApiResponse(201, account, 'Account created successfully')
  );
});

// @desc    Update account
// @route   PATCH /api/v1/accounts/:id
// @access  Super-admin
export const updateAccount = asyncHandler(async (req, res) => {
  const {
    accountNumber,
    ifscCode,
    accountHolderName,
    bankName,
    branchName,
    accountType,
    isPrimary,
    isActive,
    upiId,
    swiftCode
  } = req.body;
  
  const account = await Account.findOne({
    _id: req.params.id,
    isDeleted: false
  });
  
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }
  
  // Check if new account number conflicts
  if (accountNumber && accountNumber !== account.accountNumber) {
    const existing = await Account.findOne({
      accountNumber,
      isDeleted: false,
      _id: { $ne: account._id }
    });
    
    if (existing) {
      throw new ApiError(400, 'Account with this number already exists');
    }
  }
  
  if (accountNumber) account.accountNumber = accountNumber;
  if (ifscCode) account.ifscCode = ifscCode;
  if (accountHolderName) account.accountHolderName = accountHolderName;
  if (bankName) account.bankName = bankName;
  if (branchName !== undefined) account.branchName = branchName;
  if (accountType) account.accountType = accountType;
  if (isPrimary !== undefined) account.isPrimary = isPrimary;
  if (isActive !== undefined) account.isActive = isActive;
  if (upiId !== undefined) account.upiId = upiId;
  if (swiftCode !== undefined) account.swiftCode = swiftCode;
  account.updatedBy = req.user._id;
  
  await account.save();
  
  res.json(
    new ApiResponse(200, account, 'Account updated successfully')
  );
});

// @desc    Set primary account
// @route   PATCH /api/v1/accounts/:id/primary
// @access  Super-admin
export const setPrimaryAccount = asyncHandler(async (req, res) => {
  const account = await Account.findOne({
    _id: req.params.id,
    isDeleted: false
  });
  
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }
  
  if (!account.isActive) {
    throw new ApiError(400, 'Cannot set inactive account as primary');
  }
  
  await account.makePrimary();
  
  res.json(
    new ApiResponse(200, account, 'Primary account updated successfully')
  );
});

// @desc    Delete account
// @route   DELETE /api/v1/accounts/:id
// @access  Super-admin
export const deleteAccount = asyncHandler(async (req, res) => {
  const account = await Account.findOne({
    _id: req.params.id,
    isDeleted: false
  });
  
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }
  
  if (account.isPrimary) {
    throw new ApiError(400, 'Cannot delete primary account. Set another account as primary first.');
  }
  
  await account.softDelete(req.user._id);
  
  res.json(
    new ApiResponse(200, null, 'Account deleted successfully')
  );
});
