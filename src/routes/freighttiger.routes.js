import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { handleTripCreated, handleLocationUpdated } from '../controllers/freighttiger.controller.js';

const router = express.Router();

// Webhook: FreightTiger notifies us when a trip is created on their side
router.post('/trip-created', asyncHandler(handleTripCreated));

// Webhook: FreightTiger pushes a GPS location update for an active trip
router.post('/location-updated', asyncHandler(handleLocationUpdated));

export default router;
