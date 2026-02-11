// ============================================================================
// ISL Standard Library - API Client Public API
// @isl-lang/stdlib-api
// ============================================================================

// Core types
export type {
  HttpMethod,
  RequestConfig,
  ApiResponse,
  Middleware,
  MiddlewareContext,
  NextFn,
  ClientConfig,
} from './types.js';

// Errors
export type { ApiError, ApiErrorKind } from './errors.js';
export {
  networkError,
  timeoutError,
  abortError,
  httpError,
  parseError,
  graphqlError,
  unknownError,
  isRetryableStatus,
} from './errors.js';

// Interceptor chain
export { buildChain } from './interceptors.js';

// REST client
export { createRestClient } from './rest/builder.js';
export type { RestClient, RestClientBuilder, RestRequestParams } from './rest/types.js';
export { resolvePathParams, buildQueryString, parseHeaders, executeFetch } from './rest/methods.js';

// GraphQL client
export { createGraphQLClient } from './graphql/builder.js';
export { parseGraphQLResponse } from './graphql/client.js';
export type {
  GraphQLClient,
  GraphQLClientBuilder,
  GraphQLRequestOptions,
  GraphQLErrorItem,
  GraphQLResponse,
} from './graphql/types.js';

// Middleware
export { authMiddleware } from './middleware/auth.js';
export type { AuthOptions } from './middleware/auth.js';

export { retryMiddleware, computeDelay, parseRetryAfter } from './middleware/retry.js';
export type { RetryOptions } from './middleware/retry.js';

export { timeoutMiddleware } from './middleware/timeout.js';
export type { TimeoutOptions } from './middleware/timeout.js';

export { loggingMiddleware } from './middleware/logging.js';
export type { LogEntry, LoggingOptions } from './middleware/logging.js';

export { cacheMiddleware, createMemoryCacheStore } from './middleware/cache.js';
export type { CacheOptions, CacheStore, CacheEntry } from './middleware/cache.js';
