// ============================================================================
// Web SDK Types
// ============================================================================

/**
 * HTTP methods supported
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Request configuration
 */
export interface RequestConfig {
  /** Base URL for API */
  baseUrl: string;
  
  /** Default headers */
  headers?: Record<string, string>;
  
  /** Request timeout in ms */
  timeout?: number;
  
  /** Retry configuration */
  retry?: RetryConfig;
  
  /** Authentication */
  auth?: AuthConfig;
  
  /** Request interceptors */
  interceptors?: Interceptors;
  
  /** Enable request caching */
  cache?: CacheConfig;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Max retry attempts */
  maxAttempts: number;
  
  /** Base delay between retries (ms) */
  baseDelay: number;
  
  /** Max delay (ms) */
  maxDelay: number;
  
  /** Status codes to retry */
  retryableStatusCodes: number[];
  
  /** Backoff strategy */
  backoff: 'linear' | 'exponential';
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  type: 'bearer' | 'api-key' | 'basic' | 'oauth2';
  token?: string | (() => string | Promise<string>);
  apiKey?: string;
  apiKeyHeader?: string;
  refreshToken?: () => Promise<string>;
  onUnauthorized?: () => void;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  storage: 'memory' | 'localStorage' | 'sessionStorage';
  maxSize?: number;
}

/**
 * Request/Response interceptors
 */
export interface Interceptors {
  request?: RequestInterceptor[];
  response?: ResponseInterceptor[];
}

/**
 * Extended request init with URL
 */
export type RequestInitWithUrl = RequestInit & { url: string };

export type RequestInterceptor = (config: RequestInitWithUrl) => Promise<RequestInitWithUrl>;
export type ResponseInterceptor = (response: Response, request: RequestInitWithUrl) => Promise<Response>;

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  ok: boolean;
}

/**
 * API Error
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
    public headers: Headers
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

/**
 * Validation error
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
 * Generic ISL Error type
 */
export interface ISLError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Result type for operations
 */
export interface Result<TData, TError = ISLError> {
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
  onError?: (error: ISLError) => void;
  select?: (data: TData) => TData;
}

/**
 * Mutation options for data modification hooks
 */
export interface MutationOptions<TInput, TOutput> {
  onSuccess?: (data: TOutput, input: TInput) => void;
  onError?: (error: ISLError, input: TInput) => void;
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
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Required<RequestConfig> = {
  baseUrl: '',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    backoff: 'exponential',
  },
  auth: {
    type: 'bearer',
  },
  interceptors: {},
  cache: {
    enabled: false,
    ttl: 60000,
    storage: 'memory',
    maxSize: 100,
  },
};
