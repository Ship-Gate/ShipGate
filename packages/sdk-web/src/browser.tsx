/**
 * Browser-specific exports with React hooks
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ISLClient } from './client';
import { ISLWebSocketClient } from './websocket';
import type {
  RequestConfig,
  QueryOptions,
  MutationOptions,
  SubscriptionOptions,
  ISLError,
  ApiResponse,
} from './types';

// Re-export everything from main
export * from './index';

// React Context
import { createContext, useContext, type ReactNode } from 'react';

interface ISLContextValue {
  client: ISLClient;
  wsClient: ISLWebSocketClient | null;
}

const ISLContext = createContext<ISLContextValue | null>(null);

export interface ISLProviderProps {
  children: ReactNode;
  config: Partial<RequestConfig> & { baseUrl: string; authToken?: string };
  wsUrl?: string;
}

/**
 * ISL Provider for React applications
 */
export function ISLProvider({ children, config, wsUrl }: ISLProviderProps) {
  const value = useMemo(() => {
    const client = new ISLClient(config);
    const wsClient = wsUrl
      ? new ISLWebSocketClient({ url: wsUrl, authToken: config.authToken })
      : null;
    return { client, wsClient };
  }, [config, wsUrl]);

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
export function useISLClient(): ISLClient {
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
  options?: QueryOptions<TData> & { params?: Record<string, string> }
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

    try {
      const response = await client.get<TData>(endpoint, options?.params);

      if (response.ok && response.data) {
        const selectedData = options?.select ? options.select(response.data) : response.data;
        setData(selectedData);
        setError(null);
        options?.onSuccess?.(selectedData);
      }
    } catch (err) {
      const apiError = err as TError;
      setError(apiError);
      options?.onError?.(apiError as unknown as ISLError);
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

    try {
      let response: ApiResponse<TOutput>;
      const method = options?.method ?? 'POST';

      switch (method) {
        case 'PUT':
          response = await client.put<TOutput>(endpoint, input);
          break;
        case 'PATCH':
          response = await client.patch<TOutput>(endpoint, input);
          break;
        case 'DELETE':
          response = await client.delete<TOutput>(endpoint);
          break;
        default:
          response = await client.post<TOutput>(endpoint, input);
      }

      setIsLoading(false);

      if (response.ok && response.data) {
        setData(response.data);
        options?.onSuccess?.(response.data, input);
      }
    } catch (err) {
      setIsLoading(false);
      const apiError = err as TError;
      setError(apiError);
      options?.onError?.(apiError as unknown as ISLError, input);
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
      (message: TData) => {
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
