import mongoose from 'mongoose';
import Supplier from '../models/supplier.model.js';
import Driver from '../models/driver.model.js';
import Vehicle from '../models/vehicle.model.js';
import User from '../models/user.model.js';
import Booking from '../models/booking.model.js';
import AuditLog from '../models/auditLog.model.js';
import ApiError from '../utils/ApiError.js';
import cloudinary from '../config/cloudinary.js';

class SupplierService {
  /**
   * Create a supplier.
   *
   * company:    Creates a new User (role:'supplier') + Supplier record.
   * individual: Links an existing Driver record to a new Supplier record.
   *             No new User is created — the driver retains role:'driver' for mobile app access.
   */
  static async createSupplier(data, actorId) {
    const {
      supplierType,
      displayName,
      companyName,
      gstin,
      companyRegistrationNumber,
      panNumber,
      aadharNumber,
      driverId, // required for individual
      phone,
      email,
      city,
      bankDetails,
    } = data;

    if (supplierType === 'company') {
      // Check phone not already in use
      const existingUser = await User.findOne({ phone, isDeleted: false });
      if (existingUser) {
        throw new ApiError(409, 'Phone number already registered');
      }

      const user = await User.create({
        phone,
        email,
        role: 'supplier',
        status: 'pending-verification',
        createdBy: actorId,
      });

      const supplier = await Supplier.create({
        supplierType: 'company',
        user: user._id,
        displayName,
        companyName,
        gstin,
        companyRegistrationNumber,
        panNumber,
        aadharNumber,
        phone,
        email,
        city,
        bankDetails,
        createdBy: actorId,
      });

      await AuditLog.create({
        action: 'supplier.created',
        entity: 'Supplier',
        entityId: supplier._id,
        performedBy: actorId,
        changes: { supplierType, displayName, companyName },
      }).catch(() => null); // non-fatal

      return supplier;
    }

    // Individual supplier — links to existing Driver
    const driver = await Driver.findById(driverId);
    if (!driver || driver.isDeleted) {
      throw new ApiError(404, 'Driver not found');
    }
    if (driver.supplierOwner) {
      throw new ApiError(409, 'Driver is already linked to a supplier');
    }

    const existingSupplier = await Supplier.findOne({ driver: driverId, isDeleted: false });
    if (existingSupplier) {
      throw new ApiError(409, 'A supplier record already exists for this driver');
    }

    const supplier = await Supplier.create({
      supplierType: 'individual',
      driver: driverId,
      displayName,
      phone,
      email,
      city,
      bankDetails,
      createdBy: actorId,
    });

    // Link driver back to this supplier record
    await Driver.findByIdAndUpdate(driverId, {
      supplierOwner: supplier._id,
      driverRole: 'individual',
    });

    // Set supplierOwner on all vehicles owned by this driver
    await Vehicle.updateMany(
      { owner: driverId, isDeleted: false },
      { supplierOwner: supplier._id }
    );

    await AuditLog.create({
      action: 'supplier.created',
      entity: 'Supplier',
      entityId: supplier._id,
      performedBy: actorId,
      changes: { supplierType: 'individual', driverId, displayName },
    }).catch(() => null);

    return supplier;
  }

  /**
   * Get supplier by ID (Supplier._id).
   */
  static async getSupplierById(id) {
    const supplier = await Supplier.findOne({ _id: id, isDeleted: false })
      .populate('user', 'phone email status')
      .populate('driver', 'name licenseNumber availability')
      .populate('verifiedBy', 'name')
      .populate({
        path: 'documents.gstCertificate documents.companyRegistration documents.cancelledCheque documents.panDocument documents.aadharDocument',
        select: 'url format providerId resourceType bytes uploadedAt status originalName',
      });

    if (!supplier) throw new ApiError(404, 'Supplier not found');
    return supplier;
  }

