import Notification from '../models/Notification.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('NotificationRepository');

export class NotificationRepository {
  /**
   * Find notifications by student ID with pagination
   */
  async findByStudentId(studentId, options = {}) {
    const {
      page = 1,
      limit = 20,
      isRead = null,
      type = null,
      sortBy = '-createdAt',
      search = null,
    } = options;

    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    const skip = (safePage - 1) * safeLimit;
    const query = { studentId };

    if (isRead !== null) {
      query.isRead = isRead;
    }

    if (type) {
      query.type = type;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort(sortBy)
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Notification.countDocuments(query)
    ]);

    return {
      notifications,
      pagination: {
        currentPage: safePage,
        totalPages: Math.ceil(total / safeLimit) || 1,
        totalRecords: total,
        limit: safeLimit,
        hasNextPage: skip + safeLimit < total,
        hasPrevPage: safePage > 1
      }
    };
  }

  /**
   * Find unread count by type for a student
   */
  async getUnreadCountByType(studentId) {
    const counts = await Notification.aggregate([
      {
        $match: { studentId, isRead: false }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      byType: {
        placement: 0,
        result: 0,
        event: 0,
      }
    };

    counts.forEach(({ _id, count }) => {
      result.byType[_id] = count;
      result.total += count;
    });

    return result;
  }

  /**
   * Create notification for multiple students
   */
  async createBulk(studentIds, notificationData) {
    const notifications = studentIds.map(studentId => ({
      studentId,
      ...notificationData,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const result = await Notification.insertMany(notifications);
    logger.info(`Created ${result.length} notifications`, {
      studentCount: studentIds.length
    });

    return result;
  }

  async upsertPreloaded(notifications = []) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return { insertedCount: 0, matchedCount: 0 };
    }

    const operations = notifications.map((notification) => ({
      updateOne: {
        filter: {
          studentId: notification.studentId,
          type: notification.type,
          title: notification.title,
          createdAt: notification.createdAt,
        },
        update: {
          $setOnInsert: notification,
        },
        upsert: true,
        timestamps: false,
      },
    }));

    const result = await Notification.bulkWrite(operations, { ordered: false });

    logger.info('Preloaded notifications synchronized', {
      requested: notifications.length,
      insertedCount: result.upsertedCount || 0,
      matchedCount: result.matchedCount || 0,
    });

    return {
      insertedCount: result.upsertedCount || 0,
      matchedCount: result.matchedCount || 0,
    };
  }

  async removePreloadedDuplicates(notifications = []) {
    let removedCount = 0;

    for (const notification of notifications) {
      const matches = await Notification.find({
        studentId: notification.studentId,
        type: notification.type,
        title: notification.title,
        createdAt: notification.createdAt,
      })
        .sort({ _id: 1 })
        .select('_id')
        .lean();

      if (matches.length <= 1) {
        continue;
      }

      const duplicateIds = matches.slice(1).map((item) => item._id);
      const deleteResult = await Notification.deleteMany({
        _id: { $in: duplicateIds },
      });

      removedCount += deleteResult.deletedCount || 0;
    }

    if (removedCount > 0) {
      logger.warn('Removed duplicate preloaded notifications', {
        removedCount,
      });
    }

    return removedCount;
  }

  /**
   * Get notification by ID for a student
   */
  async findOneById(notificationId, studentId) {
    return Notification.findOne({
      _id: notificationId,
      studentId,
    }).lean();
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, studentId) {
    const result = await Notification.findOneAndUpdate(
      { _id: notificationId, studentId },
      {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    return result;
  }

  /**
   * Mark multiple as read
   */
  async markMultipleAsRead(notificationIds) {
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds } },
      {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date()
      }
    );

    return result;
  }

  /**
   * Mark all unread for student as read
   */
  async markAllAsRead(studentId, type = null) {
    const query = { studentId, isRead: false };
    if (type) {
      query.type = type;
    }

    const result = await Notification.updateMany(
      query,
      {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date()
      }
    );

    return result;
  }

  /**
   * Delete notification
   */
  async deleteOne(notificationId, studentId) {
    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      studentId,
    });
    return result;
  }

  /**
   * Get unread notifications for in-memory prioritization
   */
  async findUnreadByStudentId(studentId) {
    return Notification.find({
      studentId,
      isRead: false
    })
      .select('_id studentId type title description isRead readAt createdAt updatedAt priority metadata')
      .lean();
  }

  /**
   * Search notifications
   */
  async search(studentId, searchText, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const notifications = await Notification.search(searchText, studentId)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments({
      studentId,
      $text: { $search: searchText }
    });

    return {
      notifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit
      }
    };
  }

  /**
   * Get notifications in date range
   */
  async findByDateRange(studentId, startDate, endDate, options = {}) {
    const { type = null, limit = 100 } = options;

    const query = {
      studentId,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };

    if (type) {
      query.type = type;
    }

    return Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

export default new NotificationRepository();
