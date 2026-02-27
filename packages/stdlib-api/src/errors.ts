// ============================================================================
// ISL Standard Library - API Client Errors
// @isl-lang/stdlib-api
// ============================================================================

// ============================================================================
// Error Kinds
// ============================================================================

export type ApiErrorKind =
  | 'Network'
  | 'Timeout'
  | 'Abort'
  | 'HttpError'
  | 'ParseError'
  | 'GraphQLError'
  | 'Unknown';

// ============================================================================
// ApiError
// ============================================================================

export interface ApiError {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  statusText?: string;
  url?: string;
  cause?: unknown;
  retryable: boolean;
}

// ============================================================================
// Factory Functions
// ============================================================================

export function networkError(message: string, cause?: unknown): ApiError {
  return { kind: 'Network', message, cause, retryable: true };
}

export function timeoutError(url: string, timeoutMs: number): ApiError {
  return {
    kind: 'Timeout',
    message: `Request to ${url} timed out after ${timeoutMs}ms`,
    url,
    retryable: true,
  };
}

export function abortError(url: string): ApiError {
  return {
    kind: 'Abort',
    message: `Request to ${url} was aborted`,
    url,
    retryable: false,
  };
}

export function httpError(status: number, statusText: string, url: string): ApiError {
  return {
    kind: 'HttpError',
    message: `HTTP ${status} ${statusText} from ${url}`,
    status,
    statusText,
    url,
    retryable: status >= 500 || status === 429,
  };
}

export function parseError(message: string, cause?: unknown): ApiError {
  return { kind: 'ParseError', message, cause, retryable: false };
}

export function graphqlError(
  message: string,
  errors?: Array<{ message: string; locations?: Array<{ line: number; column: number }>; path?: Array<string | number> }>
): ApiError {
  return {
    kind: 'GraphQLError',
    message,
    cause: errors,
    retryable: false,
  };
}

export function unknownError(message: string, cause?: unknown): ApiError {
  return { kind: 'Unknown', message, cause, retryable: false };
}

// ============================================================================
// Helpers
// ============================================================================

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}
