import express from 'express';
import authRoutes from './auth.routes.js';
import bookingRoutes from './booking.routes.js';
import driverRoutes from './driver.routes.js';
import customerRoutes from './customer.routes.js';
import vehicleRoutes from './vehicle.routes.js';
import staffRoutes from './staff.routes.js';
import routeRoutes from './route.routes.js';
import auditRoutes from './audit.routes.js';
import paymentRoutes from './payment.routes.js';
import documentRoutes from './document.routes.js';
import trackingRoutes from './tracking.routes.js';
import notificationRoutes from './notification.routes.js';

const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cloudtruck API is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/bookings', bookingRoutes);
router.use('/drivers', driverRoutes);
router.use('/customers', customerRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/staff', staffRoutes);
router.use('/routes', routeRoutes);
router.use('/audit', auditRoutes);
router.use('/payments', paymentRoutes);
router.use('/documents', documentRoutes);
router.use('/tracking', trackingRoutes);
router.use('/notifications', notificationRoutes);

// 404 handler for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

export default router;
