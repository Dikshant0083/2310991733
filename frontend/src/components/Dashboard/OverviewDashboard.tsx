'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import RadarRoundedIcon from '@mui/icons-material/RadarRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import AppShell from '@/components/Layout/AppShell';
import { Notification, NotificationStats } from '@/types/notification';
import notificationService from '@/services/notificationService';
import styles from './OverviewDashboard.module.css';

const backendHealthEndpoint = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'
).replace(/\/api\/v1\/?$/, '/health');

const formatTimestamp = (isoDate: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));

const emptyStats: NotificationStats = {
  unreadCount: 0,
  unreadByType: {
    placement: 0,
    result: 0,
    event: 0,
  },
};

export default function OverviewDashboard() {
  const [stats, setStats] = useState<NotificationStats>(emptyStats);
  const [priorityNotifications, setPriorityNotifications] = useState<Notification[]>([]);
  const [backendHealthy, setBackendHealthy] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      const [statsResult, priorityResult, healthResult] = await Promise.allSettled([
        notificationService.getStats(),
        notificationService.getTopNotifications(5),
        fetch(backendHealthEndpoint, { cache: 'no-store' }),
      ]);

      if (!isMounted) {
        return;
      }

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
      } else {
        setStats(emptyStats);
      }

      if (priorityResult.status === 'fulfilled') {
        setPriorityNotifications(priorityResult.value);
      } else {
        setPriorityNotifications([]);
      }

      if (
        healthResult.status === 'fulfilled' &&
        healthResult.value.ok
      ) {
        setBackendHealthy(true);
      } else {
        setBackendHealthy(false);
      }

      if (statsResult.status === 'rejected' && priorityResult.status === 'rejected') {
        setError('Dashboard data is temporarily unavailable. Refresh to try again.');
      }

      setLoading(false);
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const metricCards = [
    {
      label: 'Unread total',
      value: stats.unreadCount,
      note: 'Current student context',
      accent: 'teal',
      icon: <CampaignRoundedIcon fontSize="small" />,
    },
    {
      label: 'Placement alerts',
      value: stats.unreadByType.placement,
      note: 'Highest priority stream',
      accent: 'ink',
      icon: <WorkOutlineRoundedIcon fontSize="small" />,
    },
    {
      label: 'Result updates',
      value: stats.unreadByType.result,
      note: 'Exam and grade changes',
      accent: 'gold',
      icon: <SchoolRoundedIcon fontSize="small" />,
    },
    {
      label: 'Event notices',
      value: stats.unreadByType.event,
      note: 'Workshops, clubs, deadlines',
      accent: 'sun',
      icon: <EventRoundedIcon fontSize="small" />,
    },
  ];

  return (
    <AppShell>
      <Grid container spacing={3}>
        <Grid item xs={12} xl={8}>
          <Card elevation={0} className={styles.heroCard}>
            <CardContent className={styles.heroContent}>
              <Stack spacing={3}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={3}>
                  <Box className={styles.heroCopy}>
                    <Typography className={styles.eyebrow}>
                      Campus operations dashboard
                    </Typography>
                    <Typography variant="h2" className={styles.heroTitle}>
                      One control center for academic, event, and placement communication.
                    </Typography>
                    <Typography variant="body1" className={styles.heroDescription}>
                      Track unread load, watch the priority pipeline, and jump straight into the
                      student inbox without losing the operational view.
                    </Typography>
                  </Box>

                  <Stack spacing={1.25} className={styles.heroStatus}>
                    <Chip
                      label={backendHealthy ? 'Backend healthy' : 'Backend degraded'}
                      color={backendHealthy ? 'success' : 'warning'}
                      variant="filled"
                    />
                    <Chip
                      label="Evaluation feed with graceful fallback"
                      variant="outlined"
                      className={styles.softChip}
                    />
                    <Chip
                      label="Realtime delivery channel active"
                      variant="outlined"
                      className={styles.softChip}
                    />
                  </Stack>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    component={Link}
                    href="/notifications"
                    variant="contained"
                    size="large"
                    endIcon={<ArrowOutwardRoundedIcon />}
                  >
                    Open inbox
                  </Button>
                  <Button
                    component={Link}
                    href="/notifications/priority"
                    variant="outlined"
                    size="large"
                    startIcon={<AutoAwesomeRoundedIcon />}
                  >
                    Review priority feed
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} xl={4}>
          <Card elevation={0} className={styles.runtimeCard}>
            <CardContent className={styles.runtimeContent}>
              <Stack spacing={2.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5" fontWeight={800}>
                    Runtime board
                  </Typography>
                  <RadarRoundedIcon className={styles.runtimeIcon} />
                </Stack>

                <Box className={styles.runtimePanel}>
                  <Typography variant="overline" className={styles.runtimeLabel}>
                    Delivery model
                  </Typography>
                  <Typography variant="h6">REST + WebSocket + queue-ready worker</Typography>
                  <Typography variant="body2" color="text.secondary">
                    The system stays responsive under load by separating reads, realtime delivery,
                    and background notification handling.
                  </Typography>
                </Box>

                <Box className={styles.runtimeChecklist}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Backend health</Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {backendHealthy ? 'Online' : 'Attention needed'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Queue strategy</Typography>
                    <Typography variant="body2" fontWeight={700}>
                      RabbitMQ-ready
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Priority engine</Typography>
                    <Typography variant="body2" fontWeight={700}>
                      In-memory top N
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {metricCards.map((metric) => (
          <Grid key={metric.label} item xs={12} sm={6} xl={3}>
            <Card elevation={0} className={`${styles.metricCard} ${styles[metric.accent]}`}>
              <CardContent className={styles.metricContent}>
                <Stack spacing={1.5}>
                  <Box className={styles.metricIcon}>{metric.icon}</Box>
                  <Typography variant="body2" className={styles.metricLabel}>
                    {metric.label}
                  </Typography>
                  <Typography className={styles.metricValue}>
                    {loading ? '...' : metric.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {metric.note}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}

        <Grid item xs={12} lg={7}>
          <Card elevation={0} className={styles.priorityCard}>
            <CardContent className={styles.priorityContent}>
              <Stack spacing={2.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h5" fontWeight={800}>
                      Priority radar
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      The highest-value unread alerts surfaced for quick action.
                    </Typography>
                  </Box>
                  <Button component={Link} href="/notifications/priority" variant="text" endIcon={<ArrowOutwardRoundedIcon />}>
                    Open full ranking
                  </Button>
                </Stack>

                {error && <Alert severity="warning">{error}</Alert>}

                {loading ? (
                  <Box className={styles.loadingState}>
                    <CircularProgress size={28} />
                  </Box>
                ) : priorityNotifications.length === 0 ? (
                  <Box className={styles.emptyState}>
                    <TaskAltRoundedIcon />
                    <Typography variant="h6">Priority queue is clear</Typography>
                    <Typography variant="body2" color="text.secondary">
                      No unread notifications need escalation for the current student context.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    {priorityNotifications.map((notification, index) => (
                      <Box key={notification._id} className={styles.priorityRow}>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Box className={styles.rankBadge}>{index + 1}</Box>
                          <Stack spacing={0.75} className={styles.priorityMeta}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                              <Typography variant="subtitle1" fontWeight={700}>
                                {notification.title}
                              </Typography>
                              <Chip
                                size="small"
                                label={notification.type.toUpperCase()}
                                variant="outlined"
                              />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {notification.description || 'No description provided for this alert.'}
                            </Typography>
                          </Stack>
                        </Stack>
                        <Typography variant="caption" className={styles.priorityTime}>
                          {formatTimestamp(notification.createdAt)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card elevation={0} className={styles.pipelineCard}>
            <CardContent className={styles.pipelineContent}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h5" fontWeight={800}>
                    Notification lanes
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Each lane carries a different urgency and reading pattern.
                  </Typography>
                </Box>

                <Box className={styles.lane}>
                  <Box className={`${styles.laneMarker} ${styles.inkMarker}`} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Placement lane
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Company shortlists, interview schedules, and job openings get the fastest surfacing.
                    </Typography>
                  </Box>
                </Box>

                <Box className={styles.lane}>
                  <Box className={`${styles.laneMarker} ${styles.goldMarker}`} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Results lane
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Academic updates stay visible through unread counters and priority ranking.
                    </Typography>
                  </Box>
                </Box>

                <Box className={styles.lane}>
                  <Box className={`${styles.laneMarker} ${styles.sunMarker}`} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Events lane
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Workshops, clubs, and campus deadlines remain filterable without cluttering urgent flows.
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </AppShell>
  );
}
