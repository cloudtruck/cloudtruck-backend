import logger from '../utils/logger.js';

/**
 * Validate required environment variables
 */
export const validateEnvironment = () => {
  const requiredVars = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET'
  ];

  // Variables that are required for specific features
  const featureRequiredVars = [
    { name: 'GOOGLE_MAPS_API_KEY', feature: 'Google Maps (Tracking & Geocoding)' }
  ];

  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  featureRequiredVars.forEach(v => {
    if (!process.env[v.name]) {
      logger.warn(`${v.feature} feature is disabled because ${v.name} is missing.`);
    }
  });

  logger.info('Environment variables validated');
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  mongodbUri: process.env.MONGODB_URI,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
};

export default config;
