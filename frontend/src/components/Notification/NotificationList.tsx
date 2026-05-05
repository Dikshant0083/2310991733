'use client';

import React from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { Notification } from '@/types/notification';
import NotificationCard from './NotificationCard';
import styles from './NotificationList.module.css';

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onOpen?: (id: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  loading,
  onMarkRead,
  onDelete,
  onOpen,
  emptyTitle = 'No notifications found',
  emptyDescription = 'Try changing the filters or check back later.',
}) => {
  if (loading) {
    return (
      <Box className={styles.stateContainer}>
        <CircularProgress />
      </Box>
    );
  }

  if (notifications.length === 0) {
    return (
      <Box className={styles.stateContainer}>
        <Typography variant="h6">{emptyTitle}</Typography>
        <Typography variant="body2" color="text.secondary">
          {emptyDescription}
        </Typography>
      </Box>
    );
  }

  return (
    <Stack className={styles.container}>
      {notifications.map((notification) => (
        <NotificationCard
          key={notification._id}
          notification={notification}
          onMarkRead={onMarkRead}
          onDelete={onDelete}
          onOpen={onOpen}
        />
      ))}
    </Stack>
  );
};

export default NotificationList;
