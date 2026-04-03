import BookingService from '../services/booking.service.js';
import Driver from '../models/driver.model.js';
import Booking from '../models/booking.model.js';
import Vehicle from '../models/vehicle.model.js';
import MasterData from '../models/masterData.model.js';
import AuditLog from '../models/auditLog.model.js';
import TrackingService from '../services/tracking.service.js';
import PDFService from '../services/pdf.service.js';
import cloudinary from '../config/cloudinary.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

/**
 * Create Booking
 * POST /api/v1/bookings
 */
export const createBooking = asyncHandler(async (req, res) => {
  const bookingData = req.body;
  const userId = req.user._id;
  const files = req.files; // multer parsed files (cargoImages)

  const booking = await BookingService.createBooking(bookingData, userId, files);

  return res.status(201).json(
    new ApiResponse(201, booking, 'Booking created successfully')
  );
});

/**
 * Get Truck Types
 * GET /api/v1/bookings/truck-types
 */
export const getTruckTypes = asyncHandler(async (req, res) => {
  const truckTypes = await MasterData.findByCategory('truck-type');

  const data = truckTypes.map(t => ({
    key: t.key,
    displayName: t.displayName,
    displayOrder: t.displayOrder,
    imageUrl: t.imageUrl,
    description: t.description
  }));

  return res.status(200).json(
    new ApiResponse(200, data, 'Truck types fetched successfully')
  );
});

/**
 * Get All Bookings
 * GET /api/v1/bookings
 */
