// ============================================================================
// Web SDK Types — Thin skin over @isl-lang/generator-sdk/runtime
// ============================================================================

// --- Re-exports from shared runtime (single source of truth) ----------------
export type {
  HttpMethod,
  RetryConfig,
  AuthConfig,
  RequestInitWithUrl,
  RequestInterceptor,
  ResponseInterceptor,
  ApiResponse,
  ISLErrorType as ISLError,
  ValidationResult,
} from '@isl-lang/generator-sdk/runtime';

export {
  ApiError,
  DEFAULT_RETRY,
  DEFAULT_CACHE,
  DEFAULT_HEADERS,
  DEFAULT_TIMEOUT,
} from '@isl-lang/generator-sdk/runtime';

import type {
  HttpMethod,
  RetryConfig,
  AuthConfig,
  CacheConfig as SharedCacheConfig,
  InterceptorsConfig,
  ISLErrorType,
} from '@isl-lang/generator-sdk/runtime';
import {
  DEFAULT_RETRY,
  DEFAULT_CACHE,
  DEFAULT_HEADERS,
  DEFAULT_TIMEOUT,
} from '@isl-lang/generator-sdk/runtime';

// ============================================================================
// Web-specific extensions
// ============================================================================

/**
 * Web cache config extends shared cache with storage location
 */
export interface CacheConfig extends SharedCacheConfig {
  storage: 'memory' | 'localStorage' | 'sessionStorage';
}

/**
 * Request/Response interceptors (alias)
 */
export interface Interceptors extends InterceptorsConfig {}

/**
 * Request configuration (web-specific wrapper)
 */
export interface RequestConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: RetryConfig;
  auth?: AuthConfig;
  interceptors?: Interceptors;
  cache?: CacheConfig;
}

/**
 * Validation error (field-level)
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Domain definition for SDK generation
 */
export interface Domain {
  name: string;
  baseUrl?: string;
  behaviors: Behavior[];
  entities?: Entity[];
}

export interface Behavior {
  name: string;
  method?: HttpMethod;
  path?: string;
  input?: Record<string, PropertyDef>;
  output?: Record<string, PropertyDef>;
  errors?: ErrorDef[];
}

export interface Entity {
  name: string;
  properties: Record<string, PropertyDef>;
}

export interface PropertyDef {
  type: string;
  required?: boolean;
}

export interface ErrorDef {
  name: string;
  status?: number;
  message?: string;
}

/**
 * ISL Web Client Configuration (alias for RequestConfig)
 */
export type ISLWebClientConfig = RequestConfig;

/**
 * Result type for operations
 */
export interface Result<TData, TError = ISLErrorType> {
  success: boolean;
  data?: TData;
  error?: TError;
}

/**
 * Query options for data fetching hooks
 */
export interface QueryOptions<TData> {
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: TData) => void;
  onError?: (error: ISLErrorType) => void;
  select?: (data: TData) => TData;
}

/**
 * Mutation options for data modification hooks
 */
export interface MutationOptions<TInput, TOutput> {
  onSuccess?: (data: TOutput, input: TInput) => void;
  onError?: (error: ISLErrorType, input: TInput) => void;
  onSettled?: () => void;
  validate?: (input: TInput) => { valid: boolean; errors?: string[] };
}

/**
 * Subscription options for real-time data
 */
export interface SubscriptionOptions<TData> {
  onMessage?: (data: TData) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

/**
 * WebSocket message structure
 */
export interface WebSocketMessage<T = unknown> {
  type: 'subscribe' | 'unsubscribe' | 'message' | 'ping' | 'pong' | 'error';
  channel?: string;
  data?: T;
}

/**
 * Default configuration (derived from shared defaults)
 */
export const DEFAULT_CONFIG: Required<RequestConfig> = {
  baseUrl: '',
  headers: { ...DEFAULT_HEADERS },
  timeout: DEFAULT_TIMEOUT,
  retry: { ...DEFAULT_RETRY },
  auth: { type: 'bearer' },
  interceptors: {},
  cache: {
    enabled: DEFAULT_CACHE.enabled,
    ttl: DEFAULT_CACHE.ttl,
    maxSize: DEFAULT_CACHE.maxSize,
    storage: 'memory',
  },
};
