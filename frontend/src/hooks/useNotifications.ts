import { useEffect, useState } from 'react';
import notificationService from '../services/notificationService';
import socketService from '../services/socketService';
import {
  Notification,
  NotificationFilters,
  PaginationInfo,
  NotificationType,
} from '../types/notification';
import logger from '../utils/logger';

interface UseNotificationsOptions {
  page: number;
  limit: number;
  filters: NotificationFilters;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  unreadCount: number;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const defaultPagination: PaginationInfo = {
  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  limit: 10,
  hasNextPage: false,
  hasPrevPage: false,
};

const matchesSearch = (notification: Notification, searchTerm: string) => {
  if (!searchTerm.trim()) {
    return true;
  }

  const normalizedSearch = searchTerm.toLowerCase();
  return (
    notification.title.toLowerCase().includes(normalizedSearch) ||
    notification.description?.toLowerCase().includes(normalizedSearch)
  );
};

export const useNotifications = ({
  page,
  limit,
  filters,
}: UseNotificationsOptions): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>(defaultPagination);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      const [listResponse, statsResponse] = await Promise.all([
        notificationService.getNotifications({
          page,
          limit,
          type: filters.type,
          status: filters.status,
        }),
        notificationService.getStats().catch(() => null),
      ]);

      const filteredNotifications = listResponse.notifications.filter((notification) =>
        matchesSearch(notification, filters.search)
      );

      setNotifications(filteredNotifications);
      setPagination(listResponse.pagination);
      setUnreadCount(
        statsResponse?.unreadCount ??
          filteredNotifications.filter((notification) => !notification.isRead).length
      );

      logger.info('Notifications fetched successfully', {
        page,
        limit,
        returnedCount: filteredNotifications.length,
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Failed to fetch notifications';
      setError(message);
      logger.error('Unable to fetch notifications', caughtError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();
  }, [page, limit, filters.type, filters.status, filters.search]);

  useEffect(() => {
    const handleNewNotification = (incoming: Record<string, any>) => {
      const notification: Notification = {
        _id: String(incoming.id || incoming._id),
        studentId: Number(incoming.studentId || 1042),
        type: (incoming.type || 'event') as NotificationType,
        title: incoming.title || 'Campus notification',
        description: incoming.description || '',
        priority: incoming.priority || 'medium',
        isRead: false,
        createdAt: incoming.timestamp || new Date().toISOString(),
        updatedAt: incoming.timestamp || new Date().toISOString(),
        metadata: incoming.metadata,
      };

      if (!matchesSearch(notification, filters.search)) {
        return;
      }

      setNotifications((current) => [notification, ...current]);
      setUnreadCount((current) => current + 1);
    };

    const handleUpdatedNotification = (incoming: Record<string, any>) => {
      const incomingId = String(incoming.id || incoming._id);
      setNotifications((current) =>
        current.map((notification) =>
          notification._id === incomingId
            ? {
                ...notification,
                ...incoming,
                _id: incomingId,
                isRead: incoming.isRead ?? notification.isRead,
                updatedAt: incoming.timestamp || new Date().toISOString(),
              }
            : notification
        )
      );
    };

    const handleDeletedNotification = (incoming: Record<string, any>) => {
      const incomingId = String(incoming.id || incoming._id);
      setNotifications((current) =>
        current.filter((notification) => notification._id !== incomingId)
      );
    };

    socketService.on('notification:new', handleNewNotification);
    socketService.on('notification:updated', handleUpdatedNotification);
    socketService.on('notification:deleted', handleDeletedNotification);

    return () => {
      socketService.off('notification:new', handleNewNotification);
      socketService.off('notification:updated', handleUpdatedNotification);
      socketService.off('notification:deleted', handleDeletedNotification);
    };
  }, [filters.search]);

  const markAsRead = async (id: string) => {
    await notificationService.markAsRead(id);

    setNotifications((current) =>
      current.map((notification) =>
        notification._id === id
          ? {
              ...notification,
              isRead: true,
              readAt: new Date().toISOString(),
            }
          : notification
      )
    );

    setUnreadCount((current) => Math.max(0, current - 1));
  };

  const markAllAsRead = async () => {
    await notificationService.markAllAsRead(filters.type);

    const affectedUnread = notifications.filter((notification) => !notification.isRead).length;
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt || new Date().toISOString(),
      }))
    );
    setUnreadCount((current) => Math.max(0, current - affectedUnread));
  };

  const deleteNotification = async (id: string) => {
    await notificationService.deleteNotification(id);

    setNotifications((current) =>
      current.filter((notification) => notification._id !== id)
    );
  };

  const refresh = async () => {
    await fetchNotifications();
  };

  return {
    notifications,
    loading,
    error,
    pagination,
    unreadCount,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
};

export default useNotifications;
