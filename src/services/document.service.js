import cloudinary from '../config/cloudinary.js';
import Document from '../models/document.model.js';
import Booking from '../models/booking.model.js';
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
   * Upload POD (Proof of Delivery) for booking
   * @param {String} bookingId - Booking ID
   * @param {Object} file - POD file
   * @param {String} userId - User uploading POD
   * @returns {Promise<Document>}
   */
  static async uploadPOD(bookingId, file, userId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    if (booking.status !== 'delivered') {
      throw new ApiError(400, 'POD can only be uploaded for delivered bookings');
    }

    // Upload POD
    const document = await this.createDocument(
      {
        entityType: 'booking',
        entityId: bookingId,
        documentType: 'pod',
        file
      },
      userId
    );

    // Update booking
    booking.podImages.push(document._id);
    booking.podUploadedAt = new Date();
    booking.podUploadedBy = userId;
    await booking.save();

    logger.info('POD uploaded:', { bookingId, documentId: document._id });
    return document;
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
      loadingImages: documents.filter((d) => d.documentType === 'loading-image'),
      other: documents.filter((d) => !['pod', 'loading-image'].includes(d.documentType))
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
