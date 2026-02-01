/**
 * @isl-lang/sdk-react-native
 * 
 * React Native SDK for ISL-verified APIs
 * Provides hooks, offline support, and full TypeScript integration
 */

// Client exports
export { ISLClient } from './client/ISLClient';
export { ApiClient, createApi, endpoints } from './client/ApiClient';
export { WebSocketClient } from './client/WebSocketClient';
export type { ISLClientConfig } from './types';
export type { ApiEndpoint, ApiClientConfig } from './client/ApiClient';
export type { WebSocketClientConfig } from './client/WebSocketClient';

// Provider exports
export { ISLProvider, ISLContext, withISLProvider } from './providers/ISLProvider';
export type { ISLProviderProps, ISLContextValue } from './providers/ISLProvider';

// Hook exports
export {
  useISLClient,
  useAuth,
  useSyncStatus,
  useNetworkState,
} from './hooks/useISLClient';

export {
  useQuery,
  prefetchQuery,
  invalidateQueries,
  getQueryData,
  setQueryData,
} from './hooks/useQuery';

export { useMutation, createValidatedMutation } from './hooks/useMutation';

export { useSubscription, usePresence } from './hooks/useSubscription';

// Validation exports
export {
  createValidator,
  combineValidators,
  conditionalValidator,
  validateObject,
  Schemas,
  Validators,
} from './validation/validators';

// Storage exports
export {
  SecureStorage,
  TokenStorage,
  CacheStorage,
  PreferencesStorage,
} from './storage/secureStorage';

// Type exports
export type {
  Result,
  ValidationResult,
  ValidationError,
  RequestOptions,
  RetryConfig,
  CacheConfig,
  OfflineQueueItem,
  SyncStatus,
  NetworkState,
  QueryState,
  MutationState,
  SubscriptionState,
  QueryOptions,
  MutationOptions,
  SubscriptionOptions,
  WSMessage,
  ApiError,
  NetworkError,
  TimeoutError,
  ValidationApiError,
  AuthError,
  RateLimitError,
  ISLError,
} from './types';

// Generated type exports
export * from './generated';

// Utility exports
export { generateId, deepClone, deepEqual, debounce, throttle, retry } from './utils/helpers';
