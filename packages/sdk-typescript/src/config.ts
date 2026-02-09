/**
 * ISL Configuration - Re-exported from the shared runtime engine.
 *
 * Platform-agnostic config types live in @isl-lang/generator-sdk/runtime.
 * This module provides backward-compatible aliases for sdk-typescript consumers.
 */

import type {
  ISLClientConfig as SharedClientConfig,
  RetryConfig as SharedRetryConfig,
  VerificationConfig as SharedVerificationConfig,
  AuthConfig,
} from '@isl-lang/generator-sdk/runtime';
import { DEFAULT_RETRY, DEFAULT_TIMEOUT } from '@isl-lang/generator-sdk/runtime';

export type { SharedVerificationConfig as VerificationConfig };

/**
 * Retry configuration (backward-compatible wrapper)
 */
export interface RetryConfig {
  readonly maxRetries?: number;
  readonly retryOnStatus?: readonly number[];
  readonly exponentialBase?: number;
  readonly initialDelay?: number;
  readonly maxDelay?: number;
}

/**
 * ISL Client configuration (extends shared config with legacy fields)
 */
export interface ISLClientConfig extends Omit<SharedClientConfig, 'retry' | 'auth'> {
  /** Authentication token (convenience shorthand for auth.token) */
  readonly authToken?: string;
  /** Retry configuration */
  readonly retry?: RetryConfig;
  /** Verification configuration */
  readonly verification?: SharedVerificationConfig;
}

/**
 * Default configuration values
 */
export const defaultConfig: Required<Omit<ISLClientConfig, 'authToken' | 'fetch' | 'interceptors' | 'headers'>> & {
  authToken: undefined;
  fetch: undefined;
  interceptors: undefined;
  headers: undefined;
} = {
  baseUrl: '',
  authToken: undefined,
  timeout: DEFAULT_TIMEOUT,
  fetch: undefined,
  interceptors: undefined,
  headers: undefined,
  cache: { enabled: false, ttl: 60_000, maxSize: 100 },
  retry: {
    maxRetries: DEFAULT_RETRY.maxAttempts,
    retryOnStatus: [...DEFAULT_RETRY.retryableStatusCodes],
    exponentialBase: 2,
    initialDelay: DEFAULT_RETRY.baseDelay,
    maxDelay: DEFAULT_RETRY.maxDelay,
  },
  verification: {
    enablePreconditions: true,
    enablePostconditions: true,
    throwOnViolation: true,
    logViolations: true,
  },
};
