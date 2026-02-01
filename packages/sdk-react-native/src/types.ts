/**
 * Core types for the ISL React Native SDK
 */

// Result type for API responses
export type Result<TData, TError> =
  | { success: true; data: TData }
  | { success: false; error: TError };

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// Request options
export interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: RetryConfig;
  cache?: CacheConfig;
}

export interface RetryConfig {
  maxRetries: number;
  backoff: 'linear' | 'exponential';
  initialDelayMs: number;
  maxDelayMs: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttlMs: number;
  key?: string;
}

// Offline queue item
export interface OfflineQueueItem {
  id: string;
  endpoint: string;
  method: string;
  input?: unknown;
  timestamp: number;
  retryCount: number;
}

// Sync status
export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
}

// Network state
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: 'wifi' | 'cellular' | 'unknown' | 'none';
}

// Query state
export interface QueryState<TData, TError> {
  data: TData | null;
  error: TError | null;
  isLoading: boolean;
  isRefetching: boolean;
  isFetched: boolean;
  dataUpdatedAt: number | null;
  errorUpdatedAt: number | null;
}

// Mutation state
export interface MutationState<TData, TError> {
  data: TData | null;
  error: TError | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

// Subscription state
export interface SubscriptionState<TData, TError> {
  data: TData | null;
  error: TError | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionId: string | null;
}

// ISL Client configuration
export interface ISLClientConfig {
  baseUrl: string;
  wsUrl?: string;
  authToken?: string;
  enableOffline?: boolean;
  enableVerification?: boolean;
  enableLogging?: boolean;
  timeout?: number;
  retry?: RetryConfig;
  onAuthError?: () => void;
  onNetworkChange?: (state: NetworkState) => void;
}

// Query options
export interface QueryOptions<TData, TError> {
  enabled?: boolean;
  refetchInterval?: number;
  refetchOnFocus?: boolean;
  staleTime?: number;
  cacheTime?: number;
  retry?: boolean | number;
  retryDelay?: number;
  onSuccess?: (data: TData) => void;
  onError?: (error: TError) => void;
  select?: (data: TData) => TData;
  initialData?: TData;
}

// Mutation options
export interface MutationOptions<TInput, TData, TError> {
  onSuccess?: (data: TData, input: TInput) => void;
  onError?: (error: TError, input: TInput) => void;
  onSettled?: (data: TData | null, error: TError | null, input: TInput) => void;
  validate?: (input: TInput) => ValidationResult;
  optimisticUpdate?: (input: TInput) => TData;
  rollback?: (input: TInput) => void;
}

// Subscription options
export interface SubscriptionOptions<TData, TError> {
  onData?: (data: TData) => void;
  onError?: (error: TError) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// WebSocket message types
export interface WSMessage<T = unknown> {
  type: 'subscribe' | 'unsubscribe' | 'data' | 'error' | 'ping' | 'pong';
  channel?: string;
  payload?: T;
  id?: string;
  timestamp?: number;
}

// API Error types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode?: number;
}

export type NetworkError = {
  code: 'NETWORK_ERROR';
  message: string;
  isOffline: boolean;
};

export type TimeoutError = {
  code: 'TIMEOUT';
  message: string;
  timeoutMs: number;
};

export type ValidationApiError = {
  code: 'VALIDATION_ERROR';
  message: string;
  errors: ValidationError[];
};

export type AuthError = {
  code: 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'UNAUTHORIZED';
  message: string;
};

export type RateLimitError = {
  code: 'RATE_LIMITED';
  message: string;
  retryAfter: number;
};

export type ISLError =
  | ApiError
  | NetworkError
  | TimeoutError
  | ValidationApiError
  | AuthError
  | RateLimitError;
