import { io, Socket } from 'socket.io-client';
import logger from '../utils/logger';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;

  connect(studentId = '1042'): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(SOCKET_URL, {
          auth: { studentId },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => {
          logger.info('WebSocket connected', { studentId });
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          logger.error('WebSocket connection error', error);
          reject(error);
        });

        this.socket.on('disconnect', () => {
          logger.warn('WebSocket disconnected');
        });
      } catch (error) {
        logger.error('Failed to initialize WebSocket', error);
        reject(error);
      }
    });
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
