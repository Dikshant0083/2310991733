import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectMongoDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import messageQueue from './config/messageQueue.js';
import { requestLogger, createLogger } from './utils/logger.js';
import { authenticate, errorHandler, notFound, requestContext, requestTiming } from './middleware/index.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { setIO } from './utils/socketGateway.js';
import { startNotificationDeliveryWorker } from './workers/notificationDeliveryWorker.js';
import preloadNotificationService from './services/PreloadNotificationService.js';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
// Override any pre-existing environment variables so local .env settings are used in development.
dotenv.config({ override: true });

const logger = createLogger('Main');
const app = express();
const server = http.createServer(app);
const NODE_ENV = process.env.NODE_ENV || 'development';

const parseOrigins = (...values) =>
  values
    .flatMap((value) => String(value || '').split(','))
    .map((origin) => origin.trim())
    .filter(Boolean);

const defaultDevOrigins =
  NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : [];

const allowedOrigins = Array.from(
  new Set([
    ...defaultDevOrigins,
    ...parseOrigins(process.env.FRONTEND_URL, process.env.SOCKET_IO_CORS),
  ])
);

const corsOriginResolver = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin ${origin} not allowed by CORS`));
};

// Socket.IO initialization
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});
setIO(io);

// Middleware: Security
app.use(helmet());
app.use(cors({
  origin: corsOriginResolver,
  credentials: true
}));

// Middleware: Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Middleware: Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests, please try again later'
});
app.use('/api/', limiter);

// Middleware: Logging & timing
app.use(requestContext);
app.use(requestLogger);
app.use(requestTiming);

// Middleware: Authentication
app.use(authenticate);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  res.json({
    status: 'READY',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1', notificationRoutes);

// Middleware: Error handling
app.use(notFound);
app.use(errorHandler);

// Socket.IO: Real-time notifications
io.on('connection', (socket) => {
  const studentId = socket.handshake.auth.studentId || socket.handshake.headers['x-student-id'];
  const room = `student:${studentId}`;

  socket.join(room);
  logger.info('Student connected', { studentId, socketId: socket.id });

  socket.on('disconnect', () => {
    logger.info('Student disconnected', { studentId, socketId: socket.id });
  });

  socket.on('error', (error) => {
    logger.error('Socket error', error, { studentId, socketId: socket.id });
  });
});

// Export IO for worker processes
export const getIO = () => io;

// Server initialization
const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    // Connect to databases
    logger.info('Connecting to databases...');
    await connectMongoDB();
    await preloadNotificationService.ensurePreloadedNotifications();
    await connectRedis();
    await messageQueue.connect();
    await startNotificationDeliveryWorker();

    // Start server
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Stop the old backend process or restart with the dev helper.`, error, {
          port: PORT,
        });
      } else {
        logger.error('Server failed to bind port', error, {
          port: PORT,
        });
      }

      process.exit(1);
    });

    server.listen(PORT, () => {
      logger.info(`Server started`, {
        port: PORT,
        environment: NODE_ENV,
        url: `http://localhost:${PORT}`
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', new Error(`Promise rejection: ${reason}`));
});

// Start application
start();

export default app;
