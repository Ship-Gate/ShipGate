/**
 * Shared Runtime Types
 *
 * Canonical type definitions shared across all SDK targets (TypeScript, Web, React Native).
 * Every SDK skin imports from here — never duplicates.
 */

// ============================================================================
// HTTP Primitives
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ============================================================================
// Client Configuration
// ============================================================================

export interface ISLClientConfig {
  /** Base URL of the API */
  readonly baseUrl: string;
  /** Authentication configuration */
  readonly auth?: AuthConfig;
  /** Request timeout in ms (default: 30000) */
  readonly timeout?: number;
  /** Custom fetch implementation (for Node.js or testing) */
  readonly fetch?: typeof globalThis.fetch;
  /** Retry configuration */
  readonly retry?: RetryConfig;
  /** Default headers sent with every request */
  readonly headers?: Record<string, string>;
  /** Request/response interceptors */
  readonly interceptors?: InterceptorsConfig;
  /** Cache configuration */
  readonly cache?: CacheConfig;
  /** Verification configuration */
  readonly verification?: VerificationConfig;
}

// ============================================================================
// Auth
// ============================================================================

export interface AuthConfig {
  type: 'bearer' | 'api-key' | 'basic' | 'oauth2';
  /** Static token string or async getter */
  token?: string | (() => string | Promise<string>);
  /** API key (when type = 'api-key') */
  apiKey?: string;
  /** Header name for the API key (default: 'X-API-Key') */
  apiKeyHeader?: string;
  /** Refresh token callback — returns new access token */
  refreshToken?: () => Promise<string>;
  /** Called on 401 after refresh fails */
  onUnauthorized?: () => void;
}

// ============================================================================
// Retry
// ============================================================================

export interface RetryConfig {
  /** Max number of attempts (including initial) */
  readonly maxAttempts: number;
  /** Base delay between retries (ms) */
  readonly baseDelay: number;
  /** Maximum delay cap (ms) */
  readonly maxDelay: number;
  /** HTTP status codes eligible for retry */
  readonly retryableStatusCodes: readonly number[];
  /** Backoff strategy */
  readonly backoff: 'linear' | 'exponential';
}

// ============================================================================
// Cache
// ============================================================================

export interface CacheConfig {
  readonly enabled: boolean;
  /** Time-to-live in ms */
  readonly ttl: number;
  /** Max number of cached entries */
  readonly maxSize?: number;
}

// ============================================================================
// Interceptors
// ============================================================================

export type RequestInitWithUrl = RequestInit & { url: string };

export type RequestInterceptor = (
  config: RequestInitWithUrl,
) => RequestInitWithUrl | Promise<RequestInitWithUrl>;

export type ResponseInterceptor = (
  response: Response,
  request: RequestInitWithUrl,
) => Response | Promise<Response>;

export interface InterceptorsConfig {
  readonly request?: RequestInterceptor[];
  readonly response?: ResponseInterceptor[];
}

// ============================================================================
// Verification
// ============================================================================

export interface VerificationConfig {
  readonly enablePreconditions?: boolean;
  readonly enablePostconditions?: boolean;
  readonly throwOnViolation?: boolean;
  readonly logViolations?: boolean;
}

// ============================================================================
// API Response
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  ok: boolean;
}

// ============================================================================
// Result (discriminated union — safe for all platforms)
// ============================================================================

export type Result<TData, TError = ISLErrorType> =
  | { success: true; data: TData }
  | { success: false; error: TError };

// ============================================================================
// Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationFieldError[];
}

export interface ValidationFieldError {
  field: string;
  message: string;
  code?: string;
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationParams {
  /** Cursor / page token for the next page */
  cursor?: string;
  /** Maximum items per page */
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

// ============================================================================
// Request Options (per-call overrides)
// ============================================================================

export interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: Partial<RetryConfig>;
  cache?: Partial<CacheConfig>;
}

// ============================================================================
// Error Union (discriminated by `code`)
// ============================================================================

export interface ApiErrorType {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode?: number;
}

export interface NetworkErrorType {
  code: 'NETWORK_ERROR';
  message: string;
  isOffline: boolean;
}

export interface TimeoutErrorType {
  code: 'TIMEOUT';
  message: string;
  timeoutMs: number;
}

export interface ValidationApiErrorType {
  code: 'VALIDATION_ERROR';
  message: string;
  errors: ValidationFieldError[];
}

export interface AuthErrorType {
  code: 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'UNAUTHORIZED';
  message: string;
}

export interface RateLimitErrorType {
  code: 'RATE_LIMITED';
  message: string;
  retryAfter: number;
}

export type ISLErrorType =
  | ApiErrorType
  | NetworkErrorType
  | TimeoutErrorType
  | ValidationApiErrorType
  | AuthErrorType
  | RateLimitErrorType;

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10_000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  backoff: 'exponential',
};

export const DEFAULT_CACHE: CacheConfig = {
  enabled: false,
  ttl: 60_000,
  maxSize: 100,
};

export const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export const DEFAULT_TIMEOUT = 30_000;
