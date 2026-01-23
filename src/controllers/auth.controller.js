import AuthService from '../services/auth.service.js';
import * as otpService from '../services/otp.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

/**
 * Send OTP
 * POST /api/v1/auth/otp/send
 */
export const sendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  
  const result = await otpService.sendOTP(phone);
  
  return res.status(200).json(
    new ApiResponse(200, { sessionId: result.sessionId }, 'OTP sent successfully')
  );
});

/**
 * Resend OTP
 * POST /api/v1/auth/otp/resend
 */
export const resendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  
  const result = await otpService.resendOTP(phone);
  
  return res.status(200).json(
    new ApiResponse(200, null, 'OTP resent successfully')
  );
});

/**
 * Verify OTP and Login
 * POST /api/v1/auth/otp/verify
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp, role, deviceInfo } = req.body;
  
  const verification = await otpService.verifyOTP(phone, otp);
  
  if (!verification.success) {
    throw new ApiError(401, verification.message || 'Invalid OTP');
  }
  
  // If verification successful, perform login
  const result = await AuthService.mobileLogin(phone, role, deviceInfo);

  // Set tokens in cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  };

  res.cookie('accessToken', result.accessToken, cookieOptions);
  res.cookie('refreshToken', result.refreshToken, cookieOptions);

  return res.status(200).json(
    new ApiResponse(200, result, 'Login successful')
  );
});

/**
 * Mobile Login (Legacy/Direct)
 * POST /api/v1/auth/login/mobile
 */
export const mobileLogin = asyncHandler(async (req, res) => {
  const { phone, role, deviceInfo } = req.body;

  const result = await AuthService.mobileLogin(phone, role, deviceInfo);

  // Set tokens in cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  };

  res.cookie('accessToken', result.accessToken, cookieOptions);
  res.cookie('refreshToken', result.refreshToken, cookieOptions);

  return res.status(200).json(
    new ApiResponse(200, result, 'Login successful')
  );
});

/**
 * Staff Login with Email/Password
 * POST /api/v1/auth/login/staff
 */
export const staffLogin = asyncHandler(async (req, res) => {
  const { email, password, deviceInfo } = req.body;

  const result = await AuthService.staffLogin(email, password, deviceInfo);

  // Set tokens in cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  };

  res.cookie('accessToken', result.accessToken, cookieOptions);
  res.cookie('refreshToken', result.refreshToken, cookieOptions);

  return res.status(200).json(
    new ApiResponse(200, result, 'Login successful')
  );
});

/**
 * Register Staff/Internal User
 * POST /api/v1/auth/register/staff
 */
export const registerStaff = asyncHandler(async (req, res) => {
  const staffData = req.body;
  const createdBy = req.user._id;

  const user = await AuthService.registerStaff(staffData, createdBy);

  return res.status(201).json(
    new ApiResponse(201, user, 'Staff registered successfully')
  );
});

/**
 * Refresh Access Token
 * POST /api/v1/auth/refresh-token
 */
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  const result = await AuthService.refreshAccessToken(refreshToken);

  // Set new tokens in cookies (Rotation)
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days for refresh token
  };

  res.cookie('accessToken', result.accessToken, cookieOptions);
  res.cookie('refreshToken', result.refreshToken, cookieOptions);

  return res.status(200).json(
    new ApiResponse(200, result, 'Token refreshed successfully')
  );
});

/**
 * Logout User
 * POST /api/v1/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  await AuthService.logout(userId, refreshToken);

  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  return res.status(200).json(
    new ApiResponse(200, null, 'Logout successful')
  );
});

/**
 * Logout from All Devices
 * POST /api/v1/auth/logout-all
 */
export const logoutAllDevices = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await AuthService.logoutAllDevices(userId);

  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  return res.status(200).json(
    new ApiResponse(200, null, 'Logged out from all devices')
  );
});

/**
 * Change Password
 * POST /api/v1/auth/change-password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  await AuthService.changePassword(userId, currentPassword, newPassword);

  return res.status(200).json(
    new ApiResponse(200, null, 'Password changed successfully')
  );
});

/**
 * Reset Password
 * POST /api/v1/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  await AuthService.resetPassword(email);

  return res.status(200).json(
    new ApiResponse(200, null, 'Password reset instructions sent')
  );
});

/**
 * Verify User Account
 * POST /api/v1/auth/verify/:userId
 */
export const verifyUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await AuthService.verifyUser(userId);

  return res.status(200).json(
    new ApiResponse(200, user, 'User verified successfully')
  );
});

/**
 * Block User Account
 * POST /api/v1/auth/block/:userId
 */
export const blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const blockedBy = req.user._id;

  const user = await AuthService.blockUser(userId, blockedBy);

  return res.status(200).json(
    new ApiResponse(200, user, 'User blocked successfully')
  );
});

/**
 * Unblock User Account
 * POST /api/v1/auth/unblock/:userId
 */
export const unblockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await AuthService.unblockUser(userId);

  return res.status(200).json(
    new ApiResponse(200, user, 'User unblocked successfully')
  );
});

/**
 * Get Current User
 * GET /api/v1/auth/me
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, req.user, 'User fetched successfully')
  );
});
