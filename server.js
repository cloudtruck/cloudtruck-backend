import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './src/app.js';
import connectDB from './src/config/database.js';
import { connectRedis } from './src/config/redis.js';
import logger from './src/utils/logger.js';
import trackingSocketHandler from './src/sockets/tracking.socket.js';
import notificationSocketHandler from './src/sockets/notification.socket.js';

// Load environment variables from backend/.env
dotenv.config();

// Environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Socket.io namespaces
const trackingNamespace = io.of('/tracking');
const notificationNamespace = io.of('/notifications');

// Socket handlers
trackingSocketHandler(trackingNamespace);
notificationSocketHandler(notificationNamespace);

// Make io accessible to routes
app.set('io', io);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Close server
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connections
      if (mongoose.connection?.readyState === 1) {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
      }
      
      // Close Redis connection
      const redis = await connectRedis();
      if (redis?.isOpen) {
        await redis.quit();
        logger.info('Redis connection closed');
      }
      
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('MongoDB connected successfully');
    
    // Connect to Redis
    const redis = await connectRedis();
    logger.info('Redis connected successfully');
    
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);
      logger.info(`API available at http://localhost:${PORT}/api/v1`);
      logger.info(`WebSocket tracking available at ws://localhost:${PORT}/tracking`);
      logger.info(`WebSocket notifications available at ws://localhost:${PORT}/notifications`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
