import messageQueue from '../config/messageQueue.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('NotificationDeliveryWorker');

let workerStarted = false;

export const startNotificationDeliveryWorker = async () => {
  if (workerStarted) {
    return;
  }

  await messageQueue.subscribe(
    'notification.delivery',
    async (payload, envelope) => {
      logger.info('Processing notification delivery job', {
        messageId: envelope.id,
        studentId: payload.studentId,
        notificationId: payload.notificationId,
        channels: payload.channels,
      });

      if (!payload.notificationId || !payload.studentId) {
        const error = new Error('Invalid delivery payload');
        error.code = 'INVALID_DELIVERY_PAYLOAD';
        throw error;
      }
    },
    {
      maxRetries: 3,
      deadLetterQueue: 'notification.delivery.dlq',
    }
  );

  workerStarted = true;
  logger.info('Notification delivery worker started');
};
