import axios, { AxiosError } from 'axios';
import {
  APIResponse,
  Notification,
  NotificationStats,
  NotificationStatus,
  NotificationType,
  PaginationInfo,
} from '../types/notification';
import logger from '../utils/logger';

const INTERNAL_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const EVALUATION_PROXY_ROUTE = '/api/evaluation/notifications';
const STATS_PROXY_ROUTE = '/api/notifications/stats';
const DEFAULT_STUDENT_ID = process.env.NEXT_PUBLIC_STUDENT_ID || '1042';

const internalClient = axios.create({
  baseURL: INTERNAL_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'X-Student-ID': DEFAULT_STUDENT_ID,
  },
});

internalClient.interceptors.request.use((config) => {
  logger.debug('Backend API request', {
    method: config.method,
    url: config.url,
  });
  return config;
});

internalClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    logger.error('Backend API request failed', error, {
      url: error.config?.url,
      method: error.config?.method,
    });
    throw error;
  }
);

const parseDate = (value?: string | number | Date | null) => {
  if (!value) {
    return new Date().toISOString();
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().toISOString();
  }

  return parsedDate.toISOString();
};

const normalizeType = (value?: string): NotificationType => {
  if (value === 'placement' || value === 'event' || value === 'result') {
    return value;
  }

  return 'event';
};

const normalizePriority = (value?: string): Notification['priority'] => {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') {
    return value;
  }

  return 'medium';
};

const normalizeNotification = (payload: Record<string, any>): Notification => ({
  _id: String(payload._id || payload.id || payload.notification_id || crypto.randomUUID()),
  studentId: Number(payload.studentId || payload.student_id || DEFAULT_STUDENT_ID),
  type: normalizeType(payload.type || payload.notification_type),
  title: String(payload.title || payload.message || 'Campus notification'),
  description: payload.description || payload.content || '',
  priority: normalizePriority(payload.priority),
  isRead: Boolean(payload.isRead ?? payload.is_read ?? false),
  readAt: payload.readAt ? parseDate(payload.readAt) : payload.read_at ? parseDate(payload.read_at) : null,
  createdAt: parseDate(payload.createdAt || payload.created_at || payload.timestamp),
  updatedAt: parseDate(payload.updatedAt || payload.updated_at || payload.createdAt || payload.created_at),
  metadata: payload.metadata || {
    link: payload.link,
    companyId: payload.companyId || payload.company_id,
  },
});

const normalizeNotificationsPayload = (payload: any) => {
  const sourceList =
    payload?.data?.notifications ||
    payload?.notifications ||
    payload?.data ||
    payload?.results ||
    payload?.items ||
    payload;

  const notifications = Array.isArray(sourceList)
    ? sourceList.map((item) => normalizeNotification(item))
    : [];

  const sourcePagination =
    payload?.data?.pagination ||
    payload?.pagination ||
    payload?.meta?.pagination ||
    null;

  const limit = Number(sourcePagination?.limit || payload?.limit || 10);
  const currentPage = Number(sourcePagination?.currentPage || payload?.page || 1);
  const totalRecords = Number(
    sourcePagination?.totalRecords ||
      payload?.total ||
      payload?.totalRecords ||
      notifications.length
  );
  const totalPages = Number(
    sourcePagination?.totalPages || Math.max(1, Math.ceil(totalRecords / Math.max(limit, 1)))
  );

  const pagination: PaginationInfo = {
    currentPage,
    totalPages,
    totalRecords,
    limit,
    hasNextPage:
      typeof sourcePagination?.hasNextPage === 'boolean'
        ? sourcePagination.hasNextPage
        : currentPage < totalPages,
    hasPrevPage:
      typeof sourcePagination?.hasPrevPage === 'boolean'
        ? sourcePagination.hasPrevPage
        : currentPage > 1,
  };

  return { notifications, pagination };
};

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.error?.message;

    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

class NotificationService {
  async getNotifications(options: {
    page?: number;
    limit?: number;
    type?: NotificationType | 'all';
    status?: NotificationStatus;
  }): Promise<{
    notifications: Notification[];
    pagination: PaginationInfo;
    unreadCount: number;
  }> {
    const { page = 1, limit = 10, type = 'all', status = 'all' } = options;

    try {
      const response = await axios.get(EVALUATION_PROXY_ROUTE, {
        params: {
          page,
          limit,
          notification_type: type === 'all' ? undefined : type,
        },
      });

      const normalized = normalizeNotificationsPayload(response.data);
      const filtered = normalized.notifications.filter((notification) => {
        if (status === 'read') {
          return notification.isRead;
        }

        if (status === 'unread') {
          return !notification.isRead;
        }

        return true;
      });

      return {
        notifications: filtered,
        pagination: normalized.pagination,
        unreadCount: filtered.filter((notification) => !notification.isRead).length,
      };
    } catch (error) {
      logger.error('Unable to fetch notifications from proxy route', error, {
        route: EVALUATION_PROXY_ROUTE,
      });
      throw new Error(getErrorMessage(error, 'Failed to fetch notifications'));
    }
  }

  async getNotificationById(id: string): Promise<Notification> {
    const response = await internalClient.get<APIResponse<Notification>>(`/notifications/${id}`);
    return normalizeNotification(response.data.data as unknown as Record<string, any>);
  }

  async markAsRead(id: string): Promise<void> {
    await internalClient.patch(`/notifications/${id}/read`);
  }

  async markAllAsRead(type?: NotificationType | 'all'): Promise<void> {
    await internalClient.patch('/notifications/read-all', {
      type: type && type !== 'all' ? type : undefined,
    });
  }

  async deleteNotification(id: string): Promise<void> {
    await internalClient.delete(`/notifications/${id}`);
  }

  async getStats(): Promise<NotificationStats> {
    const response = await axios.get<APIResponse<NotificationStats>>(STATS_PROXY_ROUTE);
    return response.data.data;
  }

  async getTopNotifications(limit = 10): Promise<Notification[]> {
    const response = await internalClient.get<
      APIResponse<{ notifications: Notification[] }>
    >('/notifications/top', {
      params: { limit },
    });

    return response.data.data.notifications.map((item) =>
      normalizeNotification(item as unknown as Record<string, any>)
    );
  }
}

export default new NotificationService();
