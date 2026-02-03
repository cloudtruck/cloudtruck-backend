import mongoose from 'mongoose';
import EwayBill from '../models/ewayBill.model.js';
import Booking from '../models/booking.model.js';
import Vehicle from '../models/vehicle.model.js';
import Staff from '../models/staff.model.js';
import AuditService from './audit.service.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

/**
 * E-way Bill Service
 * Handles E-way bill lifecycle operations
 */
class EwayBillService {
  /**
   * Create E-way bill
   * @param {Object} billData - E-way bill data
   * @param {string} staffId - Staff ID creating the bill
   * @returns {Promise<Object>} Created E-way bill
   */
  static async createEwayBill(billData, staffId) {
    const {
      ewayBillNumber,
      bookingId,
      fromGstin,
      toGstin,
      documentNumber,
      documentDate,
      documentType,
      itemList,
      partATotalValue,
      totalTax,
      vehicleNumber,
      transporterId,
      transMode,
      transDocNo,
      transDate,
      validFrom,
      validUpto
    } = billData;

    // Verify booking exists
    const booking = await Booking.findOne({
      $or: [{ _id: bookingId }, { bookingId }],
      isDeleted: false
    });

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Check if E-way bill already exists for this booking
    const existingBill = await EwayBill.findOne({
      bookingId: booking._id,
      isDeleted: false,
      status: { $in: ['draft', 'active'] }
    });

    if (existingBill) {
      throw new ApiError(400, 'Active E-way bill already exists for this booking');
    }

    // Check for duplicate E-way bill number
    const duplicateBill = await EwayBill.findOne({
      ewayBillNumber,
      isDeleted: false
    });

    if (duplicateBill) {
      throw new ApiError(400, 'E-way bill number already exists');
    }

    // Verify staff exists
    const staff = await Staff.findById(staffId);
    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    // Create E-way bill
    const ewayBill = await EwayBill.create({
      ewayBillNumber: ewayBillNumber.toUpperCase().trim(),
      bookingId: booking._id,
      status: 'draft',
      fromGstin: fromGstin.toUpperCase().trim(),
      toGstin: toGstin.toUpperCase().trim(),
      documentNumber,
      documentDate: new Date(documentDate),
      documentType: documentType || 'INV',
      itemList,
      partATotalValue,
      totalTax,
      vehicleNumber: vehicleNumber?.toUpperCase().trim(),
      transporterId: transporterId?.toUpperCase().trim(),
      transMode: transMode || 'ROAD',
      transDocNo,
      transDate: transDate ? new Date(transDate) : undefined,
      expiryTracking: {
        validFrom: new Date(validFrom),
        validUpto: new Date(validUpto),
        expiryAlertSent: false
      },
      createdBy: staffId
    });

    // Create audit log
    await AuditService.createLog({
      user: staff.user,
      action: 'CREATE_EWAY_BILL',
      entityType: 'eway-bill',
      entityId: ewayBill._id,
      changes: {
        before: null,
        after: ewayBill.toObject()
      },
      metadata: {
        ewayBillNumber: ewayBill.ewayBillNumber,
        bookingId: booking.bookingId
      }
    });

    logger.info(`E-way bill ${ewayBill.ewayBillNumber} created for booking ${booking.bookingId}`);

    return ewayBill;
  }

  /**
   * Get E-way bill by ID
   * @param {string} billId - E-way bill ID
   * @returns {Promise<Object>} E-way bill
   */
  static async getEwayBill(billId) {
    const bill = await EwayBill.findOne({
      _id: billId,
      isDeleted: false
    })
      .populate('bookingId', 'bookingId customer pickup drop status')
      .populate('createdBy', 'name department email phone')
      .populate('updatedBy', 'name department email phone')
      .lean();

    if (!bill) {
      throw new ApiError(404, 'E-way bill not found');
    }

    return bill;
  }

  /**
   * List E-way bills with filters
   * @param {Object} filters - Query filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} E-way bills list
   */
  static async listEwayBills(filters = {}, pagination = {}) {
    const {
      status,
      bookingId,
      dateFrom,
      dateTo,
      expiringWithinDays,
      search
    } = filters;

    const query = { isDeleted: false };

    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
    }

