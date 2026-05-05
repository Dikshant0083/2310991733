'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/notifications/priority', label: 'Priority Feed' },
];

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const activeItem = navItems.find((item) => item.href === pathname) || navItems[0];
  const studentContext = process.env.NEXT_PUBLIC_STUDENT_ID || '1042';

  return (
    <Box className={styles.page}>
      <AppBar position="sticky" elevation={0} className={styles.appBar}>
        <Toolbar className={styles.toolbar}>
          <Stack spacing={1.5} className={styles.identityBlock}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box className={styles.logo}>
                <NotificationsActiveRoundedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle1" className={styles.brand}>
                  Campus Notification System
                </Typography>
                <Typography variant="caption" className={styles.subtitle}>
                  Real-time delivery for placements, events, and academic results
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} className={styles.signalRow}>
              <Chip
                label={`Now viewing - ${activeItem.label}`}
                size="small"
                className={styles.signalChip}
              />
              <Chip label="Live updates enabled" size="small" className={styles.ghostChip} />
              <Chip label={`Student ${studentContext}`} size="small" className={styles.ghostChip} />
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} className={styles.nav}>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  variant={isActive ? 'contained' : 'text'}
                  size="medium"
                  className={isActive ? styles.activeNavButton : styles.navButton}
                  startIcon={item.href.includes('priority') ? <AutoAwesomeRoundedIcon /> : undefined}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" className={styles.content}>
        {children}
      </Container>
    </Box>
  );
};

export default AppShell;
