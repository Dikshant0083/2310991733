'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Pagination,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import Link from 'next/link';
import AppShell from '@/components/Layout/AppShell';
import NotificationFiltersPanel from '@/components/Notification/NotificationFilters';
import NotificationList from '@/components/Notification/NotificationList';
import useNotifications from '@/hooks/useNotifications';
import socketService from '@/services/socketService';
import { NotificationFilters } from '@/types/notification';
import logger from '@/utils/logger';
import styles from './notifications.module.css';

const defaultFilters: NotificationFilters = {
  type: 'all',
  status: 'all',
  search: '',
};

const typeLabels: Record<NotificationFilters['type'], string> = {
  all: 'All types',
  placement: 'Placement',
  result: 'Result',
  event: 'Event',
};

const statusLabels: Record<NotificationFilters['status'], string> = {
  all: 'All statuses',
  unread: 'Unread only',
  read: 'Read only',
};

const NotificationsPage: React.FC = () => {
  const [filters, setFilters] = useState<NotificationFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const {
    notifications,
    loading,
    error,
    pagination,
    unreadCount,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications({
    page,
    limit,
    filters,
  });

  useEffect(() => {
    void socketService.connect(process.env.NEXT_PUBLIC_STUDENT_ID || '1042').catch((caughtError) => {
      logger.error('Unable to connect WebSocket for notifications page', caughtError);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters.type, filters.status, filters.search]);

  const showToast = (message: string, severity: 'success' | 'error') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      showToast('Notification marked as read.', 'success');
    } catch (caughtError) {
      logger.error('Failed to mark notification as read', caughtError);
      showToast('Unable to mark notification as read.', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      showToast('All visible notifications marked as read.', 'success');
    } catch (caughtError) {
      logger.error('Failed to mark all notifications as read', caughtError);
      showToast('Unable to mark all notifications as read.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      showToast('Notification deleted.', 'success');
    } catch (caughtError) {
      logger.error('Failed to delete notification', caughtError);
      showToast('Unable to delete the notification.', 'error');
    }
  };

  const activeFilterSummary = [
    typeLabels[filters.type],
    statusLabels[filters.status],
    filters.search ? `Search: "${filters.search}"` : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <AppShell>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card elevation={0} className={styles.heroCard}>
            <CardContent className={styles.heroContent}>
              <Stack spacing={3}>
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  justifyContent="space-between"
                  spacing={3}
                >
                  <Box className={styles.heroCopy}>
                    <Typography variant="overline" className={styles.heroEyebrow}>
                      Stage 7 Frontend
                    </Typography>
                    <Typography variant="h3" className={styles.heroTitle}>
                      Notification command center
                    </Typography>
                    <Typography variant="body1" className={styles.heroDescription}>
                      Watch the student inbox in real time, focus the list with fast filters,
                      and keep urgent academic and placement updates moving.
                    </Typography>
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className={styles.heroActions}>
                    <Button
                      startIcon={<RefreshRoundedIcon />}
                      variant="outlined"
                      onClick={() => void refresh()}
                      disabled={loading}
                    >
                      Refresh
                    </Button>
                    <Button
                      startIcon={<MarkEmailReadRoundedIcon />}
                      variant="contained"
                      onClick={() => void handleMarkAllRead()}
                      disabled={loading || unreadCount === 0}
                    >
                      Mark all read
                    </Button>
                    <Button
                      component={Link}
                      href="/notifications/priority"
                      startIcon={<AutoAwesomeRoundedIcon />}
                      variant="outlined"
                    >
                      Priority feed
                    </Button>
                  </Stack>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} className={styles.heroMeta}>
                  <Box className={styles.heroMetric}>
                    <Typography variant="caption">Current view</Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {activeFilterSummary}
                    </Typography>
                  </Box>
                  <Box className={styles.heroMetric}>
                    <Typography variant="caption">Unread queue</Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {unreadCount} actionable alerts
                    </Typography>
                  </Box>
                  <Box className={styles.heroMetric}>
                    <Typography variant="caption">Realtime delivery</Typography>
                    <Typography variant="body2" fontWeight={700}>
                      Socket-connected inbox
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} className={styles.insightCard}>
            <CardContent className={styles.insightContent}>
              <Typography variant="overline" className={styles.insightLabel}>
                Unread load
              </Typography>
              <Typography className={styles.insightValue}>{unreadCount}</Typography>
              <Typography variant="body2" color="text.secondary">
                Messages still waiting for action in the active student context.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} className={styles.insightCard}>
            <CardContent className={styles.insightContent}>
              <Typography variant="overline" className={styles.insightLabel}>
                Active slice
              </Typography>
              <Typography className={styles.insightValue}>{notifications.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Records visible on this page after applying filters and pagination.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} className={styles.insightCard}>
            <CardContent className={styles.insightContent}>
              <Typography variant="overline" className={styles.insightLabel}>
                Inbox coverage
              </Typography>
              <Typography className={styles.insightValue}>{pagination.totalRecords}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total records available across the current query window.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} className={styles.panelCard}>
            <CardContent className={styles.panelContent}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h5" className={styles.sectionTitle}>
                    Filters
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Narrow the inbox by type, read state, or search text.
                  </Typography>
                </Box>

                <NotificationFiltersPanel filters={filters} onChange={setFilters} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card elevation={0} className={styles.panelCard}>
            <CardContent className={styles.panelContent}>
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography variant="h5" className={styles.sectionTitle}>
                      Notification list
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {unreadCount} unread notification{unreadCount === 1 ? '' : 's'} in the
                      current student context.
                    </Typography>
                  </Box>
                  <Box className={styles.paginationTag}>
                    <Typography variant="body2" fontWeight={700}>
                      Page {pagination.currentPage} of {pagination.totalPages}
                    </Typography>
                  </Box>
                </Stack>

                {error && <Alert severity="error">{error}</Alert>}

                <NotificationList
                  notifications={notifications}
                  loading={loading}
                  onMarkRead={(id) => void handleMarkRead(id)}
                  onDelete={(id) => void handleDelete(id)}
                  onOpen={(id) => logger.debug('Notification opened from list', { id })}
                />

                <Stack direction="row" justifyContent="center" className={styles.paginationWrap}>
                  <Pagination
                    color="primary"
                    count={pagination.totalPages}
                    page={page}
                    onChange={(_, nextPage) => setPage(nextPage)}
                    disabled={loading}
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AppShell>
  );
};

export default NotificationsPage;
