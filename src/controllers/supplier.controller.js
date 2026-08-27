import SupplierService from '../services/supplier.service.js';
import Supplier from '../models/supplier.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Normalize a Supplier document for API responses.
 * Masks bank account number to last 4 digits.
 */
export function mapSupplier(s) {
  const obj = s.toObject ? s.toObject() : s;
  return {
    _id:                       obj._id,
    supplierType:              obj.supplierType,
    displayName:               obj.displayName,
    companyName:               obj.companyName || null,
    gstin:                     obj.gstin || null,
    companyRegistrationNumber: obj.companyRegistrationNumber || null,
    panNumber:                 obj.panNumber || null,
    aadharNumber:              obj.aadharNumber || null,
    phone:                     obj.phone,
    email:                     obj.email || null,
    city:                      obj.city || null,
    user:                      obj.user || null,
    driver:                    obj.driver || null,
    verificationStatus:        obj.verificationStatus,
    verifiedBy:                obj.verifiedBy || null,
    verifiedAt:                obj.verifiedAt || null,
    rejectionReason:           obj.rejectionReason || null,
    documents:                 obj.documents || null,
    bankDetails: obj.bankDetails
      ? {
          accountNumber: obj.bankDetails.accountNumber
            ? `****${String(obj.bankDetails.accountNumber).slice(-4)}`
            : null,
          ifscCode:          obj.bankDetails.ifscCode || null,
          accountHolderName: obj.bankDetails.accountHolderName || null,
          bankName:          obj.bankDetails.bankName || null,
        }
      : null,
    bankAccounts: (obj.bankAccounts || []).map((a) => ({
      _id:               a._id,
      accountNumber:     a.accountNumber ? `****${String(a.accountNumber).slice(-4)}` : null,
      ifscCode:          a.ifscCode || null,
      accountHolderName: a.accountHolderName || null,
      bankName:          a.bankName || null,
      branchName:        a.branchName || null,
      isPrimary:         !!a.isPrimary,
    })),
    fleetStats:      obj.fleetStats,
    performance:     obj.performance,
    isBlacklisted:   obj.isBlacklisted,
    blacklistReason: obj.blacklistReason || null,
    isDeleted:       obj.isDeleted,
    createdAt:       obj.createdAt,
    updatedAt:       obj.updatedAt,
  };
}

export const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await SupplierService.createSupplier({ ...req.body, supplierType: 'company' }, req.user._id);
  res.status(201).json(new ApiResponse(201, mapSupplier(supplier), 'Supplier created'));
});

export const getAllSuppliers = asyncHandler(async (req, res) => {
  const { supplierType, verificationStatus, isBlacklisted, search, city, page, limit, sort } = req.query;
  const result = await SupplierService.getSuppliers(
    { supplierType, verificationStatus, isBlacklisted, search, city },
    { page, limit, sort }
  );
  res.json(new ApiResponse(200, {
    items: result.data.map(mapSupplier),
    pagination: {
      total: result.pagination.total,
      page:  result.pagination.page,
      limit: result.pagination.limit,
      pages: result.pagination.pages,
    },
  }));
});

export const getSupplierById = asyncHandler(async (req, res) => {
  const supplier = await SupplierService.getSupplierById(req.params.id);
  res.json(new ApiResponse(200, mapSupplier(supplier)));
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await SupplierService.updateSupplier(req.params.id, req.body, req.user._id);
  res.json(new ApiResponse(200, mapSupplier(supplier), 'Supplier updated'));
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  await SupplierService.deleteSupplier(req.params.id, req.user._id);
  res.json(new ApiResponse(200, null, 'Supplier deleted'));
});

export const verifySupplier = asyncHandler(async (req, res) => {
  const supplier = await SupplierService.verifySupplier(req.params.id, req.user._id);
  res.json(new ApiResponse(200, mapSupplier(supplier), 'Supplier verified'));
});

export const rejectSupplier = asyncHandler(async (req, res) => {
  const supplier = await SupplierService.rejectSupplier(req.params.id, req.body.reason, req.user._id);
  res.json(new ApiResponse(200, mapSupplier(supplier), 'Supplier rejected'));
});

export const blacklistSupplier = asyncHandler(async (req, res) => {
  const supplier = await SupplierService.blacklistSupplier(req.params.id, req.body.reason, req.user._id);
  res.json(new ApiResponse(200, mapSupplier(supplier), 'Supplier blacklisted'));
});

export const removeFromBlacklist = asyncHandler(async (req, res) => {
  const supplier = await SupplierService.removeFromBlacklist(req.params.id);
  res.json(new ApiResponse(200, mapSupplier(supplier), 'Supplier removed from blacklist'));
});

export const addDriverToFleet = asyncHandler(async (req, res) => {
  const driver = await SupplierService.addDriverToFleet(req.params.id, req.body, req.user._id);
  res.json(new ApiResponse(200, driver, 'Driver added to fleet'));
});

export const addMyFleetDriver = asyncHandler(async (req, res) => {
  const supplierId = await resolveSupplierId(req);
  if (!supplierId) throw new ApiError(404, 'Supplier profile not found');
  const driver = await SupplierService.addDriverToFleet(supplierId, req.body, req.user._id);
  res.status(201).json(new ApiResponse(201, driver, 'Driver added to fleet successfully'));
});

export const addMyFleetVehicle = asyncHandler(async (req, res) => {
  const supplierId = await resolveSupplierId(req);
  if (!supplierId) throw new ApiError(404, 'Supplier profile not found');
  const vehicle = await SupplierService.createFleetVehicle(supplierId, req.body, req.user._id);
  res.status(201).json(new ApiResponse(201, vehicle, 'Vehicle added to fleet successfully'));
});

