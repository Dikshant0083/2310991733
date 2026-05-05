import { io, Socket } from 'socket.io-client';
import logger from '../utils/logger';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
const BACKEND_HEALTH_ROUTE = '/api/backend/health';

class SocketService {
  private socket: Socket | null = null;
  private connectionPromise: Promise<void> | null = null;

  private async isBackendAvailable(): Promise<boolean> {
    try {
      const response = await fetch(BACKEND_HEALTH_ROUTE, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        return false;
      }

      const payload = (await response.json()) as {
        available?: boolean;
      };

      return payload.available === true;
    } catch (error) {
      logger.warn('Unable to determine backend availability for socket connection', {
        reason: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  connect(studentId = '1042'): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      const backendAvailable = await this.isBackendAvailable();

      if (!backendAvailable) {
        logger.warn('Skipping WebSocket connection because the backend is unavailable', {
          url: SOCKET_URL,
        });
        return;
      }

      return new Promise<void>((resolve, reject) => {
        try {
          this.socket = io(SOCKET_URL, {
            auth: { studentId },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
          });

          const handleConnect = () => {
            logger.info('WebSocket connected', { studentId });
            resolve();
          };

          const handleConnectError = (error: Error) => {
            logger.error('WebSocket connection error', error);
            this.socket?.disconnect();
            this.socket = null;
            reject(error);
          };

          const handleDisconnect = () => {
            logger.warn('WebSocket disconnected');
          };

          this.socket.on('connect', handleConnect);
          this.socket.on('connect_error', handleConnectError);
          this.socket.on('disconnect', handleDisconnect);
        } catch (error) {
          logger.error('Failed to initialize WebSocket', error);
          reject(error);
        }
      });
    })().finally(() => {
      this.connectionPromise = null;
    });

    return this.connectionPromise;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      logger.info('WebSocket disconnected');
    }
  }

  on<T>(event: string, callback: (data: T) => void) {
    this.socket?.on(event, callback);
  }

  off<T>(event: string, callback?: (data: T) => void) {
    this.socket?.off(event, callback);
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }
}

export default new SocketService();
