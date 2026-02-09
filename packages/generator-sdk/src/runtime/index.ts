/**
 * @isl-lang/generator-sdk — Shared Runtime
 *
 * Single-source-of-truth for error model, auth hooks, retry/backoff,
 * pagination, and base HTTP client used by every SDK target.
 *
 * SDK skins import from '@isl-lang/generator-sdk/runtime'.
 */

// ============================================================================
// Types
// ============================================================================

export type {
  HttpMethod,
  ISLClientConfig,
  AuthConfig,
  RetryConfig,
  CacheConfig,
  RequestInitWithUrl,
  RequestInterceptor,
  ResponseInterceptor,
  InterceptorsConfig,
  VerificationConfig,
  ApiResponse,
  Result,
  ValidationResult,
  ValidationFieldError,
  PaginationParams,
  PaginatedResponse,
  RequestOptions,
  ApiErrorType,
  NetworkErrorType,
  TimeoutErrorType,
  ValidationApiErrorType,
  AuthErrorType,
  RateLimitErrorType,
  ISLErrorType,
} from './types.js';

export {
  DEFAULT_RETRY,
  DEFAULT_CACHE,
  DEFAULT_HEADERS,
  DEFAULT_TIMEOUT,
} from './types.js';

// ============================================================================
// Errors
// ============================================================================

export {
  ISLError,
  ValidationError,
  PreconditionError,
  PostconditionError,
  NetworkError,
  ServerError,
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  toISLError,
  errorFromStatus,
} from './errors.js';

// ============================================================================
// Auth
// ============================================================================

export {
  resolveAuthHeader,
  createAuthInterceptors,
  hasAuthCredentials,
} from './auth.js';

// ============================================================================
// Retry
// ============================================================================

export {
  calculateRetryDelay,
  withRetry,
  isRetryableStatus,
  sleep,
} from './retry.js';
export type { RetryResult } from './retry.js';

// ============================================================================
// Pagination
// ============================================================================

export {
  paginate,
  paginateAll,
  toPaginatedResponse,
  buildPaginationQuery,
} from './pagination.js';

// ============================================================================
// Base Client
// ============================================================================

export { BaseClient, createBaseClient } from './client.js';