export const removeDriverFromFleet = asyncHandler(async (req, res) => {
  await SupplierService.removeDriverFromFleet(req.params.id, req.params.driverId, req.user._id);
  res.json(new ApiResponse(200, null, 'Driver removed from fleet'));
});

export const addVehicleToFleet = asyncHandler(async (req, res) => {
  const vehicle = await SupplierService.addVehicleToFleet(req.params.id, req.body.vehicleId, req.user._id);
  res.json(new ApiResponse(200, vehicle, 'Vehicle added to fleet'));
});

export const removeVehicleFromFleet = asyncHandler(async (req, res) => {
  await SupplierService.removeVehicleFromFleet(req.params.id, req.params.vehicleId, req.user._id);
  res.json(new ApiResponse(200, null, 'Vehicle removed from fleet'));
});

const resolveSupplierId = async (req) => {
  if (req.params.id) return req.params.id;
  if (req.supplier?._id) return req.supplier._id;
  if (req.user?._id) {
    const supplier = await Supplier.findOne({ user: req.user._id, isDeleted: false });
    return supplier?._id || null;
  }
  return null;
};

export const getFleetDrivers = asyncHandler(async (req, res) => {
  const supplierId = await resolveSupplierId(req);
  const result = await SupplierService.getFleetDrivers(supplierId, req.query);
  res.json(new ApiResponse(200, {
    items: result.data,
    pagination: { total: result.pagination.total, page: result.pagination.page, limit: result.pagination.limit, pages: result.pagination.pages },
  }));
});

export const getFleetVehicles = asyncHandler(async (req, res) => {
  const supplierId = await resolveSupplierId(req);
  const result = await SupplierService.getFleetVehicles(supplierId, req.query);
  res.json(new ApiResponse(200, {
    items: result.data,
    pagination: { total: result.pagination.total, page: result.pagination.page, limit: result.pagination.limit, pages: result.pagination.pages },
  }));
});

export const getSupplierBookings = asyncHandler(async (req, res) => {
  const supplierId = await resolveSupplierId(req);
  const result = await SupplierService.getSupplierBookings(supplierId, req.query, req.query);
  res.json(new ApiResponse(200, {
    items: result.data,
    pagination: { total: result.pagination.total, page: result.pagination.page, limit: result.pagination.limit, pages: result.pagination.pages },
  }));
});

export const getSupplierDashboard = asyncHandler(async (req, res) => {
  const supplierId = await resolveSupplierId(req);
  if (!supplierId) throw new ApiError(404, 'Supplier profile not found');
  const dashboard = await SupplierService.getSupplierDashboard(supplierId);
  res.json(new ApiResponse(200, dashboard));
});

// Self-service: company owner views/edits own profile
export const getMyProfile = asyncHandler(async (req, res) => {
  let supplier = await Supplier.findOne({ user: req.user._id, isDeleted: false })
    .populate('user', 'phone email status')
    .populate('driver', 'name licenseNumber availability')
    .populate('verifiedBy', 'name');

  if (!supplier && req.user?.role === 'supplier') {
    supplier = await Supplier.create({
      user: req.user._id,
      supplierType: 'company',
      displayName: 'New Fleet Owner',
      phone: req.user.phone,
      createdBy: req.user._id,
    });
    supplier = await Supplier.findById(supplier._id)
      .populate('user', 'phone email status')
      .populate('driver', 'name licenseNumber availability')
      .populate('verifiedBy', 'name');
  }

  if (!supplier) throw new ApiError(404, 'Supplier profile not found');
  res.json(new ApiResponse(200, mapSupplier(supplier)));
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  let supplier = await Supplier.findOne({ user: req.user._id, isDeleted: false });

  if (!supplier && req.user?.role === 'supplier') {
    supplier = await Supplier.create({
      user: req.user._id,
      supplierType: 'company',
      displayName: req.body.companyName || 'New Fleet Owner',
      phone: req.user.phone,
      createdBy: req.user._id,
    });
  }

  if (!supplier) throw new ApiError(404, 'Supplier profile not found');
  const updated = await SupplierService.updateSupplier(supplier._id, req.body, req.user._id);
  res.json(new ApiResponse(200, mapSupplier(updated), 'Profile updated'));
});

export const uploadSupplierDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded');
  const supplier = await SupplierService.uploadSupplierDocument(
    req.params.id,
    req.params.docType,
    req.file,
    req.user._id
  );
  res.json(new ApiResponse(200, mapSupplier(supplier), 'Document uploaded'));
});

// ── Bank Account CRUD ─────────────────────────────────────────────────────────

export const getAvailableDrivers = asyncHandler(async (req, res) => {
  const drivers = await SupplierService.getAvailableDrivers(req.params.id);
  res.json(new ApiResponse(200, drivers, 'Available drivers fetched'));
});

export const addBankAccount = asyncHandler(async (req, res) => {
  const supplier = await SupplierService.addBankAccount(req.params.id, req.body);
  res.status(201).json(new ApiResponse(201, mapSupplier(supplier), 'Bank account added'));
});

export const updateBankAccount = asyncHandler(async (req, res) => {
  const supplier = await SupplierService.updateBankAccount(req.params.id, req.params.accountId, req.body);
  res.json(new ApiResponse(200, mapSupplier(supplier), 'Bank account updated'));
});

export const removeBankAccount = asyncHandler(async (req, res) => {
  const supplier = await SupplierService.removeBankAccount(req.params.id, req.params.accountId);
  res.json(new ApiResponse(200, mapSupplier(supplier), 'Bank account removed'));
});