// Helper: normalize booking document to frontend Booking shape
export const mapBooking = (b) => {
  const bk = b.toObject ? b.toObject() : b;
  return {
    _id: bk._id,
    bookingId: bk.bookingId,
    customer: bk.customer ? {
      _id: bk.customer._id || bk.customer,
      companyName: bk.customer.companyName,
      phone: bk.customer.phone,
      contactPerson: bk.customer.contactPerson
    } : null,
    pickup: {
      city: bk.pickup?.city,
      state: bk.pickup?.state,
      address: bk.pickup?.address,
      latLng: bk.pickup?.location || bk.pickup?.latLng
    },
    drop: {
      city: bk.drop?.city,
      state: bk.drop?.state,
      address: bk.drop?.address,
      latLng: bk.drop?.location || bk.drop?.latLng
    },
    materialType: bk.materialType,
    weight: bk.weight,
    truckTypeNeeded: bk.truckTypeNeeded,
    bodyType: bk.bodyType,
    estimatedDistance: (() => {
      if (bk.estimatedDistance?.value) return bk.estimatedDistance.value;
      // Fallback: compute on the fly from stored coordinates (handles seeded data)
      const pc = bk.pickup?.location?.coordinates;
      const dc = bk.drop?.location?.coordinates;
      if (!pc || !dc || pc.length < 2 || dc.length < 2) return null;
      if (pc[0] === 0 && pc[1] === 0) return null; // dummy coordinates
      const dLat = (dc[1] - pc[1]) * Math.PI / 180;
      const dLon = (dc[0] - pc[0]) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(pc[1] * Math.PI / 180) * Math.cos(dc[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10 || null;
    })(),
    loadDateTime: bk.loadDateTime || bk.loadDate || bk.loadDateTime,
    status: bk.status,
    paymentStatus: bk.paymentStatus,
    expectedAmount: bk.expectedAmount,
    finalAmount: bk.finalAmount,
    freight: bk.finalAmount || bk.expectedAmount || 0,
    advanceRequired: bk.advanceRequired,
    balance: (bk.finalAmount || bk.expectedAmount || 0) - (bk.advanceRequired || 0),
    additionalInstructions: bk.additionalInstructions,
    isHazardous: bk.isHazardous,
    isFragile: bk.isFragile,
    requiresTemperatureControl: bk.requiresTemperatureControl,
    driver: bk.driver ? { _id: bk.driver._id || bk.driver, name: bk.driver.name, phone: bk.driver.phone } : undefined,
    vehicle: bk.vehicle ? { _id: bk.vehicle._id || bk.vehicle, vehicleNumber: bk.vehicle.vehicleNumber, truckType: bk.vehicle.truckType } : undefined,
    assignedAt: bk.assignedAt,
    statusHistory: (bk.statusHistory || []).map(h => ({
      status: h.status,
      timestamp: h.timestamp,
      notes: h.notes,
      updatedBy: h.updatedBy ? (h.updatedBy._id || h.updatedBy).toString() : undefined,
    })),
    podUploadedAt: bk.podUploadedAt || null,
    deliveredAt: bk.podDetails?.deliveredAt || (bk.statusHistory || []).find(h => h.status === 'delivered')?.timestamp || null,
    interestedCount: (bk.interestedDrivers || []).length,
    interestedDrivers: (bk.interestedDrivers || []).map(e => ({
      driver: e.driver ?? e,
      offeredPrice: e.offeredPrice ?? null,
      submittedAt: e.submittedAt ?? null,
    })),
    images: bk.cargoDocuments || bk.images || [],
    loadingDocuments: (bk.loadingDocuments || []).map(d => d?.url ? { _id: d._id, url: d.url, fileType: d.fileType } : null).filter(Boolean),
    otherDocuments: (bk.otherDocuments || []).map(d => d?.url ? { _id: d._id, url: d.url, fileType: d.fileType } : null).filter(Boolean),
    hasPendingPaymentRequest: (bk.paymentRequests || []).some(r => r.status === 'pending'),
    lastKnownLocation: bk.lastKnownLocation || null,
    lastLocationUpdate: bk.lastLocationUpdate || null,
    laneCode: bk.laneCode || null,
    isAdhoc: bk.isAdhoc || false,
    loadType: bk.loadType || bk.indentType || null,
    exim: bk.exim || 'domestic',
    trafficManager: bk.trafficManager || null,
    trafficController: bk.trafficController ? {
      _id: bk.trafficController._id || bk.trafficController,
      name: bk.trafficController.name || null,
      phone: bk.trafficController.user?.phone || bk.trafficController.phone || null,
    } : null,
    supervisor: bk.supervisor ? {
      _id: bk.supervisor._id || bk.supervisor,
      name: bk.supervisor.name,
      phone: bk.supervisor.phone || null,
    } : null,
    // Location master data
    sourceCode: bk.sourceCode || null,
    destinationCode: bk.destinationCode || null,
    supplierEntity: bk.supplierEntity
      ? {
          _id:         bk.supplierEntity._id  || bk.supplierEntity,
          displayName: bk.supplierEntity.displayName,
          companyName: bk.supplierEntity.companyName || null,
          phone:       bk.supplierEntity.phone || null,
          supplierType: bk.supplierEntity.supplierType || null,
        }
      : null,
    // Pricing
    supplierPrice: bk.supplierPrice || 0,
    customerPrice: bk.customerPrice || bk.expectedAmount || 0,
    weightUnit: bk.weightUnit || 'tons',
    ratePerTon: bk.ratePerTon || false,
    // Indent lifecycle
    expiryTime: bk.expiryTime || null,
    postToSupplier: bk.postToSupplier !== false,
    remarks: bk.remarks || null,
    numberOfTrucks: bk.numberOfTrucks || 1,
    // Post-creation operational
    lrNumber: bk.lrDetails?.lrNumber || null,
    lrDetails: bk.lrDetails ? {
      lrNumber: bk.lrDetails.lrNumber || null,
      lrDate: bk.lrDetails.lrDate || null,
      remarks: bk.lrDetails.remarks || null,
      uploadedAt: bk.lrDetails.uploadedAt || null,
      uploadedBy: bk.lrDetails.uploadedBy?.name || null,
      documents: (bk.lrDetails.documents || []).filter(d => d?.url).map(d => ({
        _id: d._id,
        url: d.url,
        fileType: d.fileType,
        originalName: d.originalName,
      })),
    } : null,
    podDetails: bk.podDetails ? {
      receiverName: bk.podDetails.receiverName || null,
      receiverPhone: bk.podDetails.receiverPhone || null,
      remarks: bk.podDetails.remarks || null,
      deliveredAt: bk.podDetails.deliveredAt || null,
      signatureUrl: bk.podDetails.receiverSignatureDocument?.url || null,
      courier: bk.podDetails.courier || null,
      docketNo: bk.podDetails.docketNo || null,
      ackNo: bk.podDetails.ackNo || null,
    } : null,
    customerDetentionCharge: bk.customerDetentionCharge ?? null,
    supplierDetentionCharge: bk.supplierDetentionCharge ?? null,
    boeNumber: bk.boeNumber || null,
    jobNo: bk.jobNo || null,
    hireChallan: bk.hireChallan || null,
    invoiceNo: bk.invoiceNo || null,
    shipmentNo: bk.shipmentNo || null,
    containerNo: bk.containerNo || null,
    poNumber: bk.poNumber || null,
    actualKm: bk.actualKm || null,
    createdByStaff: bk.createdByStaff ? {
      _id: bk.createdByStaff._id || bk.createdByStaff,
      name: bk.createdByStaff.name,
    } : null,
    // Direct Load / Direct Invoice fields
    bookingType: bk.bookingType || 'indent',
    customerAdvancePct: bk.customerAdvancePct ?? 0,
    supplierAdvancePct: bk.supplierAdvancePct ?? 0,
    supplierTds: bk.supplierTds ?? null,
    customerOnDelivery: bk.customerOnDelivery,
    customerPaysSupplier: bk.customerPaysSupplier,
    supplierPaysSupplier: bk.supplierPaysSupplier,
    customerPodBalance: bk.customerPodBalance,
    supplierPodBalance: bk.supplierPodBalance,
    invoiceTo: bk.invoiceTo,
    payTo: bk.payTo,
    accountNo: bk.accountNo,
    podType: bk.podType,
    tripKm: bk.tripKm,
    expectedDeliveryDate: bk.expectedDeliveryDate || null,
    createdAt: bk.createdAt,
    updatedAt: bk.updatedAt
  };
};

export const getAllBookings = asyncHandler(async (req, res) => {
  const {
    customerId,
    driverId,
    status,
    paymentStatus,
    startDate,
    endDate,
    dateFrom,
    dateTo,
    truckType,
    podPending,
    city,
    search,
    page,
    limit,
    sort
  } = req.query;

  const filters = {
    customerId,
    driverId,
    status: status ? status.split(',') : undefined,
    paymentStatus,
    startDate: startDate || dateFrom,
    endDate: endDate || dateTo,
    truckType: truckType ? truckType.split(',') : undefined,
    podPending: podPending === 'true' ? true : podPending === 'false' ? false : undefined,
    city,
    search
  };

  const pagination = { page, limit, sort };

  const result = await BookingService.getBookings(filters, pagination, {});

  // Support multiple paginate shapes
  let docs = [];
  let p = {};
  if (Array.isArray(result)) docs = result;
  else if (Array.isArray(result.data)) docs = result.data, p = result.pagination || {};
  else if (Array.isArray(result.docs)) docs = result.docs, p = { page: result.page, limit: result.limit, total: result.totalDocs };
  else if (Array.isArray(result.results)) docs = result.results, p = { page: result.page, limit: result.limit, total: result.totalDocs };

  const distanceMap = await TrackingService.calculateDistancesBatch(docs.map((b) => b._id));

  // Aggregate available vehicle counts (own vs market) per truck type in one query
  const uniqueTruckTypes = [...new Set(docs.map(b => b.truckTypeNeeded).filter(Boolean))];
  const truckTypeCountMap = {};
  if (uniqueTruckTypes.length > 0) {
    const aggResult = await Vehicle.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          availability: 'available',
          truckType: { $in: uniqueTruckTypes },
        },
      },
      {
        $group: {
          _id: { truckType: '$truckType', ownershipType: '$ownershipType' },
          count: { $sum: 1 },
        },
      },
    ]);
    for (const row of aggResult) {
      const tt = row._id.truckType;
      if (!truckTypeCountMap[tt]) truckTypeCountMap[tt] = { own: 0, market: 0 };
      if (row._id.ownershipType === 'own') {
        truckTypeCountMap[tt].own = row.count;
      } else {
        truckTypeCountMap[tt].market += row.count;
      }
    }
  }

  const bookings = docs.map(b => ({
    ...mapBooking(b),
    distanceTraveled: distanceMap[b._id] ?? 0,
    matchedOwnCount: truckTypeCountMap[b.truckTypeNeeded]?.own ?? 0,
    matchedMarketCount: truckTypeCountMap[b.truckTypeNeeded]?.market ?? 0,
  }));

  const paginationRes = {
    currentPage: p.page || result.page || 1,
    totalPages: p.pages || result.pages || Math.ceil((p.total || result.total || 0) / (p.limit || result.limit || 20)),
    totalItems: p.total || result.total || result.totalDocs || 0,
    itemsPerPage: p.limit || result.limit || 20
  };

  return res.status(200).json(
    new ApiResponse(200, { bookings, pagination: paginationRes }, 'Bookings fetched successfully')
  );
});

