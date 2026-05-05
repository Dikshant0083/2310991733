import { createLogger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('Middleware');

/**
 * Attach request-scoped metadata used by responses and logs.
 */
export const requestContext = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  req.requestStartedAt = Date.now();
  res.setHeader('X-Request-ID', req.id);

  const originalEnd = res.end.bind(res);
  res.end = (...args) => {
    req.executionTimeMs = Date.now() - req.requestStartedAt;
    res.setHeader('X-Execution-Time', `${req.executionTimeMs}ms`);
    return originalEnd(...args);
  };

  next();
};

/**
 * Request timing middleware.
 */
export const requestTiming = (req, res, next) => {
  next();
};

/**
 * Mock authentication middleware (pre-authorized)
 */
export const authenticate = (req, res, next) => {
  const headerStudentId = Number.parseInt(req.headers['x-student-id'], 10);

  req.user = {
    id: Number.isFinite(headerStudentId) ? headerStudentId : 1042,
    role: req.headers['x-student-role'] || 'student',
  };

  next();
};

/**
 * Error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
    requestId: req.id,
    statusCode: err.statusCode || 500,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const details = Array.isArray(err.details) ? err.details : undefined;

  return res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      executionTime: req.executionTimeMs ? `${req.executionTimeMs}ms` : undefined,
    },
  });
};

/**
 * Not found middleware
 */
export const notFound = (req, res) => {
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      executionTime: req.executionTimeMs ? `${req.executionTimeMs}ms` : undefined,
    },
  });
};
