import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  mobileLoginSchema,
  staffLoginSchema,
  registerStaffSchema,
  refreshTokenSchema,
  changePasswordSchema,
  resetPasswordSchema,
  userIdParamSchema
} from '../validators/auth.validator.js';

const router = express.Router();

// Public routes
router.post('/login/mobile', validate(mobileLoginSchema), authController.mobileLogin);
router.post('/login/staff', validate(staffLoginSchema), authController.staffLogin);
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshAccessToken);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// Protected routes
router.post('/logout', verifyJWT, authController.logout);
router.post('/logout-all', verifyJWT, authController.logoutAllDevices);
router.post('/change-password', verifyJWT, validate(changePasswordSchema), authController.changePassword);
router.get('/me', verifyJWT, authController.getCurrentUser);

// Staff/Admin only routes
router.post(
  '/register/staff',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  validate(registerStaffSchema),
  authController.registerStaff
);

router.post(
  '/verify/:userId',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  validate(userIdParamSchema),
  authController.verifyUser
);

router.post(
  '/block/:userId',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  validate(userIdParamSchema),
  authController.blockUser
);

router.post(
  '/unblock/:userId',
  verifyJWT,
  checkRole('staff', 'internal', 'super-admin'),
  validate(userIdParamSchema),
  authController.unblockUser
);

export default router;
