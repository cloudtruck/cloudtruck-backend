import cloudinary from '../config/cloudinary.js';
import Document from '../models/document.model.js';
import Booking from '../models/booking.model.js';
import Customer from '../models/customer.model.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';

class DocumentService {
  /**
   * Upload document to Cloudinary
   * @param {String} filePath - Local file path
   * @param {String} folder - Cloudinary folder
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} - Upload result
   */
  static async uploadDocument(filePath, folder, metadata = {}) {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: `cloudtruck/${folder}`,
        resource_type: 'auto',
        public_id: `${metadata.entityType}_${metadata.entityId}_${Date.now()}`,
        context: metadata
      });

      // Delete local file after upload
      await fs.unlink(filePath).catch(() => {});

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
    }

    // Upload to Cloudinary
    const uploadResult = await this.uploadDocument(file.path, entityType, {
      entityType,
      entityId,
      documentType,
      uploadedBy: userId
    });

    // Create document record
    const document = await Document.create({
      entityType,
      entityId,
      documentType,
      url: uploadResult.url,
      cloudinaryId: uploadResult.cloudinaryId,
      format: uploadResult.format,
      size: uploadResult.size,
      uploadedBy: userId
    });

    logger.info('Document created:', { documentId: document._id, entityType, entityId });
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
    const query = { entityType, entityId };
    if (documentType) query.documentType = documentType;

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

    // Upload all files and collect document IDs (Fix 5)
    const docIds = await Promise.all(
      files.map(file =>
        this.createDocument(
          { entityType: 'booking', entityId: bookingId, documentType: 'lr', file },
          userId
        ).then(d => d._id)
      )
    );

    booking.lrDetails = {
      lrNumber: lrData.lrNumber,
      lrDate: new Date(lrData.lrDate),
      remarks: lrData.remarks,
      documents: docIds,
      uploadedAt: new Date(),
      uploadedBy: userId
    };
    await booking.save();

    logger.info('LR uploaded:', { bookingId, documentCount: docIds.length });
    return { documents: docIds };
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
      booking.loadingImages.push(document._id);
    }

    await booking.save();
    logger.info('Loading images uploaded:', { bookingId, count: files.length });
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
    if (!customerDoc || booking.customer.toString() !== customerDoc._id.toString()) {
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
