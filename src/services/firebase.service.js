import admin from '../config/firebase.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

class FirebaseService {
  /**
   * Verify Firebase ID token
   * @param {String} idToken - Firebase ID token from client
   * @returns {Promise<Object>} - Decoded token
   */
  static async verifyIdToken(idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      logger.error('Firebase token verification failed:', error);
      throw new ApiError(401, 'Invalid or expired token');
    }
  }

  /**
   * Get user by phone number
   * @param {String} phone - Phone number with country code
   * @returns {Promise<Object>} - Firebase user record
   */
  static async getUserByPhone(phone) {
    try {
      const userRecord = await admin.auth().getUserByPhoneNumber(phone);
      return userRecord;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return null;
      }
      logger.error('Firebase get user by phone failed:', error);
      throw new ApiError(500, 'Failed to fetch user from Firebase');
    }
  }

  /**
   * Get user by UID
   * @param {String} uid - Firebase UID
   * @returns {Promise<Object>} - Firebase user record
   */
  static async getUserByUid(uid) {
    try {
      const userRecord = await admin.auth().getUser(uid);
      return userRecord;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return null;
      }
      logger.error('Firebase get user by UID failed:', error);
      throw new ApiError(500, 'Failed to fetch user from Firebase');
    }
  }

  /**
   * Create custom token for user
   * @param {String} uid - Firebase UID
   * @param {Object} claims - Additional claims
   * @returns {Promise<String>} - Custom token
   */
  static async createCustomToken(uid, claims = {}) {
    try {
      const customToken = await admin.auth().createCustomToken(uid, claims);
      return customToken;
    } catch (error) {
      logger.error('Firebase create custom token failed:', error);
      throw new ApiError(500, 'Failed to create custom token');
    }
  }

  /**
   * Set custom user claims
   * @param {String} uid - Firebase UID
   * @param {Object} claims - Custom claims
   * @returns {Promise<void>}
   */
  static async setCustomUserClaims(uid, claims) {
    try {
      await admin.auth().setCustomUserClaims(uid, claims);
      logger.info('Custom claims set:', { uid, claims });
    } catch (error) {
      logger.error('Firebase set custom claims failed:', error);
      throw new ApiError(500, 'Failed to set custom claims');
    }
  }

  /**
   * Delete Firebase user
   * @param {String} uid - Firebase UID
   * @returns {Promise<void>}
   */
  static async deleteUser(uid) {
    try {
      await admin.auth().deleteUser(uid);
      logger.info('Firebase user deleted:', { uid });
    } catch (error) {
      logger.error('Firebase delete user failed:', error);
      // Don't throw - user might already be deleted
    }
  }

  /**
   * Revoke refresh tokens for user
   * @param {String} uid - Firebase UID
   * @returns {Promise<void>}
   */
  static async revokeRefreshTokens(uid) {
    try {
      await admin.auth().revokeRefreshTokens(uid);
      logger.info('Refresh tokens revoked:', { uid });
    } catch (error) {
      logger.error('Firebase revoke refresh tokens failed:', error);
      throw new ApiError(500, 'Failed to revoke refresh tokens');
    }
  }

  /**
   * Update user profile
   * @param {String} uid - Firebase UID
   * @param {Object} profile - Profile data
   * @returns {Promise<Object>} - Updated user record
   */
  static async updateUser(uid, profile) {
    try {
      const userRecord = await admin.auth().updateUser(uid, profile);
      logger.info('Firebase user updated:', { uid });
      return userRecord;
    } catch (error) {
      logger.error('Firebase update user failed:', error);
      throw new ApiError(500, 'Failed to update user profile');
    }
  }

  /**
   * Disable user account
   * @param {String} uid - Firebase UID
   * @returns {Promise<void>}
   */
  static async disableUser(uid) {
    try {
      await admin.auth().updateUser(uid, { disabled: true });
      logger.info('Firebase user disabled:', { uid });
    } catch (error) {
      logger.error('Firebase disable user failed:', error);
      throw new ApiError(500, 'Failed to disable user');
    }
  }

  /**
   * Enable user account
   * @param {String} uid - Firebase UID
   * @returns {Promise<void>}
   */
  static async enableUser(uid) {
    try {
      await admin.auth().updateUser(uid, { disabled: false });
      logger.info('Firebase user enabled:', { uid });
    } catch (error) {
      logger.error('Firebase enable user failed:', error);
      throw new ApiError(500, 'Failed to enable user');
    }
  }

  /**
   * Generate password reset link
   * @param {String} email - User email
   * @returns {Promise<String>} - Password reset link
   */
  static async generatePasswordResetLink(email) {
    try {
      const link = await admin.auth().generatePasswordResetLink(email);
      return link;
    } catch (error) {
      logger.error('Firebase generate password reset link failed:', error);
      throw new ApiError(500, 'Failed to generate password reset link');
    }
  }

  /**
   * Generate email verification link
   * @param {String} email - User email
   * @returns {Promise<String>} - Email verification link
   */
  static async generateEmailVerificationLink(email) {
    try {
      const link = await admin.auth().generateEmailVerificationLink(email);
      return link;
    } catch (error) {
      logger.error('Firebase generate email verification link failed:', error);
      throw new ApiError(500, 'Failed to generate email verification link');
    }
  }
}

export default FirebaseService;
