// ============================================================================
// Filter Utilities
// ============================================================================

import type { AuditEvent, AuditFilters, DateRange, Verdict } from './types';

/**
 * Default filter values
 */
export const DEFAULT_FILTERS: AuditFilters = {
  domain: null,
  behavior: null,
  actor: null,
  verdict: null,
  dateRange: { start: null, end: null },
  search: '',
};

/**
 * Check if filters are empty (default state)
 */
export function isFiltersEmpty(filters: AuditFilters): boolean {
  return (
    !filters.domain &&
    !filters.behavior &&
    !filters.actor &&
    !filters.verdict &&
    !filters.dateRange.start &&
    !filters.dateRange.end &&
    !filters.search
  );
}

/**
 * Count active filters
 */
export function countActiveFilters(filters: AuditFilters): number {
  let count = 0;
  if (filters.domain) count++;
  if (filters.behavior) count++;
  if (filters.actor) count++;
  if (filters.verdict) count++;
  if (filters.dateRange.start || filters.dateRange.end) count++;
  if (filters.search) count++;
  return count;
}

/**
 * Apply filters to events (client-side filtering)
 */
export function applyFilters(events: AuditEvent[], filters: AuditFilters): AuditEvent[] {
  return events.filter((event) => {
    // Domain filter
    if (filters.domain && event.domain !== filters.domain) {
      return false;
    }

    // Behavior filter
    if (filters.behavior && event.behavior !== filters.behavior) {
      return false;
    }

    // Actor filter
    if (filters.actor && event.actor.id !== filters.actor && event.actor.name !== filters.actor) {
      return false;
    }

    // Verdict filter
    if (filters.verdict && event.verdict !== filters.verdict) {
      return false;
    }

    // Date range filter
    const eventDate = new Date(event.timestamp);
    if (filters.dateRange.start && eventDate < filters.dateRange.start) {
      return false;
    }
    if (filters.dateRange.end && eventDate > filters.dateRange.end) {
      return false;
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchableText = [
        event.domain,
        event.behavior,
        event.actor.id,
        event.actor.name,
        event.id,
        JSON.stringify(event.input),
        JSON.stringify(event.output),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      
      if (!searchableText.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Parse filters from URL search params
 */
export function parseFiltersFromUrl(searchParams: URLSearchParams): AuditFilters {
  const domain = searchParams.get('domain');
  const behavior = searchParams.get('behavior');
  const actor = searchParams.get('actor');
  const verdict = searchParams.get('verdict') as Verdict | null;
  const search = searchParams.get('search') ?? '';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  return {
    domain,
    behavior,
    actor,
    verdict,
    search,
    dateRange: {
      start: startDate ? new Date(startDate) : null,
      end: endDate ? new Date(endDate) : null,
    },
  };
}

/**
 * Serialize filters to URL search params
 */
export function serializeFiltersToUrl(filters: AuditFilters): string {
  const params = new URLSearchParams();

  if (filters.domain) params.set('domain', filters.domain);
  if (filters.behavior) params.set('behavior', filters.behavior);
  if (filters.actor) params.set('actor', filters.actor);
  if (filters.verdict) params.set('verdict', filters.verdict);
  if (filters.search) params.set('search', filters.search);
  if (filters.dateRange.start) params.set('startDate', filters.dateRange.start.toISOString());
  if (filters.dateRange.end) params.set('endDate', filters.dateRange.end.toISOString());

  return params.toString();
}

/**
 * Preset date ranges
 */
export type DateRangePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';

export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };

    case 'yesterday': {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return {
        start: yesterday,
        end: new Date(today.getTime() - 1),
      };
    }

    case 'last7days':
      return {
        start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now,
      };

    case 'last30days':
      return {
        start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
      };

    case 'thisMonth':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: now,
      };

    case 'lastMonth': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: lastMonth,
        end: lastMonthEnd,
      };
    }

    case 'custom':
    default:
      return { start: null, end: null };
  }
}

/**
 * Get display label for date range
 */
export function getDateRangeLabel(dateRange: DateRange): string {
  if (!dateRange.start && !dateRange.end) {
    return 'All time';
  }

  if (dateRange.start && dateRange.end) {
    const startStr = formatDate(dateRange.start);
    const endStr = formatDate(dateRange.end);
    
    if (startStr === endStr) {
      return startStr;
    }
    
    return `${startStr} - ${endStr}`;
  }

  if (dateRange.start) {
    return `From ${formatDate(dateRange.start)}`;
  }

  return `Until ${formatDate(dateRange.end!)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
