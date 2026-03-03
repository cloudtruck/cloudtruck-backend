import TrackingService from '../services/tracking.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Record GPS location
 */
export const recordLocation = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const location = req.body;

  const tracking = await TrackingService.recordLocation(bookingId, req.user._id, location);

  return res.status(201).json(new ApiResponse(201, tracking, 'Location recorded'));
});

/**
 * Get tracking history
 */
export const getTrackingHistory = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { fromTime, toTime } = req.query;

  const trackingData = await TrackingService.getTrackingHistory(bookingId, { fromTime, toTime });

  return res.status(200).json(new ApiResponse(200, trackingData, 'Tracking history retrieved'));
});

/**
 * Get last known location
 */
export const getLastKnownLocation = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const locationData = await TrackingService.getLastKnownLocation(bookingId);

  return res.status(200).json(new ApiResponse(200, locationData, 'Last known location retrieved'));
});

/**
 * Get tracking URL
 */
export const getTrackingUrl = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const trackingUrl = await TrackingService.getTrackingUrl(bookingId);

  return res.status(200).json(new ApiResponse(200, { trackingUrl }, 'Tracking URL generated'));
});

/**
 * Get distance traveled
 */
export const getDistanceTraveled = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const distance = await TrackingService.calculateDistanceTraveled(bookingId);

  return res.status(200).json(new ApiResponse(200, { distance }, 'Distance calculated'));
});

/**
 * Get tracking statistics
 */
export const getTrackingStatistics = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const statistics = await TrackingService.getTrackingStatistics(bookingId);

  return res.status(200).json(new ApiResponse(200, statistics, 'Tracking statistics retrieved'));
});

/**
 * Get tracking route for map
 */
export const getTrackingRoute = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { interval } = req.query;

  const routeData = await TrackingService.getTrackingRoute(bookingId, interval ? parseInt(interval) : 5);

  return res.status(200).json(new ApiResponse(200, routeData, 'Tracking route retrieved'));
});

/**
 * Get all live trips
 */
export const getLiveTrips = asyncHandler(async (req, res) => {
  const liveTrips = await TrackingService.getLiveTrips();
  return res.status(200).json(new ApiResponse(200, liveTrips, 'Live trips retrieved'));
});

/**
 * Get planned route for booking
 */
export const getPlannedRoute = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const route = await TrackingService.getPlannedRoute(bookingId);
  return res.status(200).json(new ApiResponse(200, route, 'Planned route retrieved'));
});

/**
 * Get unified tracking summary for customer tracking screen
 */
export const getTrackingSummary = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const summary = await TrackingService.getTrackingSummary(bookingId);
  return res.status(200).json(new ApiResponse(200, summary, 'Tracking summary retrieved'));
});
