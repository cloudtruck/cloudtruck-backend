import { createClient } from 'redis';
import logger from '../utils/logger.js';

let client

export const connectRedis = async () => {
  try {
    client = createClient({
      username: 'default',
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            logger.warn('Redis connection failed after 3 retries. Disabling Redis.');
            return false; // Stop retrying
          }
          return 2000;
        }
      }
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    client.on('error', (err) => {
      logger.error('Redis client error:', err.message || err);
    });

    client.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...');
    });

    client.on('end', () => {
      logger.warn('Redis client disconnected');
    });

    await client.connect();
    return client;
  } catch (err) {
    logger.warn(`Redis failed to connect: ${err.message || err}. Continuing without Redis.`);
    return null;
  }
};

export const getRedisClient = () => {
  if (!client) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return client;
};

export const disconnectRedis = async () => {
  if (client) {
    await client.quit();
    client = null;
    logger.info('Redis client disconnected');
  }
};

export default {
  connectRedis,
  getRedisClient,
  disconnectRedis
};