/**
 * Get Available Loads (unassigned bookings for drivers to browse)
 * GET /api/v1/bookings/available-loads
 * Fix 6
 */
export const getAvailableLoads = asyncHandler(async (req, res) => {
  const { city, pickupCity, dropCity, truckType, latitude, longitude, radius, loadDate, page, limit } = req.query;

  // Resolve current driver ObjectId to pre-filter by their fleet capabilities
  let currentDriverId = null;
  try {
    const d = await Driver.findOne({ user: req.user._id }).select('_id').lean();
    if (d) currentDriverId = d._id;
  } catch (_) { /* non-driver callers */ }

  const result = await BookingService.getAvailableLoads({
    city,
    pickupCity,
    dropCity,
    truckType,
    latitude,
    longitude,
    radius,
    loadDate,
    driverId: currentDriverId,
    page,
    limit
  });

  const docs = Array.isArray(result.data) ? result.data
    : Array.isArray(result.docs) ? result.docs
    : Array.isArray(result.results) ? result.results
    : [];

  const loads = docs.map(b => {
    const mapped = mapBooking(b);
    const myEntry = currentDriverId
      ? (b.interestedDrivers || []).find(e => String(e.driver ?? e) === String(currentDriverId))
      : null;
    mapped.alreadyInterested = !!myEntry;
    mapped.myOfferedPrice = myEntry?.offeredPrice ?? null;
    return mapped;
  });

  return res.status(200).json(
    new ApiResponse(200, {
      loads,
      pagination: {
        page: result.page || result.pagination?.page || 1,
        limit: result.limit || result.pagination?.limit || 20,
        total: result.totalDocs || result.pagination?.total || docs.length,
        pages: result.totalPages || result.pagination?.pages || 1
      }
    }, 'Available loads fetched')
  );
});

