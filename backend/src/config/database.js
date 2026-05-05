import mongoose from 'mongoose';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Database');
const LOCAL_MONGO_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const mongoOptions = {
  maxPoolSize: 10,
  minPoolSize: 5,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
};

const isAuthenticationFailure = (error) =>
  /authentication failed/i.test(error?.message || '');

const stripMongoCredentials = (mongoUri) => {
  try {
    const parsedUri = new URL(mongoUri);
    parsedUri.username = '';
    parsedUri.password = '';
    return parsedUri.toString();
  } catch {
    return mongoUri.replace(/(mongodb(?:\+srv)?:\/\/)[^/@]+@/i, '$1');
  }
};

const shouldRetryWithoutCredentials = (mongoUri, error) => {
  if (!isAuthenticationFailure(error)) {
    return false;
  }

  try {
    const parsedUri = new URL(mongoUri);
    return Boolean(parsedUri.username) && LOCAL_MONGO_HOSTS.has(parsedUri.hostname);
  } catch {
    return /^mongodb(?:\+srv)?:\/\/[^/@]+@(?:localhost|127\.0\.0\.1|\[::1\])/i.test(mongoUri);
  }
};

const connectWithUri = async (mongoUri) =>
  mongoose.connect(mongoUri, mongoOptions);

export const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable not set');
    }

    let connection;

    try {
      connection = await connectWithUri(mongoUri);
    } catch (error) {
      if (!shouldRetryWithoutCredentials(mongoUri, error)) {
        throw error;
      }

      const fallbackUri = stripMongoCredentials(mongoUri);
      logger.warn('MongoDB auth failed on a local URI, retrying without credentials', {
        fallbackUri,
      });

      connection = await connectWithUri(fallbackUri);
    }

    logger.info('MongoDB connected successfully', {
      host: connection.connection.host,
      database: connection.connection.name
    });

    return connection;
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    process.exit(1);
  }
};

export const disconnectMongoDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('MongoDB disconnection failed', error);
  }
};

export default mongoose;
