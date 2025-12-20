import { createClient } from 'redis';
import logger from '../utils/logger.js';

let client

export const connectRedis = async () => {

    client = createClient({
      username: 'default',
      password: process.env.REDIS_PASSWORD,
      socket: {
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT
      }
  });

  client.on('error', err => console.log('Redis Client Error', err));

    client.on('connect', () => {
      logger.info('Redis client connected');
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    client.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    client.on('end', () => {
      logger.warn('Redis client disconnected');
    });

    await client.connect();
    return client;
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
