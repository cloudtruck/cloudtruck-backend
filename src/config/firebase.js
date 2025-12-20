import admin from 'firebase-admin';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();
let firebaseInitialized = false;

try {
  // Check if required Firebase environment variables are present
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized successfully');
  } else {
    logger.warn('Firebase credentials not configured. Firebase features will be disabled.');
    logger.warn('Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to enable Firebase.');
  }
} catch (error) {
  logger.error('Firebase Admin SDK initialization failed:', error.message);
  logger.warn('Firebase features will be disabled. App will continue without Firebase.');
}

export { firebaseInitialized };
export default admin;
