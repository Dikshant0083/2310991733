import { getRedisClient, isRedisConnected } from '../config/redis.js';
import messageQueue from '../config/messageQueue.js';
import notificationRepository from '../repositories/NotificationRepository.js';
import priorityService from './PriorityService.js';
import {
  emitAllMarkedAsRead,
  emitNotificationCreated,
  emitNotificationDeleted,
  emitNotificationRead,
} from '../utils/socketEmitter.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('NotificationService');

export class NotificationService {
  getRedis() {
    if (!isRedisConnected()) {
      return null;
    }

    return getRedisClient();
  }

  buildListCacheKey(studentId, options = {}) {
    const params = new URLSearchParams({
      page: String(options.page || 1),
      limit: String(options.limit || 20),
      type: options.type || 'all',
      status:
        options.isRead === true ? 'read' : options.isRead === false ? 'unread' : 'all',
      search: options.search || '',
    });

    return `notif:student:${studentId}:list:${params.toString()}`;
  }

  buildStatsCacheKey(studentId) {
    return `notif:student:${studentId}:stats`;
  }

  buildTopCacheKey(studentId, limit) {
    return `notif:student:${studentId}:top:${limit}`;
  }

  async readCache(cacheKey) {
    const redis = this.getRedis();
    if (!redis) {
      return null;
    }

    try {
      const cachedValue = await redis.get(cacheKey);
      return cachedValue ? JSON.parse(cachedValue) : null;
    } catch (error) {
      logger.warn('Cache read error', { cacheKey, error: error.message });
      return null;
    }
  }

  async writeCache(cacheKey, ttlSeconds, value) {
    const redis = this.getRedis();
    if (!redis) {
      return;
    }

    try {
      await redis.setEx(cacheKey, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.warn('Cache write error', { cacheKey, error: error.message });
    }
  }

  /**
   * Get notifications with caching
   */
  async getNotifications(studentId, options = {}) {
    const cacheKey = this.buildListCacheKey(studentId, options);
    const cached = await this.readCache(cacheKey);

    if (cached) {
      logger.debug('Notification list cache hit', { studentId, cacheKey });
      return cached;
    }

    const result = await notificationRepository.findByStudentId(studentId, options);
    await this.writeCache(cacheKey, 300, result);
    return result;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(studentId) {
    const cacheKey = this.buildStatsCacheKey(studentId);
    const cached = await this.readCache(cacheKey);

    if (cached) {
      return cached;
    }

    const counts = await notificationRepository.getUnreadCountByType(studentId);
    await this.writeCache(cacheKey, 60, counts);
    return counts;
  }

  /**
   * Create notifications for multiple students
   */
  async createNotifications(studentIds, notificationData, deliveryOptions = {}) {
    logger.info('Creating notifications', { studentCount: studentIds.length });

    const notifications = await notificationRepository.createBulk(
      studentIds,
      notificationData
    );

    await Promise.allSettled(
      notifications.map(async (notification) => {
        emitNotificationCreated([notification.studentId], notification);

        await messageQueue.publish(
          'notification.delivery',
          {
            notificationId: String(notification._id),
            studentId: notification.studentId,
            type: notification.type,
            title: notification.title,
            channels: {
              inApp: true,
              email: Boolean(deliveryOptions.sendEmail),
              push: Boolean(deliveryOptions.sendPushNotification),
            },
          },
          {
            idempotencyKey: `notification:${notification._id}:delivery`,
          }
        );
      })
    );

    const invalidatePromises = studentIds.map(studentId => 
      this.invalidateStudentCache(studentId)
    );
    
    await Promise.allSettled(invalidatePromises);

    return notifications;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, studentId) {
    logger.debug('Marking notification as read', { notificationId });

    const result = await notificationRepository.markAsRead(notificationId, studentId);

    if (result) {
      emitNotificationRead(studentId, String(result._id));
      await this.invalidateStudentCache(studentId);
    }

    return result;
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(studentId, type = null) {
    logger.debug('Marking all as read', { studentId, type });

    const result = await notificationRepository.markAllAsRead(studentId, type);

    await this.invalidateStudentCache(studentId);
    emitAllMarkedAsRead(studentId);

    return result;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, studentId) {
    logger.debug('Deleting notification', { notificationId });

    const result = await notificationRepository.deleteOne(notificationId, studentId);

    if (result) {
      await this.invalidateStudentCache(studentId);
      emitNotificationDeleted(studentId, String(result._id));
    }

    return result;
  }

  /**
   * Get top priority notifications
   */
  async getTopNotifications(studentId, limit = 10) {
    logger.debug('Fetching top notifications', { studentId, limit });

    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 10));
    const cacheKey = this.buildTopCacheKey(studentId, safeLimit);
    const cached = await this.readCache(cacheKey);

    if (cached) {
      logger.debug('Top notifications cache hit', { studentId, cacheKey });
      return cached;
    }

    const unreadNotifications = await notificationRepository.findUnreadByStudentId(studentId);
    const topNotifications = priorityService.getTopNotifications(unreadNotifications, safeLimit);

    await this.writeCache(cacheKey, 180, topNotifications);
    return topNotifications;
  }

  async getNotificationById(notificationId, studentId) {
    return notificationRepository.findOneById(notificationId, studentId);
  }

  /**
   * Search notifications
   */
  async searchNotifications(studentId, searchText, options = {}) {
    logger.debug('Searching notifications', { studentId, searchText });

    return notificationRepository.search(studentId, searchText, options);
  }

  /**
   * Get notifications by date range
   */
  async getNotificationsByDateRange(studentId, startDate, endDate, options = {}) {
    logger.info('Fetching notifications by date range', {
      studentId,
      startDate,
      endDate
    });

    return notificationRepository.findByDateRange(studentId, startDate, endDate, options);
  }

  /**
   * Invalidate all cache for a student
   */
  async invalidateStudentCache(studentId) {
    const redis = this.getRedis();
    if (!redis) {
      return;
    }

    try {
      const pattern = `notif:student:${studentId}:*`;
      const keys = [];

      for await (const key of redis.scanIterator({
        MATCH: pattern,
        COUNT: 100,
      })) {
        keys.push(key);
      }
      
      if (keys.length > 0) {
        await redis.del(keys);
        logger.debug('Cache invalidated', { studentId, keysDeleted: keys.length });
      }
    } catch (error) {
      logger.warn('Cache invalidation error', { studentId, error: error.message });
    }
  }
}

export default new NotificationService();
