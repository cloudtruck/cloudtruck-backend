import express from 'express';
import * as customerController from '../controllers/customer.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createCustomerSchema,
  getCustomersQuerySchema,
  customerIdParamSchema,
  updateCustomerSchema,
  updateMyGstSchema,
  updateCreditLimitSchema,
  assignAccountManagerSchema,
  getBookingHistoryQuerySchema
} from '../validators/customer.validator.js';

const router = express.Router();

// Customer self-service routes
router.post('/', verifyJWT, checkRole('customer', 'staff', 'internal', 'super-admin'), validate(createCustomerSchema), customerController.createCustomer);
router.get('/my-profile', verifyJWT, checkRole('customer'), customerController.getMyProfile);
router.get('/my-dashboard', verifyJWT, checkRole('customer'), customerController.getMyDashboard);
router.get('/my-bookings', verifyJWT, checkRole('customer'), validate(getBookingHistoryQuerySchema), customerController.getMyBookingHistory);
router.patch('/my-gst', verifyJWT, checkRole('customer'), validate(updateMyGstSchema), customerController.updateMyGst);

// Staff/Admin routes - list and view
router.get('/', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getCustomersQuerySchema), customerController.getAllCustomers);
router.get('/:id', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(customerIdParamSchema), customerController.getCustomerById);
router.get('/:id/dashboard', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(customerIdParamSchema), customerController.getDashboardStats);
router.get('/:id/bookings', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getBookingHistoryQuerySchema), customerController.getBookingHistory);

// Staff/Admin routes - update
router.patch('/:id', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(updateCustomerSchema), customerController.updateCustomer);
router.patch('/:id/credit-limit', verifyJWT, checkRole('internal', 'super-admin'), validate(updateCreditLimitSchema), customerController.updateCreditLimit);

// Staff/Admin routes - management
router.post('/:id/verify', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(customerIdParamSchema), customerController.verifyCustomer);
router.post('/:id/assign-manager', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(assignAccountManagerSchema), customerController.assignAccountManager);

// Admin only - delete
router.delete('/:id', verifyJWT, checkRole('super-admin'), validate(customerIdParamSchema), customerController.deleteCustomer);

export default router;
