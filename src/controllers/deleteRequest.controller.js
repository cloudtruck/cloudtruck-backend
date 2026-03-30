import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import DeleteRequest from '../models/deleteRequest.model.js';
import logger from '../utils/logger.js';

// @desc    List pending delete requests (for approvers)
// @route   GET /api/v1/delete-requests
// @access  internal, super-admin
export const listDeleteRequests = asyncHandler(async (req, res) => {
  const { status = 'pending', page = 1, limit = 20, resource } = req.query;

  const filter = { status };
  if (resource) filter.resource = resource;

  const skip = (Number(page) - 1) * Number(limit);
  const [requests, total] = await Promise.all([
    DeleteRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('requestedBy', 'name email role')
      .populate('approvedBy', 'name email'),
    DeleteRequest.countDocuments(filter)
  ]);

  res.json(
    new ApiResponse(200, {
      items: requests,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    }, 'Delete requests fetched')
  );
});

// @desc    List my own delete requests (for staff)
// @route   GET /api/v1/delete-requests/mine
// @access  any authenticated staff
export const listMyDeleteRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const filter = { requestedBy: req.user._id };
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [requests, total] = await Promise.all([
    DeleteRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('approvedBy', 'name email'),
    DeleteRequest.countDocuments(filter)
  ]);

  res.json(
    new ApiResponse(200, {
      items: requests,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    }, 'Your delete requests fetched')
  );
});

// @desc    Approve a delete request and execute the soft delete
// @route   POST /api/v1/delete-requests/:id/approve
// @access  internal, super-admin
export const approveDeleteRequest = asyncHandler(async (req, res) => {
  const deleteRequest = await DeleteRequest.findById(req.params.id);
  if (!deleteRequest) throw new ApiError(404, 'Delete request not found');
  if (deleteRequest.status !== 'pending') {
    throw new ApiError(400, `Request is already ${deleteRequest.status}`);
  }

  // Load the model dynamically and find the document
  let Model;
  try {
    Model = mongoose.model(deleteRequest.resourceModel);
  } catch {
    throw new ApiError(500, `Unknown model: ${deleteRequest.resourceModel}`);
  }

  const document = await Model.findById(deleteRequest.resourceId);
  if (!document || document.isDeleted) {
    // Mark request resolved even if resource already gone
    deleteRequest.status = 'approved';
    deleteRequest.approvedBy = req.user._id;
    deleteRequest.approvedAt = new Date();
    await deleteRequest.save();
    return res.json(new ApiResponse(200, deleteRequest, 'Request approved (resource was already deleted)'));
  }

  // Execute soft delete
  await document.softDelete(req.user._id);

  // Mark request as approved
  deleteRequest.status = 'approved';
  deleteRequest.approvedBy = req.user._id;
  deleteRequest.approvedAt = new Date();
  await deleteRequest.save();

  // Notify requester
  try {
    const io = req.app.get('io');
    if (io) {
      const { emitNotificationToUser } = await import('../sockets/notification.socket.js');
      emitNotificationToUser(io, deleteRequest.requestedBy.toString(), {
        type: 'delete_request_approved',
        title: 'Deletion Approved',
        message: `Your request to delete the ${deleteRequest.resource} record has been approved.`,
        data: { deleteRequestId: deleteRequest._id, resource: deleteRequest.resource }
      });
    }
  } catch (err) {
    logger.error('Failed to emit delete-approved notification:', err);
  }

  res.json(new ApiResponse(200, deleteRequest, 'Delete request approved and resource deleted'));
});

// @desc    Reject a delete request
// @route   POST /api/v1/delete-requests/:id/reject
// @access  internal, super-admin
export const rejectDeleteRequest = asyncHandler(async (req, res) => {
  const { rejectionReason } = req.body;

  const deleteRequest = await DeleteRequest.findById(req.params.id);
  if (!deleteRequest) throw new ApiError(404, 'Delete request not found');
  if (deleteRequest.status !== 'pending') {
    throw new ApiError(400, `Request is already ${deleteRequest.status}`);
  }

  deleteRequest.status = 'rejected';
  deleteRequest.approvedBy = req.user._id;
  deleteRequest.approvedAt = new Date();
  deleteRequest.rejectionReason = rejectionReason || 'No reason provided';
  await deleteRequest.save();

  // Notify requester
  try {
    const io = req.app.get('io');
    if (io) {
      const { emitNotificationToUser } = await import('../sockets/notification.socket.js');
      emitNotificationToUser(io, deleteRequest.requestedBy.toString(), {
        type: 'delete_request_rejected',
        title: 'Deletion Rejected',
        message: `Your request to delete the ${deleteRequest.resource} record was rejected: ${rejectionReason || 'No reason provided'}`,
        data: { deleteRequestId: deleteRequest._id, resource: deleteRequest.resource, rejectionReason }
      });
    }
  } catch (err) {
    logger.error('Failed to emit delete-rejected notification:', err);
  }

  res.json(new ApiResponse(200, deleteRequest, 'Delete request rejected'));
});
