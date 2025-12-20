import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.model.js';

/**
 * Verify JWT Token
 * Extracts token from cookies or Authorization header
 * Verifies token and attaches user to req.user
 */
export const verifyJWT = asyncHandler(async (req, res, next) => {
  // Extract token from cookies or Authorization header
  const token = req.cookies?.accessToken || 
                req.header("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    throw new ApiError(401, "Unauthorized - No token provided");
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
    // Find user and exclude sensitive fields
    const user = await User.findById(decoded._id).select("-password");
    
    if (!user) {
      throw new ApiError(401, "Invalid token - User not found");
    }
    
    // Check if user is deleted
    if (user.isDeleted) {
      throw new ApiError(401, "User account has been deleted");
    }
    
    // Check if user is blocked
    if (user.status === 'blocked') {
      throw new ApiError(403, "Account blocked - Please contact support");
    }
    
    // Check if user is inactive
    if (user.status === 'inactive') {
      throw new ApiError(403, "Account inactive - Please contact support");
    }
    
    // Check if account is locked
    if (user.isLocked) {
      throw new ApiError(403, "Account locked due to multiple failed login attempts");
    }
    
    // Attach user to request
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, "Invalid token");
    }
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, "Token expired");
    }
    throw error;
  }
});

/**
 * Check User Role
 * Verifies if authenticated user has one of the required roles
 * @param {...string} roles - Allowed roles (e.g., 'customer', 'driver', 'staff')
 * @returns {Function} Express middleware
 */
export const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized - Authentication required");
    }
    
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `Access denied - Required role: ${roles.join(' or ')}`);
    }
    
    next();
  };
};

/**
 * Optional JWT Verification
 * Attaches user to request if token is valid, but doesn't throw error if missing
 * Useful for routes that work with or without authentication
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.accessToken || 
                req.header("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded._id).select("-password");
    
    if (user && !user.isDeleted && user.status === 'active') {
      req.user = user;
    }
  } catch (error) {
    // Silently fail - token is optional
  }
  
  next();
});

/**
 * Check if user owns the resource or has admin privileges
 * @param {string} resourceUserIdField - Field name containing the user ID in the resource
 * @returns {Function} Express middleware
 */
export const checkOwnershipOrAdmin = (resourceUserIdField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized - Authentication required");
    }
    
    // Super-admin and staff can access any resource
    if (['super-admin', 'staff', 'internal'].includes(req.user.role)) {
      return next();
    }
    
    // Check ownership
    const resourceUserId = req[resourceUserIdField] || req.params[resourceUserIdField];
    
    if (!resourceUserId) {
      throw new ApiError(400, "Resource user ID not found");
    }
    
    if (resourceUserId.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Access denied - You can only access your own resources");
    }
    
    next();
  };
};

/**
 * Rate Limiter for Authentication Routes
 * Prevents brute force attacks
 */
export const authRateLimiter = asyncHandler(async (req, res, next) => {
  // This is a placeholder - actual implementation should use Redis
  // or express-rate-limit package
  next();
});

/**
 * Verify Firebase ID Token (for mobile OTP login)
 */
export const verifyFirebaseToken = asyncHandler(async (req, res, next) => {
  const { idToken } = req.body;
  
  if (!idToken) {
    throw new ApiError(400, "Firebase ID token is required");
  }
  
  try {
    // Import Firebase Admin only when needed
    const admin = await import('../config/firebase.js');
    
    // Verify the Firebase ID token
    const decodedToken = await admin.default.auth().verifyIdToken(idToken);
    
    // Attach decoded token to request
    req.firebaseUser = {
      uid: decodedToken.uid,
      phone: decodedToken.phone_number,
      email: decodedToken.email
    };
    
    next();
    
  } catch (error) {
    throw new ApiError(401, `Invalid Firebase token: ${error.message}`);
  }
});

export default {
  verifyJWT,
  checkRole,
  optionalAuth,
  checkOwnershipOrAdmin,
  authRateLimiter,
  verifyFirebaseToken
};