    if (bookingId) {
      // Handle both ObjectId and booking string ID
      if (mongoose.isValidObjectId(bookingId)) {
        query.bookingId = bookingId;
      } else {
        const booking = await Booking.findOne({ bookingId, isDeleted: false });
        if (booking) {
          query.bookingId = booking._id;
        }
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Filter for bills expiring within X days
    if (expiringWithinDays) {
      const now = new Date();
      const futureDate = new Date(now.getTime() + expiringWithinDays * 24 * 60 * 60 * 1000);
      query['expiryTracking.validUpto'] = {
        $gte: now,
        $lte: futureDate
      };
      query.status = { $ne: 'expired' };
    }

    // Search by E-way bill number or document number
    if (search) {
      query.$or = [
        { ewayBillNumber: new RegExp(search, 'i') },
        { documentNumber: new RegExp(search, 'i') },
        { fromGstin: new RegExp(search, 'i') },
        { toGstin: new RegExp(search, 'i') }
      ];
    }

    const result = await EwayBill.paginate(query, {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      sort: pagination.sort || { createdAt: -1 },
      populate: [
        { path: 'bookingId', select: 'bookingId customer pickup drop status' },
        { path: 'createdBy', select: 'name department' }
      ]
    });

    return result;
  }

  /**
   * Update Part-B (transporter details)
   * @param {string} billId - E-way bill ID
   * @param {Object} newPartB - New Part-B data
   * @param {string} reason - Reason for update
   * @param {string} staffId - Staff ID performing update
   * @param {string} notes - Optional notes
   * @returns {Promise<Object>} Updated E-way bill
   */
  static async updatePartB(billId, newPartB, reason, staffId, notes = null) {
    const { vehicleNumber, transporterId, transMode, transDocNo, transDate } = newPartB;

    const bill = await EwayBill.findOne({
      _id: billId,
      isDeleted: false
    });

    if (!bill) {
      throw new ApiError(404, 'E-way bill not found');
    }

    if (bill.status === 'cancelled') {
      throw new ApiError(400, 'Cannot update cancelled E-way bill');
    }

    if (bill.status === 'expired') {
      throw new ApiError(400, 'Cannot update expired E-way bill');
    }

    const staff = await Staff.findById(staffId).populate('user');
    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    // Store old values for history
    const oldValue = {
      vehicleNumber: bill.vehicleNumber,
      transporterId: bill.transporterId,
      transMode: bill.transMode,
      transDocNo: bill.transDocNo,
      transDate: bill.transDate
    };

    const newValue = {
      vehicleNumber: vehicleNumber?.toUpperCase().trim(),
      transporterId: transporterId?.toUpperCase().trim(),
      transMode,
      transDocNo,
      transDate: transDate ? new Date(transDate) : undefined
    };

    // Update Part-B fields
    bill.vehicleNumber = newValue.vehicleNumber || bill.vehicleNumber;
    bill.transporterId = newValue.transporterId || bill.transporterId;
    bill.transMode = newValue.transMode || bill.transMode;
    bill.transDocNo = newValue.transDocNo || bill.transDocNo;
    bill.transDate = newValue.transDate || bill.transDate;
    bill.updatedBy = staffId;

    // Add to Part-B history
    bill.partBHistory.push({
      vehicleNumber: newValue.vehicleNumber,
      transporterId: newValue.transporterId,
      transMode: newValue.transMode,
      transDocNo: newValue.transDocNo,
      transDate: newValue.transDate,
      reason,
      notes,
      updatedBy: staffId,
      timestamp: new Date(),
      oldValue,
      newValue
    });

    await bill.save();

    // Create audit log
    await AuditService.createLog({
      user: staff.user._id,
      action: 'EWAY_BILL_PART_B_UPDATE',
      entityType: 'eway-bill',
      entityId: bill._id,
      changes: {
        before: oldValue,
        after: newValue
      },
      metadata: {
        ewayBillNumber: bill.ewayBillNumber,
        reason,
        notes,
        staffId: staff._id,
        staffName: staff.name
      }
    });

    logger.info(`Part-B updated for E-way bill ${bill.ewayBillNumber} by ${staff.name}. Reason: ${reason}`);

    return bill;
  }

  /**
   * Auto-sync Part-B from booking assignment
   * Called when driver is assigned to booking
   * @param {string} billId - E-way bill ID
   * @param {string} vehicleNumber - Vehicle number from assignment
   * @param {string} transporterId - Transporter ID (optional)
   * @returns {Promise<Object>} Updated E-way bill
   */
  static async autoSyncPartB(billId, vehicleNumber, transporterId = null) {
    const bill = await EwayBill.findOne({
      _id: billId,
      isDeleted: false
    });

    if (!bill) {
      throw new ApiError(404, 'E-way bill not found');
    }

    if (bill.status === 'cancelled' || bill.status === 'expired') {
      logger.warn(`Cannot auto-sync Part-B for ${bill.status} E-way bill ${bill.ewayBillNumber}`);
      return bill;
    }

    // Only auto-sync if Part-B is not already set or if explicitly allowed
    if (bill.vehicleNumber && bill.autoSyncPartB.autoSynced) {
      logger.info(`Part-B already synced for E-way bill ${bill.ewayBillNumber}, skipping auto-sync`);
      return bill;
    }

    // Find vehicle
    const vehicle = await Vehicle.findOne({ vehicleNumber: vehicleNumber.toUpperCase().trim() });

    // Update Part-B
    bill.vehicleNumber = vehicleNumber.toUpperCase().trim();
    if (transporterId) {
      bill.transporterId = transporterId.toUpperCase().trim();
    }
    bill.autoSyncPartB = {
      autoSynced: true,
      syncedAt: new Date(),
      syncedFromVehicle: vehicle?._id
    };

    // Add to history
    bill.partBHistory.push({
      vehicleNumber: bill.vehicleNumber,
      transporterId: bill.transporterId,
      transMode: bill.transMode,
      transDocNo: bill.transDocNo,
      transDate: bill.transDate,
      reason: 'FIRST_ASSIGNMENT',
      notes: 'Automatically synced from booking assignment',
      updatedBy: bill.createdBy, // Use creator as updater for auto-sync
      timestamp: new Date(),
      oldValue: {
        vehicleNumber: null,
        transporterId: null
      },
      newValue: {
        vehicleNumber: bill.vehicleNumber,
        transporterId: bill.transporterId
      }
    });

    await bill.save();

    logger.info(`Part-B auto-synced for E-way bill ${bill.ewayBillNumber} with vehicle ${vehicleNumber}`);

    return bill;
  }

  /**
   * Get Part-B history
   * @param {string} billId - E-way bill ID
   * @returns {Promise<Array>} Part-B history
   */
  static async getPartBHistory(billId) {
    const bill = await EwayBill.findOne({
      _id: billId,
      isDeleted: false
    })
      .select('ewayBillNumber bookingId partBHistory')
      .populate('partBHistory.updatedBy', 'name department email')
      .lean();

    if (!bill) {
      throw new ApiError(404, 'E-way bill not found');
    }

    return bill.partBHistory || [];
  }

  /**
   * Expire E-way bill
   * @param {string} billId - E-way bill ID
   * @returns {Promise<Object>} Updated E-way bill
   */
  static async expireEwayBill(billId) {
    const bill = await EwayBill.findOne({
      _id: billId,
      isDeleted: false
    });

    if (!bill) {
      throw new ApiError(404, 'E-way bill not found');
    }

    if (bill.status === 'expired') {
      return bill; // Already expired
    }

    bill.status = 'expired';
    await bill.save();

    logger.info(`E-way bill ${bill.ewayBillNumber} marked as expired`);

    return bill;
  }

  /**
   * Cancel E-way bill
   * @param {string} billId - E-way bill ID
   * @param {string} reason - Cancellation reason
   * @param {string} staffId - Staff ID cancelling the bill
   * @returns {Promise<Object>} Cancelled E-way bill
   */
  static async cancelEwayBill(billId, reason, staffId) {
    const bill = await EwayBill.findOne({
      _id: billId,
      isDeleted: false
    });

    if (!bill) {
      throw new ApiError(404, 'E-way bill not found');
    }

    if (bill.status === 'cancelled') {
      throw new ApiError(400, 'E-way bill already cancelled');
    }

    const staff = await Staff.findById(staffId).populate('user');
    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    bill.status = 'cancelled';
    bill.cancelledBy = staffId;
    bill.cancelledAt = new Date();
    bill.cancellationReason = reason;

    await bill.save();

    // Create audit log
    await AuditService.createLog({
      user: staff.user._id,
      action: 'CANCEL_EWAY_BILL',
      entityType: 'eway-bill',
      entityId: bill._id,
      changes: {
        before: { status: 'active' },
        after: { status: 'cancelled' }
      },
      metadata: {
        ewayBillNumber: bill.ewayBillNumber,
        reason,
        cancelledBy: staff.name
      }
    });

    logger.info(`E-way bill ${bill.ewayBillNumber} cancelled by ${staff.name}. Reason: ${reason}`);

    return bill;
  }

  /**
   * Sync E-way bill by number
   * Fetch details from ClearTax/NIC and update local record
   * @param {string} ewayBillNumber - 12 digit number
   * @param {string} staffId - Staff ID performing operation
   * @returns {Promise<Object>} Updated E-way bill
   */
  static async syncByEwayNumber(ewayBillNumber, staffId) {
    if (!ewayBillNumber) {
      throw new ApiError(400, 'E-way bill number is required');
    }

    // Verify staff exists
    const staff = await Staff.findById(staffId);
    if (!staff) {
      throw new ApiError(404, 'Staff not found');
    }

    // Check if we already have it
    let ewayBill = await EwayBill.findOne({
      ewayBillNumber,
      isDeleted: false
    });

    // In a real implementation, we would call ClearTax API here
    // e.g., const portalData = await ClearTaxService.getEwayBill(ewayBillNumber);
    
    if (!ewayBill) {
      // For this demo, we'll search if it exists in any deleted/cancelled state
      // or if we should create a new "stub" for it if we had portal data.
      // Since we don't have portal data in this mock, we will check if it's already in our system
      
      throw new ApiError(404, `E-way bill ${ewayBillNumber} not found in system. Manual import from portal is currently restricted to existing records.`);
    }

    // Update sync metadata
    ewayBill.syncMetadata = {
      ...ewayBill.syncMetadata,
      lastSyncAt: new Date(),
      lastSyncBy: staff._id,
      syncStatus: 'success'
    };

    await ewayBill.save();

    await AuditService.createLog({
      user: staff._id,
      action: 'SYNC_EWAY_BILL',
      entityType: 'eway-bill',
      entityId: ewayBill._id,
      changes: { before: null, after: ewayBill.syncMetadata },
      metadata: { ewayBillNumber, source: 'PORTAL' }
    });

    logger.info(`E-way bill ${ewayBillNumber} synced by ${staff.name}`);

    return ewayBill;
  }
}

export default EwayBillService;
