// ============================================================================
// Web SDK - Public API
// ============================================================================

/**
 * @packageDocumentation
 * 
 * Browser SDK for ISL-verified APIs.
 * 
 * Features:
 * - Type-safe API client
 * - Automatic retries with backoff
 * - Request/response interceptors
 * - Authentication handling
 * - Response caching
 * - React hooks generation
 * 
 * @example
 * ```typescript
 * import { createClient } from '@isl-lang/sdk-web';
 * 
 * const client = createClient({
 *   baseUrl: 'https://api.example.com',
 *   auth: { type: 'bearer', token: () => localStorage.getItem('token') },
 * });
 * 
 * const { data } = await client.get<User>('/users/me');
 * ```
 */

// Client
export { ISLClient, createClient } from './client.js';

// Types
export type {
  HttpMethod,
  RequestConfig,
  RetryConfig,
  AuthConfig,
  CacheConfig,
  Interceptors,
  RequestInterceptor,
  ResponseInterceptor,
  ApiResponse,
  ValidationError,
  Domain,
  Behavior,
  Entity,
} from './types.js';

export { ApiError, DEFAULT_CONFIG } from './types.js';

// Generator
export { generateSDK } from './generator.js';

// React Hooks
export { generateReactHooks, generateUtilityHooks } from './hooks.js';

// Utilities
export { createRetryInterceptor, createLoggingInterceptor, createAuthInterceptor } from './interceptors.js';
