/**
 * Core types for the ISL React Native SDK
 *
 * Shared types (Result, errors, retry, validation) come from the canonical
 * runtime engine in @isl-lang/generator-sdk/runtime.
 * This file re-exports them and adds React-Native-specific types.
 */

// --- Re-exports from the shared runtime (single source of truth) -----------
export type {
  Result,
  ValidationResult,
  ValidationFieldError as ValidationError,
  RetryConfig as SharedRetryConfig,
  CacheConfig as SharedCacheConfig,
  RequestOptions,
  ApiErrorType as ApiError,
  NetworkErrorType as NetworkError,
  TimeoutErrorType as TimeoutError,
  ValidationApiErrorType as ValidationApiError,
  AuthErrorType as AuthError,
  RateLimitErrorType as RateLimitError,
  ISLErrorType as ISLError,
} from '@isl-lang/generator-sdk/runtime';

import type {
  ISLErrorType,
  ValidationFieldError,
} from '@isl-lang/generator-sdk/runtime';

// ============================================================================
// React-Native-specific retry/cache (convenience wrappers with RN naming)
// ============================================================================

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

// ============================================================================
// Offline / Sync (RN-only concerns)
// ============================================================================

export interface OfflineQueueItem {
  id: string;
  endpoint: string;
  method: string;
  input?: unknown;
  timestamp: number;
  retryCount: number;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
}

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: 'wifi' | 'cellular' | 'unknown' | 'none';
}

// ============================================================================
// Hook State Types
// ============================================================================

export interface QueryState<TData, TError> {
  data: TData | null;
  error: TError | null;
  isLoading: boolean;
  isRefetching: boolean;
  isFetched: boolean;
  dataUpdatedAt: number | null;
  errorUpdatedAt: number | null;
}

export interface MutationState<TData, TError> {
  data: TData | null;
  error: TError | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export interface SubscriptionState<TData, TError> {
  data: TData | null;
  error: TError | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionId: string | null;
}

// ============================================================================
// Client Configuration
// ============================================================================

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

// ============================================================================
// Hook Options
// ============================================================================

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

export interface MutationOptions<TInput, TData, TError> {
  onSuccess?: (data: TData, input: TInput) => void;
  onError?: (error: TError, input: TInput) => void;
  onSettled?: (data: TData | null, error: TError | null, input: TInput) => void;
  validate?: (input: TInput) => { valid: boolean; errors?: ValidationFieldError[] };
  optimisticUpdate?: (input: TInput) => TData;
  rollback?: (input: TInput) => void;
}

export interface SubscriptionOptions<TData, TError> {
  onData?: (data: TData) => void;
  onError?: (error: TError) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// ============================================================================
// WebSocket
// ============================================================================

export interface WSMessage<T = unknown> {
  type: 'subscribe' | 'unsubscribe' | 'data' | 'error' | 'ping' | 'pong';
  channel?: string;
  payload?: T;
  id?: string;
  timestamp?: number;
}
