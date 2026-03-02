import DocumentService from '../services/document.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

/**
 * Upload document
 */
export const uploadDocument = asyncHandler(async (req, res) => {
  const { entityType, entityId, documentType } = req.body;
  const file = req.file;

  const document = await DocumentService.createDocument(
    { entityType, entityId, documentType, file },
    req.user._id
  );

  return res.status(201).json(new ApiResponse(201, document, 'Document uploaded successfully'));
});

/**
 * Get documents by entity
 */
export const getDocumentsByEntity = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const { documentType } = req.query;

  const documents = await DocumentService.getDocumentsByEntity(entityType, entityId, documentType);

  return res.status(200).json(new ApiResponse(200, documents, 'Documents retrieved successfully'));
});

/**
 * Get document by ID
 */
export const getDocumentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const document = await DocumentService.getDocumentById(id);

  return res.status(200).json(new ApiResponse(200, document, 'Document retrieved successfully'));
});

/**
 * Delete document
 */
export const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await DocumentService.deleteDocument(id, req.user._id);

  return res.status(200).json(new ApiResponse(200, null, 'Document deleted successfully'));
});

/**
 * Upload POD documents for booking (POD file, LR copy, weight slip, other documents)
 */
export const uploadPOD = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const files = req.files;

  const documents = await DocumentService.uploadPOD(bookingId, files, req.body, req.user._id);

  return res.status(201).json(new ApiResponse(201, documents, 'POD documents uploaded successfully'));
});

/**
 * Upload LR for booking
 */
export const uploadLR = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const files = req.files;
  const { lrNumber, lrDate, remarks } = req.body;

  if (!files || files.length === 0) {
    throw new ApiError(400, 'At least one LR image is required');
  }

  const document = await DocumentService.uploadLR(bookingId, files, { lrNumber, lrDate, remarks }, req.user._id);

  return res.status(201).json(new ApiResponse(201, document, 'LR uploaded successfully'));
});

/**
 * Upload loading images for booking
 */
export const uploadLoadingImages = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const files = req.files;

  const documents = await DocumentService.uploadLoadingImages(bookingId, files, req.user._id);

  return res.status(201).json(new ApiResponse(201, documents, 'Loading images uploaded successfully'));
});

/**
 * Get all documents for booking
 */
export const getBookingDocuments = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const documents = await DocumentService.getBookingDocuments(bookingId);

  return res.status(200).json(new ApiResponse(200, documents, 'Booking documents retrieved successfully'));
});

/**
 * Get POD for a booking (customer read)
 */
export const getBookingPOD = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const data = await DocumentService.getBookingPOD(bookingId, req.user._id, req.user.role);
  return res.status(200).json(new ApiResponse(200, data, 'POD retrieved successfully'));
});

/**
 * Get LR for a booking (customer read)
 */
export const getBookingLR = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const data = await DocumentService.getBookingLR(bookingId, req.user._id, req.user.role);
  return res.status(200).json(new ApiResponse(200, data, 'LR retrieved successfully'));
});

/**
 * Get signed download URL
 */
export const getSignedUrl = asyncHandler(async (req, res) => {
  const { cloudinaryId } = req.params;
  const { expiresIn } = req.query;

  const url = await DocumentService.getSignedUrl(cloudinaryId, expiresIn ? parseInt(expiresIn) : 3600);

  return res.status(200).json(new ApiResponse(200, { url }, 'Signed URL generated successfully'));
});
