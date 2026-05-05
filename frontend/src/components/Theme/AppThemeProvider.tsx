'use client';

import React from 'react';
import { CssBaseline } from '@mui/material';
import { ThemeProvider, alpha, createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0f8f9b',
      dark: '#0a5d67',
      light: '#65d3d0',
    },
    secondary: {
      main: '#d99631',
      dark: '#9f6716',
      light: '#f3c979',
    },
    success: {
      main: '#2f8f6b',
    },
    warning: {
      main: '#d57f2f',
    },
    info: {
      main: '#3978b8',
    },
    background: {
      default: '#eef4fb',
      paper: '#fdfefe',
    },
    text: {
      primary: '#13283d',
      secondary: '#607489',
    },
    divider: 'rgba(19, 40, 61, 0.08)',
  },
  shape: {
    borderRadius: 20,
  },
  typography: {
    fontFamily: '"Aptos", "Aptos Display", "Segoe UI Variable", "Segoe UI", sans-serif',
    h1: {
      fontWeight: 800,
      letterSpacing: '-0.04em',
    },
    h2: {
      fontWeight: 800,
      letterSpacing: '-0.04em',
    },
    h3: {
      fontWeight: 800,
      letterSpacing: '-0.03em',
    },
    h4: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 20,
          minHeight: 44,
        },
        containedPrimary: {
          color: '#f6fffe',
          background: 'linear-gradient(135deg, #12a1ad 0%, #136986 100%)',
          boxShadow: '0 18px 36px rgba(13, 85, 103, 0.22)',
          '&:hover': {
            background: 'linear-gradient(135deg, #159daf 0%, #10556f 100%)',
            boxShadow: '0 22px 42px rgba(13, 85, 103, 0.28)',
          },
        },
        outlinedPrimary: {
          borderColor: alpha('#0f8f9b', 0.22),
          background: alpha('#ffffff', 0.56),
          '&:hover': {
            borderColor: alpha('#0f8f9b', 0.36),
            background: alpha('#ffffff', 0.82),
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(19, 40, 61, 0.08)',
          boxShadow: '0 24px 54px rgba(12, 31, 48, 0.08)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          letterSpacing: '0.01em',
        },
        outlined: {
          borderColor: alpha('#13283d', 0.1),
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          background: alpha('#ffffff', 0.82),
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#13283d', 0.12),
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#0f8f9b', 0.28),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#0f8f9b',
            borderWidth: 2,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#607489',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          fontWeight: 700,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 18,
        },
      },
    },
  },
});

interface AppThemeProviderProps {
  children: React.ReactNode;
}

export default function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
