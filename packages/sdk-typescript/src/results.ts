/**
 * ISL Results - Typed result types for API operations.
 */

import type { User } from './models';

// =============================================================================
// Base Result Type
// =============================================================================

/**
 * Discriminated union result type
 */
export type Result<T, E> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: E };

/**
 * Create a success result
 */
export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

/**
 * Create an error result
 */
export function err<E>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}

/**
 * Result helper methods
 */
export const ResultHelpers = {
  /**
   * Unwrap a result or throw
   */
  unwrap<T, E>(result: Result<T, E>): T {
    if (result.ok) return result.data;
    throw new Error(`Cannot unwrap error result: ${JSON.stringify(result.error)}`);
  },

  /**
   * Unwrap with default value
   */
  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    return result.ok ? result.data : defaultValue;
  },

  /**
   * Unwrap with default factory
   */
  unwrapOrElse<T, E>(result: Result<T, E>, fn: () => T): T {
    return result.ok ? result.data : fn();
  },

  /**
   * Map success value
   */
  map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return result.ok ? ok(fn(result.data)) : result;
  },

  /**
   * Map error value
   */
  mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return result.ok ? result : err(fn(result.error));
  },

  /**
   * Flat map result
   */
  flatMap<T, E, U>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
    return result.ok ? fn(result.data) : result;
  },
};

// =============================================================================
// Error Types
// =============================================================================

/**
 * Base error structure
 */
export interface BaseError {
  readonly code: string;
  readonly message: string;
}

/**
 * Create user errors
 */
export type CreateUserError =
  | { readonly code: 'DUPLICATE_EMAIL' }
  | { readonly code: 'DUPLICATE_USERNAME' }
  | { readonly code: 'INVALID_INPUT'; readonly message: string; readonly field?: string }
  | { readonly code: 'RATE_LIMITED'; readonly retryAfter: number }
  | { readonly code: 'SERVER_ERROR'; readonly message: string }
  | { readonly code: 'NETWORK_ERROR'; readonly cause?: Error };

/**
 * Get user errors
 */
export type GetUserError =
  | { readonly code: 'NOT_FOUND' }
  | { readonly code: 'UNAUTHORIZED' }
  | { readonly code: 'SERVER_ERROR'; readonly message: string }
  | { readonly code: 'NETWORK_ERROR'; readonly cause?: Error };

/**
 * Update user errors
 */
export type UpdateUserError =
  | { readonly code: 'NOT_FOUND' }
  | { readonly code: 'UNAUTHORIZED' }
  | { readonly code: 'FORBIDDEN' }
  | { readonly code: 'INVALID_INPUT'; readonly message: string; readonly field?: string }
  | { readonly code: 'CONFLICT'; readonly message: string }
  | { readonly code: 'RATE_LIMITED'; readonly retryAfter: number }
  | { readonly code: 'SERVER_ERROR'; readonly message: string }
  | { readonly code: 'NETWORK_ERROR'; readonly cause?: Error };

/**
 * Delete user errors
 */
export type DeleteUserError =
  | { readonly code: 'NOT_FOUND' }
  | { readonly code: 'UNAUTHORIZED' }
  | { readonly code: 'FORBIDDEN' }
  | { readonly code: 'SERVER_ERROR'; readonly message: string }
  | { readonly code: 'NETWORK_ERROR'; readonly cause?: Error };

/**
 * List users errors
 */
export type ListUsersError =
  | { readonly code: 'UNAUTHORIZED' }
  | { readonly code: 'INVALID_INPUT'; readonly message: string }
  | { readonly code: 'SERVER_ERROR'; readonly message: string }
  | { readonly code: 'NETWORK_ERROR'; readonly cause?: Error };

/**
 * Search users errors
 */
export type SearchUsersError =
  | { readonly code: 'UNAUTHORIZED' }
  | { readonly code: 'INVALID_INPUT'; readonly message: string }
  | { readonly code: 'SERVER_ERROR'; readonly message: string }
  | { readonly code: 'NETWORK_ERROR'; readonly cause?: Error };

// =============================================================================
// Result Types
// =============================================================================

/**
 * Create user result
 */
export type CreateUserResult = Result<User, CreateUserError>;

/**
 * Get user result
 */
export type GetUserResult = Result<User, GetUserError>;

/**
 * Update user result
 */
export type UpdateUserResult = Result<User, UpdateUserError>;

/**
 * Delete user result
 */
export type DeleteUserResult = Result<void, DeleteUserError>;

/**
 * List users result
 */
export type ListUsersResult = Result<
  {
    readonly users: readonly User[];
    readonly nextPageToken?: string;
    readonly totalCount?: number;
  },
  ListUsersError
>;

/**
 * Search users result
 */
export type SearchUsersResult = Result<
  {
    readonly users: readonly User[];
    readonly nextPageToken?: string;
    readonly totalCount?: number;
  },
  SearchUsersError
>;

// =============================================================================
// Error Factories
// =============================================================================

export const CreateUserErrors = {
  duplicateEmail: (): CreateUserError => ({ code: 'DUPLICATE_EMAIL' }),
  duplicateUsername: (): CreateUserError => ({ code: 'DUPLICATE_USERNAME' }),
  invalidInput: (message: string, field?: string): CreateUserError => ({
    code: 'INVALID_INPUT',
    message,
    field,
  }),
  rateLimited: (retryAfter: number): CreateUserError => ({
    code: 'RATE_LIMITED',
    retryAfter,
  }),
  serverError: (message: string): CreateUserError => ({
    code: 'SERVER_ERROR',
    message,
  }),
  networkError: (cause?: Error): CreateUserError => ({
    code: 'NETWORK_ERROR',
    cause,
  }),
};

export const GetUserErrors = {
  notFound: (): GetUserError => ({ code: 'NOT_FOUND' }),
  unauthorized: (): GetUserError => ({ code: 'UNAUTHORIZED' }),
  serverError: (message: string): GetUserError => ({
    code: 'SERVER_ERROR',
    message,
  }),
  networkError: (cause?: Error): GetUserError => ({
    code: 'NETWORK_ERROR',
    cause,
  }),
};
