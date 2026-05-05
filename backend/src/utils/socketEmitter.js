import { createLogger } from '../utils/logger.js';
import { getIO } from './socketGateway.js';

const logger = createLogger('NotificationEmitter');

/**
 * Emit real-time notification to students
 */
export const emitNotification = (studentIds, event, data) => {
  const io = getIO();
  
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  const eventName = `notification:${event}`;
  
  studentIds.forEach(studentId => {
    const room = `student:${studentId}`;
    io.to(room).emit(eventName, {
      ...data,
      timestamp: new Date()
    });
    
    logger.debug('Notification emitted', {
      event: eventName,
      studentId,
      room
    });
  });
};

/**
 * Emit notification created event
 */
export const emitNotificationCreated = (studentIds, notification) => {
  emitNotification(studentIds, 'new', {
    id: notification._id,
    type: notification.type,
    title: notification.title,
    description: notification.description
  });
};

/**
 * Emit notification read event
 */
export const emitNotificationRead = (studentId, notificationId) => {
  emitNotification([studentId], 'updated', {
    id: notificationId,
    isRead: true
  });
};

/**
 * Emit all marked as read
 */
export const emitAllMarkedAsRead = (studentId) => {
  emitNotification([studentId], 'all-read', {
    timestamp: new Date()
  });
};

export const emitNotificationDeleted = (studentId, notificationId) => {
  emitNotification([studentId], 'deleted', {
    id: notificationId,
  });
};

export default {
  emitNotification,
  emitNotificationCreated,
  emitNotificationRead,
  emitAllMarkedAsRead,
  emitNotificationDeleted,
};
