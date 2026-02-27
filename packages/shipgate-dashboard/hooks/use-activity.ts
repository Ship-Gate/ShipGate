'use client';

import { useApi } from './use-api';

export interface ActivityItem {
  id: string;
  type: 'run' | 'finding' | 'audit';
  title: string;
  subtitle: string | null;
  timestamp: string;
  meta: Record<string, unknown>;
}

export function useActivity(limit = 15) {
  return useApi<{ items: ActivityItem[] }>(
    `/api/v1/activity?limit=${limit}`
  );
}
