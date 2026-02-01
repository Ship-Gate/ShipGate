'use client';

// ============================================================================
// Audit Log Hooks
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AuditEvent,
  AuditFilters,
  ComplianceReport,
  ComplianceFramework,
  ComplianceSummary,
  DateRange,
  AuditStatistics,
} from '@/lib/types';
import {
  fetchAuditEvents,
  fetchAuditEvent,
  fetchComplianceReport,
  fetchComplianceSummary,
  fetchAuditStatistics,
  fetchDomains,
  fetchBehaviors,
  generateMockEvents,
  generateMockComplianceReport,
} from '@/lib/api';
import { DEFAULT_FILTERS } from '@/lib/filters';

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

/**
 * Hook for fetching and managing audit log events
 */
export function useAuditLog(initialFilters: AuditFilters = DEFAULT_FILTERS) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  
  const pageSize = 50;
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch events
  const fetchEvents = useCallback(async (resetPage: boolean = false) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const currentPage = resetPage ? 1 : page;
    
    setLoading(true);
    setError(null);

    try {
      if (USE_MOCK_DATA) {
        // Use mock data
        await new Promise((resolve) => setTimeout(resolve, 500));
        const mockEvents = generateMockEvents(100);
        
        if (resetPage) {
          setEvents(mockEvents.slice(0, pageSize));
        } else {
          const start = (currentPage - 1) * pageSize;
          const newEvents = mockEvents.slice(start, start + pageSize);
          setEvents((prev) => (resetPage ? newEvents : [...prev, ...newEvents]));
        }
        
        setTotal(mockEvents.length);
        setHasMore(currentPage * pageSize < mockEvents.length);
      } else {
        const result = await fetchAuditEvents(filters, currentPage, pageSize);
        
        if (resetPage) {
          setEvents(result.items);
        } else {
          setEvents((prev) => [...prev, ...result.items]);
        }
        
        setTotal(result.total);
        setHasMore(result.hasMore);
      }

      if (resetPage) {
        setPage(1);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err : new Error('Failed to fetch events'));
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  // Initial fetch and filter changes
  useEffect(() => {
    fetchEvents(true);
  }, [filters]);

  // Load more events
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage((p) => p + 1);
      fetchEvents(false);
    }
  }, [loading, hasMore, fetchEvents]);

  // Refresh events
  const refresh = useCallback(() => {
    fetchEvents(true);
  }, [fetchEvents]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<AuditFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    events,
    loading,
    error,
    hasMore,
    total,
    filters,
    page,
    loadMore,
    refresh,
    setFilters: updateFilters,
    resetFilters,
  };
}

/**
 * Hook for fetching a single audit event
 */
export function useAuditEvent(id: string) {
  const [event, setEvent] = useState<AuditEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        if (USE_MOCK_DATA) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const mockEvents = generateMockEvents(1);
          setEvent({ ...mockEvents[0]!, id });
        } else {
          const result = await fetchAuditEvent(id);
          setEvent(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch event'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [id]);

  return { event, loading, error };
}

/**
 * Hook for fetching compliance report
 */
export function useComplianceReport(
  framework: ComplianceFramework,
  dateRange: DateRange
) {
  const [data, setData] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        if (USE_MOCK_DATA) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const mockReport = generateMockComplianceReport(framework);
          setData(mockReport);
        } else {
          const result = await fetchComplianceReport(framework, dateRange);
          setData(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch compliance report'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [framework, dateRange.start?.toISOString(), dateRange.end?.toISOString()]);

  return { data, loading, error };
}

/**
 * Hook for fetching compliance summary
 */
export function useComplianceSummary() {
  const [summaries, setSummaries] = useState<ComplianceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        if (USE_MOCK_DATA) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const frameworks: ComplianceFramework[] = ['SOC2', 'GDPR', 'HIPAA', 'PCI-DSS'];
          setSummaries(
            frameworks.map((f) => ({
              framework: f,
              score: 85 + Math.random() * 15,
              totalControls: 10 + Math.floor(Math.random() * 10),
              compliantControls: 8 + Math.floor(Math.random() * 8),
              violations: Math.floor(Math.random() * 5),
              lastUpdated: new Date().toISOString(),
            }))
          );
        } else {
          const result = await fetchComplianceSummary();
          setSummaries(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch compliance summary'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, []);

  return { summaries, loading, error };
}

/**
 * Hook for fetching audit statistics
 */
export function useAuditStatistics(dateRange?: DateRange) {
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        if (USE_MOCK_DATA) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const total = 5000 + Math.floor(Math.random() * 5000);
          const verified = Math.floor(total * (0.85 + Math.random() * 0.1));
          const risky = Math.floor((total - verified) * 0.7);
          
          setStatistics({
            totalEvents: total,
            byVerdict: {
              verified,
              risky,
              unsafe: total - verified - risky,
            },
            byDomain: {
              auth: Math.floor(total * 0.3),
              payment: Math.floor(total * 0.25),
              inventory: Math.floor(total * 0.25),
              shipping: Math.floor(total * 0.2),
            },
            byBehavior: {},
            averageDuration: 150 + Math.random() * 100,
            averageScore: 85 + Math.random() * 10,
          });
        } else {
          const result = await fetchAuditStatistics(dateRange);
          setStatistics(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch statistics'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [dateRange?.start?.toISOString(), dateRange?.end?.toISOString()]);

  return { statistics, loading, error };
}

/**
 * Hook for fetching available domains
 */
export function useDomains() {
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        if (USE_MOCK_DATA) {
          setDomains(['auth', 'payment', 'inventory', 'shipping']);
        } else {
          const result = await fetchDomains();
          setDomains(result);
        }
      } catch {
        setDomains([]);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, []);

  return { domains, loading };
}

/**
 * Hook for fetching behaviors
 */
export function useBehaviors(domain?: string) {
  const [behaviors, setBehaviors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        if (USE_MOCK_DATA) {
          const behaviorsByDomain: Record<string, string[]> = {
            auth: ['Login', 'Logout', 'Register', 'ResetPassword'],
            payment: ['ProcessPayment', 'Refund', 'CreateSubscription'],
            inventory: ['CreateProduct', 'UpdateStock', 'ReserveItems'],
            shipping: ['CreateShipment', 'UpdateTracking', 'DeliverPackage'],
          };
          setBehaviors(domain ? behaviorsByDomain[domain] ?? [] : Object.values(behaviorsByDomain).flat());
        } else {
          const result = await fetchBehaviors(domain);
          setBehaviors(result);
        }
      } catch {
        setBehaviors([]);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [domain]);

  return { behaviors, loading };
}
