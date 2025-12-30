import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../config/redis.js';
import ApiError from '../utils/ApiError.js';

/**
 * Custom key generator for rate limiter
 * Uses user ID if authenticated, otherwise IP address
 */
const keyGenerator = (req) => {
  // Use user ID if authenticated
  if (req.user && req.user._id) {
    return `user:${req.user._id}`;
  }
  // Fall back to IP address
  return req.ip || req.connection.remoteAddress;
};

/**
 * Custom handler for rate limit exceeded
 */
const handler = (req, res) => {
  throw new ApiError(
    429, 
    'Too many requests from this IP/user, please try again later'
  );
};

/**
 * Helper to create Redis store if available
 */
const createRedisStore = (prefix) => {
  try {
    if (redisClient && redisClient.isOpen) {
      return new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix,
      });
    }
  } catch (error) {
    console.warn(`Redis store not available for rate limiting (${prefix}), using memory store`);
  }
  return undefined;
};

/**
 * Global Rate Limiter
 * Applies to all routes
 * Limits: 100 requests per 15 minutes per IP/user
 */
export const globalLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS | 15 * 60 * 1000, // 15 minutes
  max: process.env.GLOBAL_RATE_LIMIT | 200, // Limit each IP/user to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator,
  handler,
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === '/health' || req.path === '/api/v1/health';
  },
  store: createRedisStore('rl:global:')
});

/**
 * Auth Rate Limiter
 * For login, register, OTP endpoints
 * Stricter limits to prevent brute force attacks
 * Limits: 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  handler,
  store: createRedisStore('rl:auth:')
});

/**
 * OTP Rate Limiter
 * For OTP generation endpoints
 * Very strict to prevent SMS bombing
 * Limits: 3 requests per hour per phone number
 */
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each phone to 3 OTP requests per hour
  message: 'Too many OTP requests for this phone number, please try again later',
  keyGenerator: (req) => {
    // Use phone number from request body
    const phone = req.body?.phone || req.query?.phone;
    return phone ? `phone:${phone}` : (req.ip || req.connection.remoteAddress);
  },
  handler,
  store: createRedisStore('rl:otp:')
});

/**
 * File Upload Rate Limiter
 * For document/image upload endpoints
 * Moderate limits to prevent storage abuse
 * Limits: 20 uploads per hour per user
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each user to 20 uploads per hour
  message: 'Too many file uploads, please try again later',
  keyGenerator,
  handler,
  store: createRedisStore('rl:upload:')
});

/**
 * Payment Rate Limiter
 * For payment initiation endpoints
 * Strict limits to prevent payment spam
 * Limits: 10 payment attempts per hour per user
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each user to 10 payment attempts per hour
  message: 'Too many payment attempts, please try again later',
  keyGenerator,
  handler,
  store: createRedisStore('rl:payment:')
});

/**
 * API Rate Limiter
 * For general API endpoints
 * Moderate limits for normal operations
 * Limits: 60 requests per minute per user
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each user to 60 requests per minute
  message: 'Too many requests, please try again later',
  keyGenerator,
  handler,
  store: createRedisStore('rl:api:')
});

/**
 * Tracking Rate Limiter
 * For GPS location updates from drivers
 * Higher limits as these are frequent
 * Limits: 1000 requests per minute per driver
 */
export const trackingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Limit each driver to 1000 location updates per minute
  message: 'Too many tracking updates, please slow down',
  keyGenerator,
  handler,
  store: createRedisStore('rl:tracking:')
});

export default {
  globalLimiter,
  authLimiter,
  otpLimiter,
  uploadLimiter,
  paymentLimiter,
  apiLimiter,
  trackingLimiter
};