/**
 * Express Driver Interest in a Load
 * POST /api/v1/bookings/:id/express-interest
 * Fix 7
 */
export const expressInterest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  // Resolve driver profile ID from user
  const driver = await Driver.findOne({ user: userId, isDeleted: false }).select('_id');
  if (!driver) throw new ApiError(404, 'Driver profile not found');

  const { offeredPrice } = req.body;
  await BookingService.expressInterest(id, driver._id, offeredPrice ?? null);

  return res.status(200).json(
    new ApiResponse(200, null, 'Interest submitted successfully')
  );
});

/**
 * Get Unloading Trucks
 * GET /api/v1/bookings/unloading-trucks?dropCity=<city>&truckType=<type>
 * Returns vehicles currently unloading (reached-destination / delivered) at a given city.
 */
export const getUnloadingTrucks = asyncHandler(async (req, res) => {
  const { dropCity, truckType, limit = '50' } = req.query;

  if (!dropCity) throw new ApiError(400, 'dropCity is required');

  const query = {
    isDeleted: false,
    status: { $in: ['reached-destination', 'unloading', 'delivered'] },
    vehicle: { $ne: null },
    'drop.city': new RegExp(dropCity.trim(), 'i'),
  };

  if (truckType) {
    query.truckTypeNeeded = new RegExp(truckType.trim(), 'i');
  }

  const bookings = await Booking.find(query)
    .limit(parseInt(limit))
    .sort({ updatedAt: -1 })
    .populate('vehicle', 'vehicleNumber truckType ownerRef supplierOwner')
    .populate('driver', 'name phone supplierOwner driverRole')
    .lean();

  const trucks = bookings.map((b) => ({
    bookingId: b.bookingId,
    bookingDbId: b._id,
    vehicle: b.vehicle ? {
      _id: b.vehicle._id,
      vehicleNumber: b.vehicle.vehicleNumber,
      truckType: b.vehicle.truckType,
      ownerRef: b.vehicle.ownerRef || null,
      supplierOwner: b.vehicle.supplierOwner || null,
    } : null,
    driver: b.driver ? {
      _id: b.driver._id,
      name: b.driver.name,
      phone: b.driver.phone,
      supplierOwner: b.driver.supplierOwner || null,
      driverRole: b.driver.driverRole || 'individual',
    } : null,
    dropCity: b.drop?.city,
    status: b.status,
    updatedAt: b.updatedAt,
  }));

  return res.status(200).json(
    new ApiResponse(200, trucks, 'Unloading trucks fetched successfully')
  );
});

