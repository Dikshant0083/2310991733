'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AppShell from '@/components/Layout/AppShell';
import NotificationList from '@/components/Notification/NotificationList';
import notificationService from '@/services/notificationService';
import { Notification } from '@/types/notification';
import logger from '@/utils/logger';
import styles from './priority.module.css';

export default function PriorityNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPriorityNotifications = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await notificationService.getTopNotifications(10);
        setNotifications(response);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'Unable to load priority notifications';
        logger.error('Failed to load priority notifications', caughtError);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadPriorityNotifications();
  }, []);

  return (
    <AppShell>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card elevation={0} className={styles.heroCard}>
            <CardContent className={styles.heroContent}>
              <Stack spacing={2.5}>
                <Typography variant="overline" className={styles.eyebrow}>
                  Stage 6 Priority System
                </Typography>
                <Typography variant="h3" className={styles.heroTitle}>
                  Top unread alerts, ranked for immediate action.
                </Typography>
                <Typography variant="body1" className={styles.heroDescription}>
                  This feed is computed in memory, prioritizing placement notices first, then
                  results, then events, with recency used as the tie-breaker.
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    component={Link}
                    href="/notifications"
                    variant="contained"
                    startIcon={<ArrowBackRoundedIcon />}
                  >
                    Back to inbox
                  </Button>
                  <Button variant="outlined" startIcon={<AutoAwesomeRoundedIcon />}>
                    Live top 10 ranking
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card elevation={0} className={styles.ruleCard}>
            <CardContent className={styles.ruleContent}>
              <Stack spacing={2}>
                <Typography variant="h5" className={styles.sectionTitle}>
                  Ranking logic
                </Typography>
                <BoxRow
                  title="Priority order"
                  description="Placement outranks Result, and Result outranks Event."
                />
                <BoxRow
                  title="Unread only"
                  description="Read items are excluded before scoring begins."
                />
                <BoxRow
                  title="Freshness"
                  description="Newer alerts win when two notifications share the same business priority."
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card elevation={0} className={styles.listCard}>
            <CardContent className={styles.listContent}>
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <BoxRow
                    title="Priority feed"
                    description="Unread alerts sorted by business value and recency."
                    compact
                  />
                  <Typography variant="body2" className={styles.countLabel}>
                    {notifications.length} notification{notifications.length === 1 ? '' : 's'} ranked
                  </Typography>
                </Stack>

                {error && <Alert severity="error">{error}</Alert>}
                <NotificationList
                  notifications={notifications}
                  loading={loading}
                  emptyTitle="No unread priority notifications"
                  emptyDescription="When new urgent alerts arrive, the ranking will populate here."
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </AppShell>
  );
}

interface BoxRowProps {
  title: string;
  description: string;
  compact?: boolean;
}

function BoxRow({ title, description, compact = false }: BoxRowProps) {
  return (
    <Stack spacing={0.75} className={compact ? styles.compactRow : styles.ruleRow}>
      <Typography variant={compact ? 'h6' : 'subtitle1'} className={styles.rowTitle}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
}
