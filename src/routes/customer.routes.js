import express from 'express';
import * as customerController from '../controllers/customer.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { requireDeleteApproval } from '../middlewares/requireDeleteApproval.js';
import {
  createCustomerSchema,
  getCustomersQuerySchema,
  customerIdParamSchema,
  updateCustomerSchema,
  updateMyGstSchema,
  updateCreditLimitSchema,
  assignAccountManagerSchema,
  getBookingHistoryQuerySchema,
  addBankAccountSchema,
  updateBankAccountSchema,
  bankAccountIdParamSchema
} from '../validators/customer.validator.js';

const router = express.Router();

// Customer self-service routes
router.post('/', verifyJWT, checkRole('customer', 'staff', 'internal', 'super-admin'), validate(createCustomerSchema), customerController.createCustomer);
router.get('/my-profile', verifyJWT, checkRole('customer'), customerController.getMyProfile);
router.get('/my-dashboard', verifyJWT, checkRole('customer'), customerController.getMyDashboard);
router.get('/my-bookings', verifyJWT, checkRole('customer'), validate(getBookingHistoryQuerySchema), customerController.getMyBookingHistory);
router.patch('/my-gst', verifyJWT, checkRole('customer'), validate(updateMyGstSchema), customerController.updateMyGst);

// Customer bank account routes
router.get('/my-bank-accounts', verifyJWT, checkRole('customer'), customerController.getMyBankAccounts);
router.post('/my-bank-accounts', verifyJWT, checkRole('customer'), validate(addBankAccountSchema), customerController.addBankAccount);
router.patch('/my-bank-accounts/:accountId', verifyJWT, checkRole('customer'), validate(updateBankAccountSchema), customerController.updateBankAccount);
router.delete('/my-bank-accounts/:accountId', verifyJWT, checkRole('customer'), validate(bankAccountIdParamSchema), customerController.removeBankAccount);
router.patch('/my-bank-accounts/:accountId/primary', verifyJWT, checkRole('customer'), validate(bankAccountIdParamSchema), customerController.setPrimaryBankAccount);

// Staff/Admin routes - list and view
router.get('/', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getCustomersQuerySchema), customerController.getAllCustomers);

// Sub-resource routes — must come BEFORE /:id to avoid path collisions
router.post('/:id/locations', verifyJWT, checkRole('staff', 'internal', 'super-admin'), customerController.addLocation);
router.delete('/:id/locations/:locId', verifyJWT, checkRole('staff', 'internal', 'super-admin'), customerController.removeLocation);
router.post('/:id/charges', verifyJWT, checkRole('staff', 'internal', 'super-admin'), customerController.addCharge);
router.delete('/:id/charges/:chargeId', verifyJWT, checkRole('staff', 'internal', 'super-admin'), customerController.removeCharge);
router.post('/:id/comments', verifyJWT, checkRole('staff', 'internal', 'super-admin'), customerController.addComment);
router.get('/:id/comments', verifyJWT, checkRole('staff', 'internal', 'super-admin'), customerController.getComments);

router.get('/:id', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(customerIdParamSchema), customerController.getCustomerById);
router.get('/:id/dashboard', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(customerIdParamSchema), customerController.getDashboardStats);
router.get('/:id/bookings', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(getBookingHistoryQuerySchema), customerController.getBookingHistory);

// Staff/Admin routes - update
router.patch('/:id', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(updateCustomerSchema), customerController.updateCustomer);
router.patch('/:id/credit-limit', verifyJWT, checkRole('internal', 'super-admin'), validate(updateCreditLimitSchema), customerController.updateCreditLimit);

// Staff/Admin routes - management
router.post('/:id/verify', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(customerIdParamSchema), customerController.verifyCustomer);
router.patch('/:id/approve', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(customerIdParamSchema), customerController.verifyCustomer);
router.post('/:id/assign-manager', verifyJWT, checkRole('staff', 'internal', 'super-admin'), validate(assignAccountManagerSchema), customerController.assignAccountManager);

// Admin only - delete (staff role requires approval from internal/super-admin)
router.delete('/:id', verifyJWT, checkRole('super-admin', 'internal', 'staff'), validate(customerIdParamSchema), requireDeleteApproval('customer', 'Customer'), customerController.deleteCustomer);

export default router;
