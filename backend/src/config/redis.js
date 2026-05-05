import { createClient } from 'redis';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Redis');

let redisClient = null;

const buildRedisOptions = () => {
  const host = process.env.REDIS_HOST || 'localhost';
  const parsedPort = Number.parseInt(process.env.REDIS_PORT, 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : 6379;
  const username = process.env.REDIS_USERNAME?.trim();
  const password = process.env.REDIS_PASSWORD?.trim();

  const options = {
    socket: {
      host,
      port,
      connectTimeout: 5000,
      reconnectStrategy: false,
    },
  };

  if (password) {
    options.password = password;
  }

  if (username && password) {
    options.username = username;
  }

  return options;
};

export const connectRedis = async () => {
  let nextClient = null;
  let hasConnected = false;

  try {
    if (redisClient?.isOpen) {
      return redisClient;
    }

    nextClient = createClient(buildRedisOptions());

    nextClient.on('error', (err) => {
      if (!hasConnected) {
        return;
      }

      logger.error('Redis client error', err);
    });

    nextClient.on('connect', () => {
      hasConnected = true;
      logger.info('Redis connected');
    });

    nextClient.on('disconnect', () => {
      logger.info('Redis disconnected');
    });

    await nextClient.connect();
    
    // Test connection
    await nextClient.ping();
    redisClient = nextClient;
    logger.info('Redis ping successful');

    return redisClient;
  } catch (error) {
    if (nextClient) {
      await nextClient.disconnect().catch(() => null);
    }

    redisClient = null;
    logger.warn('Redis unavailable, continuing without cache', {
      error: error.message,
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || '6379',
    });

    return null;
  }
};

export const getRedisClient = () => {
  return redisClient;
};

export const isRedisConnected = () => Boolean(redisClient?.isOpen);

export const disconnectRedis = async () => {
  try {
    if (redisClient) {
      await redisClient.disconnect();
      logger.info('Redis disconnected');
    }
  } catch (error) {
    logger.error('Redis disconnection failed', error);
  }
};

export default redisClient;
