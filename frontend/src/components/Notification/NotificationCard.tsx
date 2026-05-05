'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DraftsRoundedIcon from '@mui/icons-material/DraftsRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import { Notification, NotificationType } from '@/types/notification';
import logger from '@/utils/logger';
import styles from './NotificationCard.module.css';

const typeTone: Record<NotificationType, 'primary' | 'success' | 'warning'> = {
  placement: 'primary',
  result: 'success',
  event: 'warning',
};

const priorityTone: Record<Notification['priority'], 'success' | 'info' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

const typeIconMap: Record<NotificationType, React.ReactNode> = {
  placement: <WorkOutlineRoundedIcon fontSize="small" />,
  result: <SchoolRoundedIcon fontSize="small" />,
  event: <EventRoundedIcon fontSize="small" />,
};

const formatTimestamp = (isoDate: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));

export const NotificationCard: React.FC<{
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onOpen?: (id: string) => void;
}> = ({ notification, onMarkRead, onDelete, onOpen }) => {
  const handleMarkRead = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!notification.isRead) {
      logger.debug('Marking notification as read', { id: notification._id });
      onMarkRead?.(notification._id);
    }
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Delete this notification?')) {
      logger.warn('Deleting notification', { id: notification._id });
      onDelete?.(notification._id);
    }
  };

  const handleOpen = () => {
    logger.debug('Opening notification', { id: notification._id });
    onOpen?.(notification._id);
    if (notification.metadata?.link) {
      window.open(notification.metadata.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card
      className={`${styles.card} ${notification.isRead ? styles.read : styles.unread}`}
      onClick={handleOpen}
      elevation={0}
    >
      <CardContent className={styles.content}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2.5}>
          <Stack direction="row" spacing={2} className={styles.body}>
            <Box className={`${styles.iconShell} ${styles[notification.type]}`}>
              {typeIconMap[notification.type]}
            </Box>

            <Stack spacing={1.25} className={styles.bodyContent}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h6" className={styles.title}>
                  {notification.title}
                </Typography>
                {!notification.isRead && <Box className={styles.badge} aria-label="Unread notification" />}
              </Stack>

              <Typography variant="body2" color="text.secondary">
                {notification.description || 'No description provided for this notification.'}
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color={typeTone[notification.type]}
                  label={notification.type.toUpperCase()}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  color={priorityTone[notification.priority]}
                  label={`${notification.priority.toUpperCase()} PRIORITY`}
                  variant="filled"
                />
                <Chip
                  size="small"
                  icon={notification.isRead ? <MarkEmailReadRoundedIcon /> : <DraftsRoundedIcon />}
                  label={notification.isRead ? 'Read' : 'Unread'}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Stack>

          <Stack spacing={1.5} alignItems={{ xs: 'flex-start', md: 'flex-end' }} className={styles.meta}>
            <Typography variant="caption" className={styles.timestamp}>
              {formatTimestamp(notification.createdAt)}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              {!notification.isRead && (
                <Tooltip title="Mark as read">
                  <IconButton onClick={handleMarkRead} size="small" aria-label="Mark as read">
                    <MarkEmailReadRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {notification.metadata?.link && (
                <Tooltip title="Open details">
                  <IconButton
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpen();
                    }}
                    size="small"
                    aria-label="Open details"
                  >
                    <OpenInNewRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Delete notification">
                <IconButton onClick={handleDelete} size="small" aria-label="Delete notification">
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default NotificationCard;
