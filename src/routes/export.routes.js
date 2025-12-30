import express from 'express';
import * as exportController from '../controllers/export.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All export routes are restricted to staff, internal, and super-admin
router.use(verifyJWT);
router.use(checkRole('staff', 'internal', 'super-admin'));

router.get('/bookings', exportController.exportBookings);
router.get('/payments', exportController.exportPayments);
router.get('/drivers', exportController.exportDrivers);
router.get('/customers', exportController.exportCustomers);

export default router;
