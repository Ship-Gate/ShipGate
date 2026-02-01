/**
 * useQuery - Data fetching hook with caching and refetching
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useISLClient } from './useISLClient';
import type { QueryState, QueryOptions, ISLError } from '../types';
import { stableKey, deepEqual } from '../utils/helpers';

interface QueryResult<TData, TError> extends QueryState<TData, TError> {
  refetch: () => Promise<void>;
  invalidate: () => void;
}

// Simple in-memory cache for queries
const queryCache = new Map<string, {
  data: unknown;
  error: unknown;
  timestamp: number;
}>();

/**
 * Query hook for fetching data
 */
export function useQuery<TData, TError = ISLError>(
  endpoint: string,
  options?: QueryOptions<TData, TError> & { params?: Record<string, unknown> }
): QueryResult<TData, TError> {
  const client = useISLClient();
  const [state, setState] = useState<QueryState<TData, TError>>({
    data: options?.initialData ?? null,
    error: null,
    isLoading: options?.enabled !== false,
    isRefetching: false,
    isFetched: false,
    dataUpdatedAt: null,
    errorUpdatedAt: null,
  });

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Create stable cache key
  const cacheKey = stableKey({ endpoint, params: options?.params });
  
  // Fetch function
  const fetchData = useCallback(async (isRefetch = false) => {
    if (options?.enabled === false) return;
    
    // Check cache
    const cached = queryCache.get(cacheKey);
    const staleTime = options?.staleTime ?? 0;
    
    if (cached && Date.now() - cached.timestamp < staleTime) {
      if (mountedRef.current && !deepEqual(state.data, cached.data)) {
        setState(s => ({
          ...s,
          data: cached.data as TData,
          isLoading: false,
          isFetched: true,
          dataUpdatedAt: cached.timestamp,
        }));
      }
      return;
    }
    
    if (mountedRef.current) {
      setState(s => ({
        ...s,
        isLoading: !isRefetch && !s.isFetched,
        isRefetching: isRefetch,
      }));
    }

    // Build URL with params
    let url = endpoint;
    if (options?.params) {
      const searchParams = new URLSearchParams(
        Object.entries(options.params)
          .filter(([_, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      );
      const queryString = searchParams.toString();
      if (queryString) {
        url = `${endpoint}?${queryString}`;
      }
    }

    const result = await client.get<TData, TError>(url);

    if (!mountedRef.current) return;

    if (result.success) {
      const data = options?.select ? options.select(result.data) : result.data;
      const now = Date.now();
      
      // Update cache
      queryCache.set(cacheKey, { data, error: null, timestamp: now });
      
      setState({
        data,
        error: null,
        isLoading: false,
        isRefetching: false,
        isFetched: true,
        dataUpdatedAt: now,
        errorUpdatedAt: null,
      });
      
      options?.onSuccess?.(data);
    } else {
      const now = Date.now();
      
      // Update cache with error
      queryCache.set(cacheKey, { data: null, error: result.error, timestamp: now });
      
      setState(s => ({
        ...s,
        error: result.error,
        isLoading: false,
        isRefetching: false,
        isFetched: true,
        errorUpdatedAt: now,
      }));
      
      options?.onError?.(result.error);
    }
  }, [client, endpoint, options, cacheKey, state.data]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, [cacheKey, options?.enabled]);

  // Refetch interval
  useEffect(() => {
    if (options?.refetchInterval && options.refetchInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData(true);
      }, options.refetchInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [options?.refetchInterval, fetchData]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // Invalidate cache
  const invalidate = useCallback(() => {
    queryCache.delete(cacheKey);
    fetchData(true);
  }, [cacheKey, fetchData]);

  return {
    ...state,
    refetch,
    invalidate,
  };
}

/**
 * Prefetch query data
 */
export async function prefetchQuery<TData>(
  client: { get: (url: string) => Promise<{ success: boolean; data: TData }> },
  endpoint: string,
  params?: Record<string, unknown>
): Promise<void> {
  const cacheKey = stableKey({ endpoint, params });
  
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    );
    const queryString = searchParams.toString();
    if (queryString) {
      url = `${endpoint}?${queryString}`;
    }
  }

  const result = await client.get(url);
  
  if (result.success) {
    queryCache.set(cacheKey, {
      data: result.data,
      error: null,
      timestamp: Date.now(),
    });
  }
}

/**
 * Invalidate all queries matching a pattern
 */
export function invalidateQueries(pattern?: string | RegExp): void {
  if (!pattern) {
    queryCache.clear();
    return;
  }

  for (const key of queryCache.keys()) {
    const matches = typeof pattern === 'string'
      ? key.includes(pattern)
      : pattern.test(key);
    
    if (matches) {
      queryCache.delete(key);
    }
  }
}

/**
 * Get query data from cache
 */
export function getQueryData<TData>(
  endpoint: string,
  params?: Record<string, unknown>
): TData | null {
  const cacheKey = stableKey({ endpoint, params });
  const cached = queryCache.get(cacheKey);
  return cached?.data as TData | null;
}

/**
 * Set query data in cache
 */
export function setQueryData<TData>(
  endpoint: string,
  data: TData,
  params?: Record<string, unknown>
): void {
  const cacheKey = stableKey({ endpoint, params });
  queryCache.set(cacheKey, {
    data,
    error: null,
    timestamp: Date.now(),
  });
}
