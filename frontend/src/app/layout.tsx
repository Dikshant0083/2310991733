import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AppThemeProvider from '@/components/Theme/AppThemeProvider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Campus Notification System',
  description: 'Production-grade campus notifications for placements, events, and results.',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
