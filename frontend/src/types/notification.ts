export type NotificationType = 'placement' | 'event' | 'result';
export type NotificationStatus = 'all' | 'read' | 'unread';

export interface Notification {
  _id: string;
  studentId: number;
  type: NotificationType;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    companyId?: string;
    positionId?: string;
    link?: string;
    imageUrl?: string;
    tags?: string[];
  };
}

export interface NotificationStats {
  unreadCount: number;
  unreadByType: {
    placement: number;
    event: number;
    result: number;
  };
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface NotificationFilters {
  type: NotificationType | 'all';
  status: NotificationStatus;
  search: string;
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any[];
  };
  meta: {
    timestamp: string;
    executionTime?: string;
    requestId: string;
    unreadCount?: number;
    [key: string]: unknown;
  };
}