/**
 * Get Booking by ID
 * GET /api/v1/bookings/:id
 */
export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid booking ID format');
  }

  const userId = req.user._id;
  const userRole = req.user.role;

  const booking = await BookingService.getBookingById(id, userId, userRole);
  const distanceTraveled = await TrackingService.calculateDistanceTraveled(booking._id);

  return res.status(200).json(
    new ApiResponse(200, { ...mapBooking(booking), distanceTraveled }, 'Booking fetched successfully')
  );
});

/**
 * Update Booking Status
 * PATCH /api/v1/bookings/:id/status
 */
export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid booking ID format');
  }

  const { status, note } = req.body;
  const userId = req.user._id;

  const booking = await BookingService.updateStatus(id, status, userId, { note });

  return res.status(200).json(
    new ApiResponse(200, booking, 'Booking status updated successfully')
  );
});

/**
 * Update Booking Details
 * PATCH /api/v1/bookings/:id
 */
export const updateBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid booking ID format');
  }

  const updateData = req.body;
  const userId = req.user._id;

  const booking = await BookingService.updateBooking(id, updateData, userId);

  return res.status(200).json(
    new ApiResponse(200, booking, 'Booking updated successfully')
  );
});

/**
 * Assign Driver to Booking
 * POST /api/v1/bookings/:id/assign-driver
 */
export const assignDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { driverId, vehicleId } = req.body;
  const userId = req.user._id;

  const booking = await BookingService.assignDriver(id, driverId, vehicleId, userId);

  return res.status(200).json(
    new ApiResponse(200, booking, 'Driver assigned successfully')
  );
});

/**
 * Get Dashboard Activities
 * GET /api/v1/bookings/dashboard/activities
 */
export const getActivities = asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const activities = await BookingService.getDashboardActivities({ limit: limit ? parseInt(limit) : 20 });
  return res.status(200).json(new ApiResponse(200, activities, 'Activities fetched successfully'));
});

/**
 * Get Booking Trends
 * GET /api/v1/bookings/dashboard/trends
 */
export const getTrends = asyncHandler(async (req, res) => {
  const { days } = req.query;
  const trends = await BookingService.getBookingTrends({ days: days ? parseInt(days) : 7 });
  return res.status(200).json(new ApiResponse(200, trends, 'Trends fetched successfully'));
});

