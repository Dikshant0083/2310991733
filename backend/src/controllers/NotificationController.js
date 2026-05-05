import notificationService from '../services/NotificationService.js';
import { createLogger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { errorResponse, successResponse } from '../utils/response.js';

const logger = createLogger('NotificationController');
const allowedTypes = ['placement', 'event', 'result'];
const allowedStatuses = ['all', 'read', 'unread'];

export class NotificationController {
  /**
   * GET /api/v1/notifications - Fetch with pagination
   */
  async getNotifications(req, res, next) {
    try {
      const studentId = req.user.id;
      const {
        page = 1,
        limit = 20,
        type,
        notification_type,
        status = 'all',
        search,
      } = req.query;
      const notificationType = type || notification_type || null;

      const requestId = req.id || uuidv4();
      logger.info('Fetching notifications', {
        studentId,
        page,
        limit,
        type: notificationType,
        status,
        requestId
      });

      const parsedPage = Number.parseInt(page, 10);
      const parsedLimit = Number.parseInt(limit, 10);

      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        return errorResponse(res, req, 400, 'VALIDATION_ERROR', 'Page must be a positive integer', [
          { field: 'page', issue: 'Minimum value is 1' },
        ]);
      }

      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return errorResponse(res, req, 400, 'VALIDATION_ERROR', 'Limit must be between 1 and 100', [
          { field: 'limit', issue: 'Supported range is 1-100' },
        ]);
      }

      if (notificationType && !allowedTypes.includes(notificationType)) {
        return errorResponse(res, req, 400, 'VALIDATION_ERROR', 'Invalid notification type', [
          { field: 'notification_type', issue: `Allowed values: ${allowedTypes.join(', ')}` },
        ]);
      }

      if (!allowedStatuses.includes(status)) {
        return errorResponse(res, req, 400, 'VALIDATION_ERROR', 'Invalid status filter', [
          { field: 'status', issue: `Allowed values: ${allowedStatuses.join(', ')}` },
        ]);
      }

      const options = {
        page: parsedPage,
        limit: parsedLimit,
        type: notificationType,
        search: search?.trim() || null,
        sortBy: '-createdAt'
      };

      if (status === 'read') {
        options.isRead = true;
      } else if (status === 'unread') {
        options.isRead = false;
      }

      const result = await notificationService.getNotifications(studentId, options);
      const unreadCount = await notificationService.getUnreadCount(studentId);

      return successResponse(
        res,
        req,
        200,
        {
          notifications: result.notifications,
          pagination: result.pagination,
        },
        {
          unreadCount: unreadCount.total,
        }
      );
    } catch (error) {
      logger.error('Error fetching notifications', error, {
        studentId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/stats - Get unread count
   */
  async getStats(req, res, next) {
    try {
      const studentId = req.user.id;
      logger.debug('Fetching notification stats', { studentId, requestId: req.id || uuidv4() });

      const unreadCount = await notificationService.getUnreadCount(studentId);

      return successResponse(res, req, 200, {
        unreadCount: unreadCount.total,
        unreadByType: unreadCount.byType,
      });
    } catch (error) {
      logger.error('Error fetching stats', error);
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/top - Get top priority notifications
   */
  async getTopNotifications(req, res, next) {
    try {
      const studentId = req.user.id;
      const { limit = 10 } = req.query;
      logger.debug('Fetching top notifications', { studentId, limit, requestId: req.id || uuidv4() });

      const notifications = await notificationService.getTopNotifications(
        studentId,
        parseInt(limit)
      );

      return successResponse(res, req, 200, {
        notifications,
        count: notifications.length,
      });
    } catch (error) {
      logger.error('Error fetching top notifications', error);
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/:id - Fetch a single notification
   */
  async getNotificationById(req, res, next) {
    try {
      const studentId = req.user.id;
      const { id } = req.params;

      const notification = await notificationService.getNotificationById(id, studentId);

      if (!notification) {
        return errorResponse(res, req, 404, 'NOT_FOUND', 'Notification not found');
      }

      return successResponse(res, req, 200, notification);
    } catch (error) {
      logger.error('Error fetching notification by id', error, {
        notificationId: req.params?.id,
        studentId: req.user?.id,
      });
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read - Mark as read
   */
  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const studentId = req.user.id;
      const requestId = req.id || uuidv4();

      logger.debug('Marking notification as read', { notificationId: id, requestId });

      const result = await notificationService.markAsRead(id, studentId);

      if (!result) {
        return errorResponse(res, req, 404, 'NOT_FOUND', 'Notification not found');
      }

      return successResponse(res, req, 200, {
        id: result._id,
        isRead: result.isRead,
        readAt: result.readAt,
      });
    } catch (error) {
      logger.error('Error marking as read', error);
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/read-all - Mark all as read
   */
  async markAllAsRead(req, res, next) {
    try {
      const studentId = req.user.id;
      const { type } = req.body;
      const requestId = req.id || uuidv4();

      logger.debug('Marking all as read', { studentId, type, requestId });

      if (type && !allowedTypes.includes(type)) {
        return errorResponse(res, req, 400, 'VALIDATION_ERROR', 'Invalid notification type', [
          { field: 'type', issue: `Allowed values: ${allowedTypes.join(', ')}` },
        ]);
      }

      const result = await notificationService.markAllAsRead(studentId, type);

      return successResponse(res, req, 200, {
        updated: result.modifiedCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error marking all as read', error);
      next(error);
    }
  }

  /**
   * DELETE /api/v1/notifications/:id - Delete notification
   */
  async deleteNotification(req, res, next) {
    try {
      const { id } = req.params;
      const studentId = req.user.id;
      const requestId = req.id || uuidv4();

      logger.debug('Deleting notification', { notificationId: id, requestId });

      const result = await notificationService.deleteNotification(id, studentId);

      if (!result) {
        return errorResponse(res, req, 404, 'NOT_FOUND', 'Notification not found');
      }

      return successResponse(res, req, 200, { deletedId: result._id });
    } catch (error) {
      logger.error('Error deleting notification', error);
      next(error);
    }
  }

  /**
   * POST /api/v1/notifications - Create (admin only)
   */
  async createNotifications(req, res, next) {
    try {
      const {
        studentIds,
        type,
        title,
        description,
        priority = 'medium',
        metadata,
        sendEmail = false,
        sendPushNotification = false,
      } = req.body;

      logger.info('Creating notifications', {
        studentCount: Array.isArray(studentIds) ? studentIds.length : 0,
        type,
        requestId: req.id || uuidv4()
      });

      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return errorResponse(res, req, 400, 'VALIDATION_ERROR', 'studentIds must be a non-empty array');
      }

      if (!type || !allowedTypes.includes(type)) {
        return errorResponse(res, req, 400, 'VALIDATION_ERROR', 'Invalid notification type');
      }

      if (!title || title.length < 5) {
        return errorResponse(res, req, 400, 'VALIDATION_ERROR', 'Title must be at least 5 characters');
      }

      const notifications = await notificationService.createNotifications(
        studentIds,
        {
          type,
          title,
          description,
          priority,
          metadata: metadata || {},
          sender: {
            adminId: 1,
            adminName: 'System Admin',
          },
        },
        {
          sendEmail,
          sendPushNotification,
        }
      );

      return successResponse(res, req, 201, {
        notificationIds: notifications.map(n => n._id),
        totalCreated: notifications.length,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error creating notifications', error);
      next(error);
    }
  }
}

export default new NotificationController();
