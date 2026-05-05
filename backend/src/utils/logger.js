import fs from 'fs';
import path from 'path';
import winston from 'winston';

const logDirectory = process.env.LOG_DIR || path.resolve(process.cwd(), 'logs');
fs.mkdirSync(logDirectory, { recursive: true });

const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'campus-notification-system',
    environment: process.env.NODE_ENV || 'development',
  },
  format: baseFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logDirectory, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDirectory, 'combined.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

if ((process.env.NODE_ENV || 'development') !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, context, ...meta }) => {
          const serializedMeta = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] ${level}${context ? ` [${context}]` : ''}: ${message}${serializedMeta}`;
        })
      ),
    })
  );
}

const normalizeError = (error) => {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return {
    message: String(error),
  };
};

export const createLogger = (context) => ({
  info: (message, meta = {}) => {
    logger.info(message, { context, ...meta });
  },
  warn: (message, meta = {}) => {
    logger.warn(message, { context, ...meta });
  },
  debug: (message, meta = {}) => {
    logger.debug(message, { context, ...meta });
  },
  error: (message, error, meta = {}) => {
    logger.error(message, {
      context,
      error: normalizeError(error),
      ...meta,
    });
  },
});

export const requestLogger = (req, res, next) => {
  res.on('finish', () => {
    logger.info('API request completed', {
      context: 'RequestLogger',
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      executionTimeMs: req.executionTimeMs ?? null,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      studentId: req.user?.id,
    });
  });

  next();
};

export default logger;