/**
 * Get Status Breakdown
 * GET /api/v1/bookings/dashboard/status
 */
export const getStatusBreakdown = asyncHandler(async (req, res) => {
  const breakdown = await BookingService.getStatusBreakdown();
  return res.status(200).json(new ApiResponse(200, breakdown, 'Status breakdown fetched successfully'));
});

/**
 * Get Branch KPI aggregation
 * GET /api/v1/bookings/dashboard/branch-kpi
 */
export const getBranchKpi = asyncHandler(async (req, res) => {
  const kpi = await BookingService.getBranchKpi();
  return res.status(200).json(new ApiResponse(200, kpi, 'Branch KPI fetched successfully'));
});

/**
 * Get Driver Stats aggregation
 * GET /api/v1/bookings/dashboard/driver-stats
 */
export const getDriverStats = asyncHandler(async (req, res) => {
  const stats = await BookingService.getDriverStats();
  return res.status(200).json(new ApiResponse(200, stats, 'Driver stats fetched successfully'));
});

/**
 * Get ring counts (status counts) — replaces N per-status getAll calls
 * GET /api/v1/bookings/dashboard/ring-counts
 */
export const getRingCounts = asyncHandler(async (req, res) => {
  const counts = await BookingService.getRingCounts();
  return res.status(200).json(new ApiResponse(200, counts, 'Ring counts fetched successfully'));
});

/**
 * Cancel Booking
 * POST /api/v1/bookings/:id/cancel
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  const booking = await BookingService.cancelBooking(id, userId, reason);

  return res.status(200).json(
    new ApiResponse(200, booking, 'Booking cancelled successfully')
  );
});

/**
 * Add Delay to Booking
 * POST /api/v1/bookings/:id/delay
 */
export const addDelay = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const delayData = req.body;
  const userId = req.user._id;

  const booking = await BookingService.addDelay(id, delayData, userId);

  return res.status(200).json(
    new ApiResponse(200, booking, 'Delay added successfully')
  );
});

/**
 * Get Booking Statistics
 * GET /api/v1/bookings/stats
 */
export const getStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate, customerId } = req.query;

  const filters = { startDate, endDate, customerId };

  const stats = await BookingService.getStatistics(filters);

  return res.status(200).json(
    new ApiResponse(200, stats, 'Statistics fetched successfully')
  );
});

/**
 * Get Driver's Bookings
 * GET /api/v1/bookings/driver-bookings
 */
export const getDriverBookings = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, page, limit, lrPending } = req.query;

  // Find driver document
  const driver = await Driver.findOne({ user: userId, isDeleted: false });
  if (!driver) {
    throw new ApiError(404, 'Driver profile not found');
  }

  const filters = {
    driverId: driver._id,
    status: status ? status.split(',') : undefined,
    lrPending: lrPending !== undefined ? lrPending === 'true' : undefined,
  };

  const pagination = { page, limit };
  const options = { maskCustomer: true };

  const result = await BookingService.getBookings(filters, pagination, options);

  // Normalize result like other endpoints
  let docs = [];
  let p = {};
  if (Array.isArray(result)) docs = result;
  else if (Array.isArray(result.data)) docs = result.data, p = result.pagination || {};
  else if (Array.isArray(result.docs)) docs = result.docs, p = { page: result.page, limit: result.limit, total: result.totalDocs };

  const distanceMap = await TrackingService.calculateDistancesBatch(docs.map((b) => b._id));

  const bookings = docs.map(b => ({
    ...mapBooking(b),
    distanceTraveled: distanceMap[b._id] ?? 0
  }));

  const paginationRes = {
    currentPage: p.page || result.page || 1,
    totalPages: p.pages || result.pages || Math.ceil((p.total || result.total || 0) / (p.limit || result.limit || 20)),
    totalItems: p.total || result.total || result.totalDocs || 0,
    itemsPerPage: p.limit || result.limit || 20
  };

  return res.status(200).json(
    new ApiResponse(200, { bookings, pagination: paginationRes }, 'Bookings fetched successfully')
  );
});

