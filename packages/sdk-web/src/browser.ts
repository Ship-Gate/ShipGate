/**
 * Browser-specific exports with React hooks
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ISLWebClient } from './client';
import { ISLWebSocketClient } from './websocket';
import type {
  ISLWebClientConfig,
  QueryOptions,
  MutationOptions,
  SubscriptionOptions,
  ISLError,
  Result,
} from './types';

// Re-export everything from main
export * from './index';

// React Context
import { createContext, useContext, type ReactNode } from 'react';

interface ISLContextValue {
  client: ISLWebClient;
  wsClient: ISLWebSocketClient | null;
}

const ISLContext = createContext<ISLContextValue | null>(null);

export interface ISLProviderProps {
  children: ReactNode;
  config: ISLWebClientConfig;
  wsUrl?: string;
}

/**
 * ISL Provider for React applications
 */
export function ISLProvider({ children, config, wsUrl }: ISLProviderProps) {
  const value = useMemo(() => {
    const client = new ISLWebClient(config);
    const wsClient = wsUrl
      ? new ISLWebSocketClient({ url: wsUrl, authToken: config.authToken })
      : null;
    return { client, wsClient };
  }, [config.baseUrl, config.authToken, wsUrl]);

  useEffect(() => {
    if (value.wsClient) {
      value.wsClient.connect().catch(() => {});
      return () => value.wsClient?.disconnect();
    }
  }, [value.wsClient]);

  return (
    <ISLContext.Provider value={value}>
      {children}
    </ISLContext.Provider>
  );
}

/**
 * Hook to get ISL client
 */
export function useISLClient(): ISLWebClient {
  const context = useContext(ISLContext);
  if (!context) {
    throw new Error('useISLClient must be used within ISLProvider');
  }
  return context.client;
}

/**
 * Query hook for data fetching
 */
export function useQuery<TData, TError = ISLError>(
  endpoint: string,
  options?: QueryOptions<TData> & { params?: Record<string, unknown> }
) {
  const client = useISLClient();
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<TError | null>(null);
  const [isLoading, setIsLoading] = useState(options?.enabled !== false);
  const [isRefetching, setIsRefetching] = useState(false);

  const fetchData = useCallback(async (isRefetch = false) => {
    if (options?.enabled === false) return;

    if (isRefetch) {
      setIsRefetching(true);
    } else {
      setIsLoading(true);
    }

    let url = endpoint;
    if (options?.params) {
      const searchParams = new URLSearchParams(
        Object.entries(options.params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      );
      url = `${endpoint}?${searchParams.toString()}`;
    }

    const result = await client.get<TData, TError>(url, undefined, { cache: true });

    if (result.success && result.data) {
      const selectedData = options?.select ? options.select(result.data) : result.data;
      setData(selectedData);
      setError(null);
      options?.onSuccess?.(selectedData);
    } else if (result.error) {
      setError(result.error);
      options?.onError?.(result.error as ISLError);
    }

    setIsLoading(false);
    setIsRefetching(false);
  }, [client, endpoint, options]);

  useEffect(() => {
    fetchData();
  }, [endpoint, options?.enabled]);

  useEffect(() => {
    if (options?.refetchInterval && options.refetchInterval > 0) {
      const interval = setInterval(() => fetchData(true), options.refetchInterval);
      return () => clearInterval(interval);
    }
  }, [options?.refetchInterval, fetchData]);

  return {
    data,
    error,
    isLoading,
    isRefetching,
    refetch: () => fetchData(true),
  };
}

/**
 * Mutation hook for data modifications
 */
export function useMutation<TInput, TOutput, TError = ISLError>(
  endpoint: string,
  options?: MutationOptions<TInput, TOutput> & { method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE' }
) {
  const client = useISLClient();
  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<TError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(async (input: TInput) => {
    // Validate input
    if (options?.validate) {
      const validation = options.validate(input);
      if (!validation.valid) {
        const err = {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { errors: validation.errors },
        } as TError;
        setError(err);
        options?.onError?.(err as ISLError, input);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    let result: Result<TOutput, TError>;
    const method = options?.method ?? 'POST';

    switch (method) {
      case 'PUT':
        result = await client.put<TInput, TOutput, TError>(endpoint, input);
        break;
      case 'PATCH':
        result = await client.patch<TInput, TOutput, TError>(endpoint, input);
        break;
      case 'DELETE':
        result = await client.delete<TOutput, TError>(endpoint);
        break;
      default:
        result = await client.post<TInput, TOutput, TError>(endpoint, input);
    }

    setIsLoading(false);

    if (result.success && result.data) {
      setData(result.data);
      options?.onSuccess?.(result.data, input);
    } else if (result.error) {
      setError(result.error);
      options?.onError?.(result.error as ISLError, input);
    }

    options?.onSettled?.();
  }, [client, endpoint, options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, data, error, isLoading, reset };
}

/**
 * Subscription hook for real-time data
 */
export function useSubscription<TData>(
  channel: string,
  options?: SubscriptionOptions<TData>
) {
  const context = useContext(ISLContext);
  const [data, setData] = useState<TData | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!context?.wsClient) return;

    const unsubscribe = context.wsClient.subscribe<TData>(
      channel,
      (message) => {
        setData(message);
        options?.onMessage?.(message);
      },
      {
        onConnect: () => {
          setIsConnected(true);
          options?.onConnect?.();
        },
        onDisconnect: () => {
          setIsConnected(false);
          options?.onDisconnect?.();
        },
        onError: options?.onError,
      }
    );

    return unsubscribe;
  }, [channel, context?.wsClient]);

  return { data, isConnected };
}
