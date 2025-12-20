import User from '../models/user.model.js';
import Customer from '../models/customer.model.js';
import Driver from '../models/driver.model.js';
import Staff from '../models/staff.model.js';
import Permission from '../models/permission.model.js';
import RefreshToken from '../models/refreshToken.model.js';
import ApiError from '../utils/ApiError.js';
import admin from '../config/firebase.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
/**
 * Authentication Service
 * Handles user authentication, registration, and token management
 */
class AuthService {
  /**
   * Mobile Login with Firebase OTP
   * @param {string} idToken - Firebase ID token
   * @param {string} role - User role (customer/driver)
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} User and tokens
   */
  static async mobileLogin(idToken, role, deviceInfo = {}, testPhone = null) {
    try {
      let phone;
      let firebaseUid;

      // Allow bypass for testing in development
      if (process.env.NODE_ENV === 'development' && idToken === 'dev-test-token' && testPhone) {
        phone = testPhone;
        firebaseUid = `test-uid-${phone}`;
      } else {
        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        phone = decodedToken.phone_number;
        firebaseUid = decodedToken.uid;
      }

      if (!phone) {
        throw new ApiError(400, 'Phone number not found in token');
      }

      // Find or create user
      let user = await User.findOne({ phone, isDeleted: false });

      if (!user) {
        // Create new user
        user = await User.create({
          phone,
          role,
          firebaseUid,
          status: 'pending-verification',
          fcmToken: deviceInfo.fcmToken
        });

        // Create corresponding profile based on role
        if (role === 'customer') {
          await Customer.create({
            user: user._id,
            companyName: 'New Customer', // Placeholder
            createdBy: user._id
          });
        } else if (role === 'driver') {
          await Driver.create({
            user: user._id,
            name: 'New Driver', // Placeholder
            licenseNumber: 'PENDING',
            createdBy: user._id
          });
        }
      } else {
        // Check if account is locked
        if (user.isLocked) {
          throw new ApiError(403, 'Account locked due to multiple failed login attempts');
        }

        // Update FCM token if provided
        if (deviceInfo.fcmToken && user.fcmToken !== deviceInfo.fcmToken) {
          user.fcmToken = deviceInfo.fcmToken;
        }

        // Update last login
        user.lastLogin = new Date();
        user.sessionMeta = {
          deviceModel: deviceInfo.deviceModel,
          lastIp: deviceInfo.ipAddress
        };
        await user.save();
      }

      // Generate tokens
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      // Store refresh token hash
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      await RefreshToken.create({
        user: user._id,
        tokenHash,
        deviceInfo: {
          model: deviceInfo.deviceModel,
          os: deviceInfo.os,
          appVersion: deviceInfo.appVersion
        },
        ipAddress: deviceInfo.ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      // Remove sensitive data
      const userObject = user.toObject();
      delete userObject.password;

      return {
        user: userObject,
        accessToken,
        refreshToken
      };
    } catch (error) {
      if (error.code === 'auth/id-token-expired') {
        throw new ApiError(401, 'Firebase token expired');
      }
      if (error.code === 'auth/invalid-id-token') {
        throw new ApiError(401, 'Invalid Firebase token');
      }
      throw error;
    }
  }

  /**
   * Staff Login with Email/Password
   * @param {string} email - Staff email
   * @param {string} password - Staff password
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} User and tokens
   */
  static async staffLogin(email, password, deviceInfo = {}) {
    // Find user by email
    const user = await User.findOne({
      email,
      role: { $in: ['staff', 'internal', 'super-admin'] },
      isDeleted: false
    }).select('+password');

    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // Check if account is locked
    if (user.isLocked) {
      throw new ApiError(403, 'Account locked. Please try again later.');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      throw new ApiError(401, 'Invalid email or password');
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();
    user.sessionMeta = {
      deviceModel: deviceInfo.deviceModel,
      lastIp: deviceInfo.ipAddress
    };
    await user.save();

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Store refresh token hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await RefreshToken.create({
      user: user._id,
      tokenHash,
      deviceInfo: {
        model: deviceInfo.deviceModel,
        os: deviceInfo.os,
        appVersion: deviceInfo.appVersion
      },
      ipAddress: deviceInfo.ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    // Remove sensitive data
    const userObject = user.toObject();
    delete userObject.password;

    return {
      user: userObject,
      accessToken,
      refreshToken
    };
  }

  /**
   * Register Staff/Internal User
   * @param {Object} data - User data
   * @param {string} createdBy - ID of user creating this account
   * @returns {Promise<Object>} Created user
   */
  static async registerStaff(data, createdBy) {
    const {
      email,
      phone,
      password,
      role,
      name,
      department,
      title,
      reportingManager,
      workingHours,
      permissions
    } = data;

    // Check if email already exists
    const existingUser = await User.findOne({ email, isDeleted: false });
    if (existingUser) {
      throw new ApiError(400, 'Email already registered');
    }

    // Validate role
    if (!['staff', 'internal', 'super-admin'].includes(role)) {
      throw new ApiError(400, 'Invalid role for staff registration');
    }

    // Verify reporting manager if provided
    if (reportingManager) {
      const manager = await Staff.findById(reportingManager);
      if (!manager || manager.isDeleted) {
        throw new ApiError(404, 'Reporting manager not found');
      }
    }

    // Verify permissions if provided
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({
        _id: { $in: permissions },
        isDeleted: false
      });
      if (validPermissions.length !== permissions.length) {
        throw new ApiError(400, 'One or more invalid permissions');
      }
    }

    // Create user
    const user = await User.create({
      email,
      phone,
      password,
      role,
      status: 'active',
      createdBy
    });

    // Create staff profile
    await Staff.create({
      user: user._id,
      name,
      department,
      title,
      reportingManager,
      workingHours,
      permissions: permissions || [],
      isActive: true,
      createdBy
    });

    // Remove sensitive data
    const userObject = user.toObject();
    delete userObject.password;

    return userObject;
  }

  /**
   * Refresh Access Token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New access token
   */
  static async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new ApiError(401, 'Refresh token required');
    }

    try {
      // Verify refresh token
      const decoded = await admin.auth().verifyIdToken(refreshToken);

      // Hash the refresh token
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      // Find refresh token in database
      const storedToken = await RefreshToken.findOne({
        user: decoded._id,
        tokenHash
      }).select('+tokenHash');

      if (!storedToken) {
        throw new ApiError(401, 'Invalid refresh token');
      }

      // Check if token is revoked
      if (storedToken.isRevoked) {
        throw new ApiError(401, 'Refresh token has been revoked');
      }

      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        throw new ApiError(401, 'Refresh token expired');
      }

      // Get user
      const user = await User.findById(decoded._id);
      if (!user || user.isDeleted) {
        throw new ApiError(401, 'User not found');
      }

      // Generate new access token
      const accessToken = user.generateAccessToken();

      // Update last used
      storedToken.lastUsedAt = new Date();
      await storedToken.save();

      return { accessToken };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new ApiError(401, 'Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Logout User
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token to revoke
   * @returns {Promise<void>}
   */
  static async logout(userId, refreshToken) {
    if (refreshToken) {
      // Hash the refresh token
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      // Find and revoke the token
      const storedToken = await RefreshToken.findOne({
        user: userId,
        tokenHash
      });

      if (storedToken) {
        await storedToken.revoke('user_logout');
      }
    }

    // Could also add user to a blacklist here if needed
  }

  /**
   * Logout from all devices
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async logoutAllDevices(userId) {
    // Revoke all refresh tokens for the user
    await RefreshToken.updateMany(
      { user: userId, isRevoked: false },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'logout_all_devices'
        }
      }
    );
  }

  /**
   * Change Password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  static async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Revoke all existing refresh tokens
    await this.logoutAllDevices(userId);
  }

  /**
   * Reset Password (for staff who forgot password)
   * @param {string} email - User email
   * @returns {Promise<string>} Temporary password
   */
  static async resetPassword(email) {
    const user = await User.findOne({
      email,
      role: { $in: ['staff', 'internal', 'super-admin'] },
      isDeleted: false
    });

    if (!user) {
      // Don't reveal if user exists
      throw new ApiError(404, 'If this email exists, a reset link has been sent');
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Update user password
    user.password = tempPassword;
    await user.save();

    // Revoke all tokens
    await this.logoutAllDevices(user._id);

    // TODO: Send email with temporary password
    // await EmailService.sendPasswordReset(email, tempPassword);

    return tempPassword; // In production, don't return this, just send email
  }

  /**
   * Verify User Account
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated user
   */
  static async verifyUser(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    user.status = 'active';
    await user.save();

    // Update corresponding profile
    if (user.role === 'customer') {
      const customer = await Customer.findOne({ user: userId });
      if (customer) {
        customer.isVerified = true;
        customer.verifiedAt = new Date();
        await customer.save();
      }
    } else if (user.role === 'driver') {
      const driver = await Driver.findOne({ user: userId });
      if (driver) {
        driver.isVerified = true;
        driver.verifiedAt = new Date();
        await driver.save();
      }
    }

    return user.toObject();
  }

  /**
   * Block User Account
   * @param {string} userId - User ID to block
   * @param {string} blockedBy - ID of user performing the action
   * @returns {Promise<Object>} Updated user
   */
  static async blockUser(userId, blockedBy) {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    user.status = 'blocked';
    await user.save();

    // Revoke all tokens
    await this.logoutAllDevices(userId);

    return user.toObject();
  }

  /**
   * Unblock User Account
   * @param {string} userId - User ID to unblock
   * @returns {Promise<Object>} Updated user
   */
  static async unblockUser(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    user.status = 'active';
    await user.save();

    return user.toObject();
  }
}

export default AuthService;