/**
 * Generate and upload driver trip invoice PDF to Cloudinary, return URL
 * GET /api/v1/bookings/:id/driver-invoice
 */
export const getDriverInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findOne({
    $or: [
      ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : []),
      { bookingId: id }
    ],
    isDeleted: false
  })
    .populate('driver', 'name phone')
    .populate('vehicle', 'vehicleNumber truckType')
    .populate('customer', 'companyName gst contactPerson')
    .lean();

  if (!booking) throw new ApiError(404, 'Booking not found');

  // Verify requesting driver is assigned to this booking
  if (req.user.role === 'driver') {
    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver || !booking.driver || booking.driver._id.toString() !== driver._id.toString()) {
      throw new ApiError(403, 'Access denied: not your booking');
    }
  }

  // Return cached URL if already generated
  if (booking.invoicePdf?.url) {
    return res.status(200).json(
      new ApiResponse(200, { url: booking.invoicePdf.url, bookingId: booking.bookingId }, 'Invoice generated successfully')
    );
  }

  // Generate PDF and upload with UUID public_id (non-guessable, permanent)
  const pdfBuffer = await PDFService.generateDriverInvoice(booking);
  const publicId = `cloudtruck/invoices/${randomUUID()}`;

  const uploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', public_id: publicId, format: 'pdf' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(pdfBuffer);
  });

  // Persist permanent URL so future requests return it instantly
  await Booking.updateOne(
    { _id: booking._id },
    { invoicePdf: { cloudinaryId: uploadResult.public_id, url: uploadResult.secure_url, generatedAt: new Date() } }
  );

  return res.status(200).json(
    new ApiResponse(200, { url: uploadResult.secure_url, bookingId: booking.bookingId }, 'Invoice generated successfully')
  );
});

// POST /bookings/:id/request-payment — driver requests payment for a trip
export const requestPayment = asyncHandler(async (req, res) => {
  const request = await BookingService.requestPayment(req.params.id, req.user._id, req.body);
  return res.status(201).json(new ApiResponse(201, request, 'Payment request submitted'));
});

// PATCH /bookings/:id/payment-requests/:requestId/pay|reject — admin action
export const processPaymentRequest = asyncHandler(async (req, res) => {
  const { id, requestId } = req.params;
  const action = req.path.endsWith('/pay') ? 'pay' : 'reject';
  const request = await BookingService.processPaymentRequest(id, requestId, req.user._id, { action, ...req.body });
  return res.status(200).json(new ApiResponse(200, request, action === 'pay' ? 'Payment marked as paid' : 'Request rejected'));
});

// GET /bookings/payment-requests — admin list all payment requests
export const getAllPaymentRequests = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await BookingService.getAllPaymentRequests(parseInt(page) || 1, parseInt(limit) || 20, status);
  return res.status(200).json(new ApiResponse(200, result, 'Payment requests fetched'));
});

// POST /bookings/:id/notes — add a comment/note to a booking
export const addBookingNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text?.trim()) throw new ApiError(400, 'Note text is required');
  const booking = await Booking.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  booking.notes.push({ text: text.trim(), addedBy: req.user._id });
  await booking.save();
  await AuditLog.create({
    user: req.user._id,
    action: 'ADD_BOOKING_NOTE',
    entityType: 'booking',
    entityId: booking._id,
    context: { module: 'booking-management', description: text.trim(), severity: 'low' }
  });
  return res.status(201).json(new ApiResponse(201, booking.notes.at(-1), 'Note added'));
});

// GET /bookings/:id/audit-logs — fetch audit history for a booking
export const getBookingAuditLogs = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const logs = await AuditLog.find({ entityType: 'booking', entityId: id })
    .sort({ timestamp: -1 })
    .limit(50)
    .populate('user', 'name email');
  return res.status(200).json(new ApiResponse(200, logs, 'Audit logs fetched'));
});
