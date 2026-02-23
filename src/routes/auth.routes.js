import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  sendOTPSchema,
  verifyOTPSchema,
  mobileLoginSchema,
  staffLoginSchema,
  registerStaffSchema,
  refreshTokenSchema,
  changePasswordSchema,
  resetPasswordSchema,
  updateLanguageSchema,
  userIdParamSchema
} from '../validators/auth.validator.js';

const router = express.Router();

// Public routes
router.post('/otp/send', validate(sendOTPSchema), authController.sendOTP);
router.post('/otp/resend', validate(sendOTPSchema), authController.resendOTP);
router.post('/otp/verify', validate(verifyOTPSchema), authController.verifyOTP);
router.post('/login/mobile', validate(mobileLoginSchema), authController.mobileLogin);
router.post('/login/staff', validate(staffLoginSchema), authController.staffLogin);
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshAccessToken);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// Protected routes
router.post('/logout', verifyJWT, authController.logout);
router.post('/logout-all', verifyJWT, authController.logoutAllDevices);
router.post('/change-password', verifyJWT, validate(changePasswordSchema), authController.changePassword);
router.get('/me', verifyJWT, authController.getCurrentUser);
router.patch('/language', verifyJWT, validate(updateLanguageSchema), authController.updateLanguage);

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