  /**
   * Get paginated list of suppliers with filters.
   */
  static async getSuppliers(filters = {}, pagination = {}) {
    const {
      supplierType,
      verificationStatus,
      isBlacklisted,
      search,
      city,
    } = filters;

    const { page = 1, limit = 20, sort = '-createdAt' } = pagination;

    const query = { isDeleted: false };

    if (supplierType)       query.supplierType = supplierType;
    if (verificationStatus) query.verificationStatus = verificationStatus;
    if (city)               query.city = new RegExp(city, 'i');
    if (isBlacklisted !== undefined) query.isBlacklisted = isBlacklisted === 'true' || isBlacklisted === true;

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { displayName: regex },
        { companyName: regex },
        { phone: regex },
        { gstin: regex },
      ];
    }

    return Supplier.paginate(query, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'user', select: 'phone email status' },
        { path: 'driver', select: 'name licenseNumber availability' },
      ],
    });
  }

  /**
   * Update supplier fields (whitelisted).
   */
  static async updateSupplier(id, data, userId) {
    const supplier = await Supplier.findOne({ _id: id, isDeleted: false });
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    const allowed = ['displayName', 'companyName', 'gstin', 'companyRegistrationNumber', 'panNumber', 'aadharNumber', 'phone', 'email', 'city', 'bankDetails'];
    const updates = {};
    for (const key of allowed) {
      if (data[key] !== undefined) updates[key] = data[key];
    }
    updates.updatedBy = userId;

    Object.assign(supplier, updates);
    await supplier.save();

    await AuditLog.create({
      action: 'supplier.updated',
      entity: 'Supplier',
      entityId: supplier._id,
      performedBy: userId,
      changes: updates,
    }).catch(() => null);

    return supplier;
  }

  /** Add a bank account to the supplier's bankAccounts array. */
  static async addBankAccount(supplierId, data) {
    const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false }).select('+bankAccounts.accountNumber');
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    const isFirst = supplier.bankAccounts.length === 0;
    supplier.bankAccounts.push({
      accountNumber:     data.accountNumber,
      ifscCode:          data.ifscCode,
      accountHolderName: data.accountHolderName,
      bankName:          data.bankName,
      branchName:        data.branchName,
      isPrimary:         isFirst || !!data.isPrimary,
    });
    if (data.isPrimary) {
      supplier.bankAccounts.forEach((a, i) => {
        a.isPrimary = i === supplier.bankAccounts.length - 1;
      });
    }
    await supplier.save();
    return supplier;
  }

  /** Update a bank account entry. */
  static async updateBankAccount(supplierId, accountId, data) {
    const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false }).select('+bankAccounts.accountNumber');
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    const account = supplier.bankAccounts.id(accountId);
    if (!account) throw new ApiError(404, 'Bank account not found');

    if (data.accountNumber     !== undefined) account.accountNumber     = data.accountNumber;
    if (data.ifscCode          !== undefined) account.ifscCode          = data.ifscCode;
    if (data.accountHolderName !== undefined) account.accountHolderName = data.accountHolderName;
    if (data.bankName          !== undefined) account.bankName          = data.bankName;
    if (data.branchName        !== undefined) account.branchName        = data.branchName;
    if (data.isPrimary) {
      supplier.bankAccounts.forEach((a) => { a.isPrimary = false; });
      account.isPrimary = true;
    }
    await supplier.save();
    return supplier;
  }

  /** Remove a bank account entry. */
  static async removeBankAccount(supplierId, accountId) {
    const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false }).select('+bankAccounts.accountNumber');
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    const account = supplier.bankAccounts.id(accountId);
    if (!account) throw new ApiError(404, 'Bank account not found');

    const wasPrimary = account.isPrimary;
    account.deleteOne();
    if (wasPrimary && supplier.bankAccounts.length > 0) {
      supplier.bankAccounts[0].isPrimary = true;
    }
    await supplier.save();
    return supplier;
  }

  /**
   * Verify supplier — marks as verified, activates company User account.
   */
  static async verifySupplier(id, verifiedBy) {
    const supplier = await Supplier.findOne({ _id: id, isDeleted: false });
    if (!supplier) throw new ApiError(404, 'Supplier not found');
    if (supplier.verificationStatus === 'verified') {
      throw new ApiError(409, 'Supplier is already verified');
    }

    supplier.verificationStatus = 'verified';
    supplier.verifiedBy = verifiedBy;
    supplier.verifiedAt = new Date();
    supplier.rejectionReason = null;
    await supplier.save();

    // Activate company user account
    if (supplier.supplierType === 'company' && supplier.user) {
      await User.findByIdAndUpdate(supplier.user, { status: 'active' });
    }

    return supplier;
  }

  /**
   * Reject supplier verification.
   */
  static async rejectSupplier(id, reason, userId) {
    const supplier = await Supplier.findOne({ _id: id, isDeleted: false });
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    supplier.verificationStatus = 'rejected';
    supplier.rejectionReason = reason;
    supplier.updatedBy = userId;
    await supplier.save();

    return supplier;
  }

  /**
   * Blacklist supplier. For companies, also suspends all employee drivers.
   */
  static async blacklistSupplier(id, reason, userId) {
    const supplier = await Supplier.findOne({ _id: id, isDeleted: false });
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    await supplier.blacklist(reason, userId);

    if (supplier.supplierType === 'company') {
      await Driver.updateMany(
        { supplierOwner: supplier._id, isDeleted: false },
        { isApprovedBySupplier: false }
      );
    }

    return supplier;
  }

  /**
   * Remove supplier from blacklist.
   */
  static async removeFromBlacklist(id) {
    const supplier = await Supplier.findOne({ _id: id, isDeleted: false });
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    await supplier.removeFromBlacklist();

    // Re-approve employee drivers
    if (supplier.supplierType === 'company') {
      await Driver.updateMany(
        { supplierOwner: supplier._id, isDeleted: false },
        { isApprovedBySupplier: true }
      );
    }

    return supplier;
  }

  /**
   * Add an existing driver to a company's fleet.
   * Only valid for company suppliers.
   */
  static async addDriverToFleet(supplierId, driverId, actorId) {
    const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false });
    if (!supplier) throw new ApiError(404, 'Supplier not found');
    if (supplier.supplierType !== 'company') {
      throw new ApiError(400, 'Only company suppliers can have a fleet');
    }

    const driver = await Driver.findById(driverId);
    if (!driver || driver.isDeleted) throw new ApiError(404, 'Driver not found');
    if (driver.supplierOwner) {
      throw new ApiError(409, 'Driver is already attached to another supplier');
    }

    driver.supplierOwner = supplierId;
    driver.driverRole = 'employee';
    driver.isApprovedBySupplier = true;
    await driver.save();

    // Set supplierOwner on all vehicles owned by this driver
    await Vehicle.updateMany(
      { owner: driverId, isDeleted: false },
      { supplierOwner: supplierId }
    );

    // Increment fleet counters
    await Supplier.findByIdAndUpdate(supplierId, {
      $inc: {
        'fleetStats.totalDrivers': 1,
        'fleetStats.activeDrivers': driver.availability === 'available' ? 1 : 0,
      },
    });

    return driver;
  }

  /**
   * Remove a driver from a company's fleet.
   */
  static async removeDriverFromFleet(supplierId, driverId, actorId) {
    const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false });
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    const driver = await Driver.findOne({ _id: driverId, supplierOwner: supplierId });
    if (!driver) throw new ApiError(404, 'Driver not found in this fleet');

    const wasActive = driver.availability === 'available';

    driver.supplierOwner = null;
    driver.driverRole = 'individual';
    driver.isApprovedBySupplier = true;
    await driver.save();

    // Clear supplierOwner from driver's vehicles
    await Vehicle.updateMany(
      { owner: driverId, supplierOwner: supplierId },
      { supplierOwner: null }
    );

    // Decrement fleet counters
    await Supplier.findByIdAndUpdate(supplierId, {
      $inc: {
        'fleetStats.totalDrivers': -1,
        'fleetStats.activeDrivers': wasActive ? -1 : 0,
      },
    });

    return driver;
  }

  /**
   * Get paginated list of drivers in a supplier's fleet.
   */
  static async getFleetDrivers(supplierId, pagination = {}) {
    if (!supplierId) {
      return { data: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } };
    }
    const { page = 1, limit = 20, sort = '-createdAt' } = pagination;

    return Driver.paginate(
      { supplierOwner: supplierId, isDeleted: false },
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: [{ path: 'user', select: 'phone status' }],
      }
    );
  }

  /**
   * Get vehicles linked to a supplier.
   * Count is always derived live — no reliance on fleetStats.totalVehicles.
   */
  static async getFleetVehicles(supplierId, pagination = {}) {
    if (!supplierId) {
      return { data: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } };
    }
    const { page = 1, limit = 20, sort = '-createdAt' } = pagination;

    return Vehicle.paginate(
      { supplierOwner: supplierId, isDeleted: false },
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: [{ path: 'ownerRef.item', select: 'name phone displayName companyName' }],
      }
    );
  }

  static async addVehicleToFleet(supplierId, vehicleId, actorId) {
    const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false });
    if (!supplier) throw new ApiError(404, 'Supplier not found');
    if (supplier.supplierType !== 'company') {
      throw new ApiError(400, 'Only company suppliers can manage a vehicle fleet');
    }

    const vehicle = await Vehicle.findOne({ _id: vehicleId, isDeleted: false });
    if (!vehicle) throw new ApiError(404, 'Vehicle not found');
    if (vehicle.supplierOwner) {
      throw new ApiError(409, 'Vehicle is already assigned to a supplier');
    }

    vehicle.supplierOwner = supplierId;
    await vehicle.save();

    await AuditLog.create({
      action: 'supplier.vehicle.added',
      entity: 'Supplier',
      entityId: supplierId,
      performedBy: actorId,
      changes: { vehicleId },
    }).catch(() => null);

    return vehicle;
  }

  static async removeVehicleFromFleet(supplierId, vehicleId, actorId) {
    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      supplierOwner: supplierId,
      isDeleted: false,
    });
    if (!vehicle) throw new ApiError(404, 'Vehicle not found in this fleet');

    vehicle.supplierOwner = null;
    await vehicle.save();

    await AuditLog.create({
      action: 'supplier.vehicle.removed',
      entity: 'Supplier',
      entityId: supplierId,
      performedBy: actorId,
      changes: { vehicleId },
    }).catch(() => null);

    return vehicle;
  }

  /**
   * Get bookings assigned to a supplier.
   */
  static async getSupplierBookings(supplierId, filters = {}, pagination = {}) {
    const { page = 1, limit = 20, sort = '-createdAt', status } = { ...filters, ...pagination };

    const query = { supplierEntity: supplierId, isDeleted: false };
    if (status) query.status = status;

    return Booking.paginate(query, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'customer', select: 'companyName' },
        { path: 'driver', select: 'name phone' },
        { path: 'vehicle', select: 'vehicleNumber truckType' },
      ],
    });
  }

  /**
   * Get supplier dashboard summary.
   */
  static async getSupplierDashboard(supplierId) {
    const [supplier, vehicleCount, pendingPayments, bookingStats] = await Promise.all([
      Supplier.findById(supplierId).select('displayName companyName supplierType fleetStats performance'),
      Vehicle.countDocuments({ supplierOwner: supplierId, isDeleted: false }),
      // SupplierPayment import would create circular dep — query directly
      mongoose.model('SupplierPayment').countDocuments({ supplier: supplierId, status: 'pending' }),
      Booking.aggregate([
        { $match: { supplierEntity: new mongoose.Types.ObjectId(supplierId), isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    if (!supplier) throw new ApiError(404, 'Supplier not found');

    const statusCounts = bookingStats.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    return {
      supplier,
      vehicleCount,
      pendingPayments,
      bookingStatusCounts: statusCounts,
    };
  }

  /**
   * Upload a KYC document for a supplier and link it.
   */
  static async uploadSupplierDocument(supplierId, docType, file, userId) {
    const allowedDocTypes = ['gstCertificate', 'companyRegistration', 'cancelledCheque', 'panDocument', 'aadharDocument'];
    if (!allowedDocTypes.includes(docType)) {
      throw new ApiError(400, `Invalid document type. Allowed: ${allowedDocTypes.join(', ')}`);
    }

    const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false });
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    const Document = mongoose.model('Document');

    // Upload file buffer to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `cloudtruck/suppliers`,
          resource_type: 'auto',
          public_id: `supplier_${supplierId}_${docType}_${Date.now()}`,
        },
        (error, result) => {
          if (error) return reject(new ApiError(500, 'Failed to upload document to Cloudinary'));
          resolve(result);
        }
      );
      stream.end(file.buffer);
    });

    // Create Document record
    const doc = await Document.create({
      ownerRef: { kind: 'Supplier', item: supplierId },
      type: docType,
      url: uploadResult.secure_url,
      format: uploadResult.format,
      providerId: uploadResult.public_id,
      resourceType: uploadResult.resource_type,
      bytes: uploadResult.bytes,
      uploadedBy: userId,
    });

    // Link document to supplier
    supplier.documents[docType] = doc._id;
    // Mark documents as submitted if still pending
    if (supplier.verificationStatus === 'pending') {
      supplier.verificationStatus = 'documents-submitted';
    }
    supplier.updatedBy = userId;
    await supplier.save();

    return SupplierService.getSupplierById(supplierId);
  }

  /**
   * Soft delete a supplier. Company: also soft-deletes the linked User.
   */
  static async deleteSupplier(id, userId) {
    const supplier = await Supplier.findOne({ _id: id, isDeleted: false });
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    await supplier.softDelete(userId);

    if (supplier.supplierType === 'company' && supplier.user) {
      await User.findByIdAndUpdate(supplier.user, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      });
    }

    // Clear supplierOwner from all fleet vehicles when deleting a company supplier
    if (supplier.supplierType === 'company') {
      await Vehicle.updateMany(
        { supplierOwner: supplier._id },
        { supplierOwner: null }
      );
    }

    if (supplier.supplierType === 'individual' && supplier.driver) {
      // Detach driver from this supplier record
      await Driver.findByIdAndUpdate(supplier.driver, {
        supplierOwner: null,
        driverRole: 'individual',
      });
      await Vehicle.updateMany(
        { supplierOwner: supplier._id },
        { supplierOwner: null }
      );
    }

    return supplier;
  }

  /**
   * Get available drivers belonging to a supplier.
   * Filters: not offline, has at least one booking slot free, not blacklisted.
   */
  static async getAvailableDrivers(supplierId) {
    const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false }).lean();
    if (!supplier) throw new ApiError(404, 'Supplier not found');

    const drivers = await Driver.find({
      supplierOwner: supplierId,
      availability: { $ne: 'offline' },
      isBlacklisted: false,
      $or: [{ currentBooking: null }, { nextBooking: null }],
    })
      .select('name phone avatar availability currentBooking nextBooking vehicles licenseNumber')
      .populate('vehicles', 'vehicleNumber truckType availability')
      .lean();

    return drivers;
  }
}

export default SupplierService;
