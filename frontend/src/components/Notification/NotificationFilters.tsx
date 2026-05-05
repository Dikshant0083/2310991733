'use client';

import React from 'react';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { NotificationFilters } from '@/types/notification';

interface NotificationFiltersProps {
  filters: NotificationFilters;
  onChange: (filters: NotificationFilters) => void;
}

const fieldStyles = {
  '& .MuiOutlinedInput-root': {
    minHeight: 56,
  },
};

export const NotificationFiltersPanel: React.FC<NotificationFiltersProps> = ({
  filters,
  onChange,
}) => {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <FormControl fullWidth sx={fieldStyles}>
          <InputLabel id="type-filter-label">Type</InputLabel>
          <Select
            labelId="type-filter-label"
            value={filters.type}
            label="Type"
            onChange={(event) =>
              onChange({
                ...filters,
                type: event.target.value as NotificationFilters['type'],
              })
            }
          >
            <MenuItem value="all">All types</MenuItem>
            <MenuItem value="placement">Placement</MenuItem>
            <MenuItem value="result">Result</MenuItem>
            <MenuItem value="event">Event</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth sx={fieldStyles}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            value={filters.status}
            label="Status"
            onChange={(event) =>
              onChange({
                ...filters,
                status: event.target.value as NotificationFilters['status'],
              })
            }
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="unread">Unread</MenuItem>
            <MenuItem value="read">Read</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <TextField
        label="Search"
        value={filters.search}
        fullWidth
        onChange={(event) =>
          onChange({
            ...filters,
            search: event.target.value,
          })
        }
        placeholder="Search by title or description"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={fieldStyles}
      />
    </Stack>
  );
};

export default NotificationFiltersPanel;
