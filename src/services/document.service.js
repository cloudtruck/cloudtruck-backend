import cloudinary from '../config/cloudinary.js';
import Document from '../models/document.model.js';
import Booking from '../models/booking.model.js';
import Customer from '../models/customer.model.js';
import EwayBill from '../models/ewayBill.model.js';
import Vehicle from '../models/vehicle.model.js';
import Driver from '../models/driver.model.js';
import PDFService from './pdf.service.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

class DocumentService {
  /**
   * Upload document to Cloudinary
   * @param {String} filePath - Local file path
   * @param {String} folder - Cloudinary folder
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} - Upload result
   */
  static async uploadDocument(file, folder, metadata = {}) {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `cloudtruck/${folder}`,
            resource_type: 'auto',
            public_id: `${metadata.entityType}_${metadata.entityId}_${Date.now()}`,
            context: metadata
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(file.buffer);
      });

      return {
        url: result.secure_url,
        cloudinaryId: result.public_id,
        format: result.format,
        size: result.bytes
      };
    } catch (error) {
      logger.error('Cloudinary upload failed:', error);
      throw new ApiError(500, 'Failed to upload document');
    }
  }

  /**
   * Create document record
   * @param {Object} data - Document data
   * @param {String} userId - Uploader user ID
   * @returns {Promise<Document>}
   */
  static async createDocument(data, userId) {
    const { entityType, entityId, documentType, file } = data;

    // Validate entity exists
    if (entityType === 'booking') {
      const booking = await Booking.findById(entityId);
      if (!booking) throw new ApiError(404, 'Booking not found');
    } else if (entityType === 'vehicle') {
      const vehicle = await Vehicle.findById(entityId);
      if (!vehicle) throw new ApiError(404, 'Vehicle not found');
    } else if (entityType === 'driver') {
      const driver = await Driver.findById(entityId);
      if (!driver) throw new ApiError(404, 'Driver not found');
    }

    // Upload to Cloudinary
    const uploadResult = await this.uploadDocument(file, entityType, {
      entityType,
      entityId,
      documentType,
      uploadedBy: userId
    });

    // Create document record (Mapping to correct schema fields: ownerRef and type)
    const document = await Document.create({
      ownerRef: {
        kind: entityType,
        item: entityId
      },
      type: documentType,
      url: uploadResult.url,
      providerId: uploadResult.cloudinaryId,
      format: uploadResult.format,
      bytes: uploadResult.size,
      uploadedBy: userId
    });

    // Link document back to entity if applicable
    if (entityType === 'vehicle') {
      const vehicleUpdate = {};
      if (documentType === 'rc') vehicleUpdate['documents.rcDocument'] = document._id;
      else if (documentType === 'insurance') vehicleUpdate['documents.insuranceDocument'] = document._id;
      else if (documentType === 'fitness') vehicleUpdate['documents.fitnessDocument'] = document._id;
      else if (documentType === 'permit') vehicleUpdate['documents.permitDocument'] = document._id;
      else if (documentType === 'puc') vehicleUpdate['documents.pucCertificate'] = document._id;

      if (Object.keys(vehicleUpdate).length > 0) {
        await Vehicle.findByIdAndUpdate(entityId, vehicleUpdate);
      }
    } else if (entityType === 'driver') {
      const driverUpdate = {};
      if (documentType === 'pan') {
        driverUpdate['pan.document'] = document._id;
        driverUpdate['documents.panDocument'] = document._id;
      } else if (documentType === 'aadhaar') {
        driverUpdate['aadhaar.document'] = document._id;
        driverUpdate['documents.aadhaarDocument'] = document._id;
      } else if (documentType === 'license') {
        driverUpdate.licenseImage = document.url;
      } else if (documentType === 'cheque') {
        driverUpdate['documents.chequeImage'] = document._id;
      } else if (documentType === 'tds') {
        driverUpdate['documents.tdsDocument'] = document._id;
      }

      if (Object.keys(driverUpdate).length > 0) {
        await Driver.findByIdAndUpdate(entityId, driverUpdate);
      }
    }

    logger.info('Document created and linked:', { documentId: document._id, entityType, entityId, documentType });
    return document;
  }

  /**
   * Get documents by entity
   * @param {String} entityType - Entity type
   * @param {String} entityId - Entity ID
   * @param {String} documentType - Optional filter by document type
   * @returns {Promise<Array>}
   */
  static async getDocumentsByEntity(entityType, entityId, documentType = null) {
    const query = { 'ownerRef.kind': entityType, 'ownerRef.item': entityId };
    if (documentType) query.type = documentType;

    const documents = await Document.find(query)
      .populate('uploadedBy', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    return documents;
  }

  /**
   * Get document by ID
   * @param {String} documentId - Document ID
   * @returns {Promise<Document>}
   */
  static async getDocumentById(documentId) {
    const document = await Document.findById(documentId)
      .populate('uploadedBy', 'name email role')
      .lean();

    if (!document) throw new ApiError(404, 'Document not found');
    return document;
  }

  /**
   * Delete document
   * @param {String} documentId - Document ID
   * @param {String} userId - User performing deletion
   * @returns {Promise<void>}
   */
  static async deleteDocument(documentId, userId) {
    const document = await Document.findById(documentId);
    if (!document) throw new ApiError(404, 'Document not found');

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(document.cloudinaryId);
    } catch (error) {
      logger.error('Cloudinary delete failed:', error);
      // Continue with database deletion even if Cloudinary fails
    }

    // Delete from database
    await document.deleteOne();

    // Remove ref from booking arrays if this doc belongs to a booking
    if (document.entityType === 'booking' && document.entityId) {
      await Booking.updateOne(
        { _id: document.entityId },
        {
          $pull: {
            'lrDetails.documents': document._id,
            loadingDocuments: document._id,
            otherDocuments: document._id,
            cargoDocuments: document._id,
          }
        }
      );
    }

    logger.info('Document deleted:', { documentId, deletedBy: userId });
  }

  /**
   * Upload POD documents for booking (POD file, LR copy, weight slip, other documents)
   * @param {String} bookingId - Booking ID
   * @param {Object} files - Files keyed by field name (pod, lrCopy, weightSlip, otherDocuments)
   * @param {String} userId - User uploading POD
   * @returns {Promise<Object>} - Uploaded documents grouped by type
   */
  static async uploadPOD(bookingId, files, body = {}, userId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    if (booking.status !== 'delivered') {
      throw new ApiError(400, 'POD can only be uploaded for delivered bookings');
    }

    // Fix 4: Duplicate submission guard
    if (booking.podUploadedAt) {
      throw new ApiError(409, 'POD already submitted for this booking');
    }

    const uploaded = { pod: [], lrCopy: [], weightSlip: [], otherDocuments: [] };

    const fieldMap = [
      { field: 'pod', docType: 'pod', bookingArray: 'podDocuments' },
      { field: 'lrCopy', docType: 'lr-copy', bookingArray: 'lrCopyDocuments' },
      { field: 'weightSlip', docType: 'weight-slip', bookingArray: 'weightSlipDocuments' },
      { field: 'otherDocuments', docType: 'other', bookingArray: 'otherDocuments' }
    ];

    for (const { field, docType, bookingArray } of fieldMap) {
      const fileList = files[field] || [];
      for (const file of fileList) {
        const document = await this.createDocument(
          {
            entityType: 'booking',
            entityId: bookingId,
            documentType: docType,
            file
          },
          userId
        );
        uploaded[field].push(document);
        booking[bookingArray].push(document._id);
      }
    }

    booking.status = 'pod-received';
    booking.podUploadedAt = new Date();
    booking.podUploadedBy = userId;

    // Fix 3: Save receiver details
    booking.podDetails = {
      receiverName: body.receiverName || '',
      receiverPhone: body.receiverPhone || '',
      deliveredAt: body.deliveredAt ? new Date(body.deliveredAt) : new Date(),
      remarks: body.remarks || '',
    };

    await booking.save();

    logger.info('POD documents uploaded:', { bookingId, counts: Object.fromEntries(Object.entries(uploaded).map(([k, v]) => [k, v.length])) });
    return uploaded;
  }

  /**
   * Upload LR (Lorry Receipt) for booking
   * @param {String} bookingId - Booking ID
   * @param {Object} file - LR file
   * @param {Object} lrData - LR metadata (lrNumber, lrDate, remarks)
   * @param {String} userId - User uploading LR
   * @returns {Promise<Document>}
   */
  static async uploadLR(bookingId, files, lrData, userId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    const MAX_LR = 5;
    const existingLr = (booking.lrDetails?.documents || []).length;
    if (existingLr >= MAX_LR) {
      throw new ApiError(400, `Maximum ${MAX_LR} LR files allowed`);
    }
    const allowedLr = MAX_LR - existingLr;
    const limitedFiles = files.slice(0, allowedLr);
    const docIds = await Promise.all(
      limitedFiles.map(file =>
        this.createDocument(
          { entityType: 'booking', entityId: bookingId, documentType: 'lr', file },
          userId
        ).then(d => d._id)
      )
    );
    // Merge with existing docs rather than replace, up to max
    const existingDocIds = (booking.lrDetails?.documents || []).map(d => d._id || d);

    booking.lrDetails = {
      lrNumber: lrData.lrNumber || booking.lrDetails?.lrNumber,
      lrDate: lrData.lrDate ? new Date(lrData.lrDate) : (booking.lrDetails?.lrDate || undefined),
      remarks: lrData.remarks || booking.lrDetails?.remarks,
      documents: [...existingDocIds, ...docIds],
      uploadedAt: new Date(),
      uploadedBy: userId
    };
    await booking.save();

    logger.info('LR uploaded:', { bookingId, documentCount: docIds.length });
    return { documents: docIds };
  }

  /**
   * Delete entire LR for booking — removes all LR documents from Cloudinary + DB and clears lrDetails
   * @param {String} bookingId - Booking ID
   * @param {String} userId - User performing deletion
   */
  static async deleteLR(bookingId, userId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    const docIds = (booking.lrDetails?.documents || []).map(d => d._id || d);

    // Delete each document from Cloudinary + DB
    for (const docId of docIds) {
      try {
        await this.deleteDocument(docId.toString(), userId);
      } catch (err) {
        logger.warn('Could not delete LR document during LR delete:', { docId, err: err.message });
      }
    }

    // Clear lrDetails
    booking.lrDetails = null;
    await booking.save();

    logger.info('LR deleted:', { bookingId });
  }

  /**
   * Upload loading images for booking
   * @param {String} bookingId - Booking ID
   * @param {Array} files - Loading image files
   * @param {String} userId - User uploading images
   * @returns {Promise<Array>}
   */
  static async uploadLoadingImages(bookingId, files, userId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    if (!['loaded', 'in-transit', 'reached-destination', 'delivered'].includes(booking.status)) {
      throw new ApiError(400, 'Loading images can only be uploaded after loading');
    }

    const MAX_LOADING = 2;
    const existing = (booking.loadingDocuments || []).length;
    if (existing >= MAX_LOADING) {
      throw new ApiError(400, `Maximum ${MAX_LOADING} loading memo files allowed`);
    }
    const allowed = MAX_LOADING - existing;
    files = files.slice(0, allowed);

    const documents = [];
    for (const file of files) {
      const document = await this.createDocument(
        {
          entityType: 'booking',
          entityId: bookingId,
          documentType: 'loading-image',
          file
        },
        userId
      );
      documents.push(document);
      booking.loadingDocuments.push(document._id);
    }

    await booking.save();
    logger.info('Loading images uploaded:', { bookingId, count: files.length });
    return documents;
  }

  /**
   * Upload other documents for booking
   * @param {String} bookingId - Booking ID
   * @param {Array} files - Files to upload
   * @param {String} userId - User uploading
   * @returns {Promise<Array>}
   */
  static async uploadOtherDocuments(bookingId, files, userId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    const MAX_OTHER = 6;
    const existing = (booking.otherDocuments || []).length;
    if (existing >= MAX_OTHER) {
      throw new ApiError(400, `Maximum ${MAX_OTHER} other documents allowed`);
    }
    const allowed = MAX_OTHER - existing;
    files = files.slice(0, allowed);

    const documents = [];
    for (const file of files) {
      const document = await this.createDocument(
        { entityType: 'booking', entityId: bookingId, documentType: 'other', file },
        userId
      );
      documents.push(document);
      booking.otherDocuments.push(document._id);
    }

    await booking.save();
    logger.info('Other documents uploaded:', { bookingId, count: files.length });
    return documents;
  }

  /**
   * Get all documents for a booking
   * @param {String} bookingId - Booking ID
   * @returns {Promise<Object>}
   */
  static async getBookingDocuments(bookingId) {
    const documents = await this.getDocumentsByEntity('booking', bookingId);

    return {
      all: documents,
      pod: documents.filter((d) => d.documentType === 'pod'),
      lrCopy: documents.filter((d) => d.documentType === 'lr-copy'),
      weightSlip: documents.filter((d) => d.documentType === 'weight-slip'),
      loadingImages: documents.filter((d) => d.documentType === 'loading-image'),
      lr: documents.filter((d) => d.documentType === 'lr'),
      other: documents.filter((d) => !['pod', 'lr', 'lr-copy', 'weight-slip', 'loading-image'].includes(d.documentType))
    };
  }

  // Fields to select when populating document refs for customer-facing responses
  static #DOC_FIELDS = 'url format bytes uploadedAt';

  // Bypass roles that skip ownership check
  static #PRIVILEGED_ROLES = new Set(['staff', 'internal', 'super-admin', 'driver']);

  /**
   * Verify booking ownership for a customer user.
   * Staff/admin/driver bypass this check.
   */
  static async #assertBookingAccess(booking, userId, userRole) {
    if (DocumentService.#PRIVILEGED_ROLES.has(userRole)) return;
    const customerDoc = await Customer.findOne({ user: userId, isDeleted: false }).select('_id');
    // booking.customer may be a populated object or a raw ObjectId
    const bookingCustomerId = booking.customer?._id ?? booking.customer;
    if (!customerDoc || bookingCustomerId.toString() !== customerDoc._id.toString()) {
      throw new ApiError(403, 'Access denied');
    }
  }

  /**
   * Fetch a booking by ObjectId or readable bookingId, throws 404 if not found.
   */
  static async #findBooking(bookingId, populatePaths = []) {
    let q = Booking.findOne({ $or: [{ _id: bookingId }, { bookingId }], isDeleted: false });
    for (const [path, fields] of populatePaths) q = q.populate(path, fields);
    const booking = await q.lean();
    if (!booking) throw new ApiError(404, 'Booking not found');
    return booking;
  }

  /**
   * Get POD details + documents for a booking (customer-safe)
   */
  static async getBookingPOD(bookingId, userId, userRole) {
    const f = DocumentService.#DOC_FIELDS;
    const booking = await DocumentService.#findBooking(bookingId, [
      ['podDocuments', f],
      ['lrCopyDocuments', f],
      ['weightSlipDocuments', f]
    ]);
    await this.#assertBookingAccess(booking, userId, userRole);

    return {
      podDetails: booking.podDetails || null,
      podUploadedAt: booking.podUploadedAt || null,
      documents: {
        pod: booking.podDocuments || [],
        lrCopy: booking.lrCopyDocuments || [],
        weightSlip: booking.weightSlipDocuments || []
      }
    };
  }

  /**
   * Get LR details + documents for a booking (customer-safe)
   */
  static async getBookingLR(bookingId, userId, userRole) {
    const booking = await DocumentService.#findBooking(bookingId, [
      ['lrDetails.documents', DocumentService.#DOC_FIELDS]
    ]);
    await this.#assertBookingAccess(booking, userId, userRole);

    if (!booking.lrDetails?.uploadedAt) {
      return { available: false, lrDetails: null };
    }

    return {
      available: true,
      lrDetails: booking.lrDetails
    };
  }

  /**
   * Generate Loading Memo PDF buffer for a booking (customer-safe).
   * @param {String} bookingId
   * @param {String} userId
   * @param {String} userRole
   * @returns {Promise<{ buffer: Buffer, bookingId: String }>}
   */
  static async getLoadingMemoPDF(bookingId, userId, userRole) {
    const booking = await Booking.findOne({
      $or: [{ _id: bookingId }, { bookingId }],
      isDeleted: false
    })
      .populate('customer', 'companyName gst contactPerson')
      .populate('driver', 'name phone')
      .populate('vehicle', 'vehicleNumber truckType')
      .lean();

    if (!booking) throw new ApiError(404, 'Booking not found');
    await this.#assertBookingAccess(booking, userId, userRole);

    const buffer = await PDFService.generateLoadingMemo(booking);
    return { buffer, bookingId: booking.bookingId };
  }

  /**
   * Get Auto E-LR (eway bill) details for a booking (customer-safe).
   * Returns the most recent active/valid eway bill linked to the booking.
   * @param {String} bookingId
   * @param {String} userId
   * @param {String} userRole
   * @returns {Promise<Object>}
   */
  static async getEwayBillForBooking(bookingId, userId, userRole) {
    const booking = await DocumentService.#findBooking(bookingId);
    await this.#assertBookingAccess(booking, userId, userRole);

    const ewayBill = await EwayBill.findOne({
      bookingId: booking._id,
      isDeleted: false,
      status: { $in: ['active', 'draft'] }
    })
      .select('ewayBillNumber status documentNumber documentDate fromGstin toGstin partATotalValue totalTax vehicleNumber transMode expiryTracking itemList createdAt')
      .sort({ createdAt: -1 })
      .lean();

    if (!ewayBill) {
      return { available: false, ewayBill: null };
    }

    return {
      available: true,
      ewayBill: {
        ewayBillNumber: ewayBill.ewayBillNumber,
        status: ewayBill.status,
        documentNumber: ewayBill.documentNumber,
        documentDate: ewayBill.documentDate,
        fromGstin: ewayBill.fromGstin,
        toGstin: ewayBill.toGstin,
        totalValue: ewayBill.partATotalValue,
        totalTax: ewayBill.totalTax,
        vehicleNumber: ewayBill.vehicleNumber,
        transMode: ewayBill.transMode,
        validFrom: ewayBill.expiryTracking?.validFrom,
        validUpto: ewayBill.expiryTracking?.validUpto,
        isExpired: ewayBill.expiryTracking?.validUpto
          ? new Date() > new Date(ewayBill.expiryTracking.validUpto)
          : false,
        items: ewayBill.itemList
      }
    };
  }

  /**
   * Get download URL with expiry
   * @param {String} cloudinaryId - Cloudinary public ID
   * @param {Number} expiresIn - Expiry in seconds (default 3600)
   * @returns {Promise<String>}
   */
  static async getSignedUrl(cloudinaryId, expiresIn = 3600) {
    try {
      const timestamp = Math.floor(Date.now() / 1000) + expiresIn;
      const signature = cloudinary.utils.api_sign_request(
        { timestamp, public_id: cloudinaryId },
        process.env.CLOUDINARY_API_SECRET
      );

      return `${cloudinary.url(cloudinaryId)}?timestamp=${timestamp}&signature=${signature}`;
    } catch (error) {
      logger.error('Failed to generate signed URL:', error);
      throw new ApiError(500, 'Failed to generate download URL');
    }
  }
}

export default DocumentService;
