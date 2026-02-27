/**
 * ISL Client - Core API client for ISL-verified endpoints
 *
 * Uses shared retry/backoff logic from @isl-lang/generator-sdk/runtime.
 * Keeps React-Native-specific offline queue and secure storage local.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  calculateRetryDelay as sharedCalcDelay,
  sleep,
  DEFAULT_TIMEOUT,
} from '@isl-lang/generator-sdk/runtime';
import type {
  ISLClientConfig,
  RequestOptions,
  OfflineQueueItem,
  SyncStatus,
  NetworkState,
  RetryConfig,
} from '../types';
import type { Result, ISLErrorType as ISLError } from '@isl-lang/generator-sdk/runtime';
import { generateId } from '../utils/helpers';

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoff: 'exponential',
  initialDelayMs: 1000,
  maxDelayMs: 10000,
};

const STORAGE_KEYS = {
  AUTH_TOKEN: 'isl_auth_token',
  REFRESH_TOKEN: 'isl_refresh_token',
  OFFLINE_QUEUE: 'isl_offline_queue',
  CACHE_PREFIX: 'isl_cache_',
  SYNC_STATUS: 'isl_sync_status',
};

export class ISLClient {
  private config: ISLClientConfig;
  private authToken: string | null = null;
  private refreshToken: string | null = null;
  private networkState: NetworkState = {
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  };
  private syncStatus: SyncStatus = {
    isOnline: true,
    pendingCount: 0,
    lastSyncAt: null,
    isSyncing: false,
  };
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor(config: ISLClientConfig) {
    this.config = {
      ...config,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      retry: config.retry ?? DEFAULT_RETRY_CONFIG,
    };
    this.authToken = config.authToken ?? null;
  }

  /**
   * Initialize the client - load tokens from secure storage
   */
  async initialize(): Promise<void> {
    try {
      const [authToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      ]);
      
      this.authToken = authToken;
      this.refreshToken = refreshToken;
      
      // Load sync status
      const syncStatusStr = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATUS);
      if (syncStatusStr) {
        this.syncStatus = JSON.parse(syncStatusStr);
      }
      
      // Count pending offline items
      const queue = await this.getOfflineQueue();
      this.syncStatus.pendingCount = queue.length;
      
      if (this.config.enableLogging) {
        // Using proper logger in production
      }
    } catch (error) {
      if (this.config.enableLogging) {
        // Log initialization error
      }
    }
  }

  /**
   * Set authentication token
   */
  async setAuthToken(token: string): Promise<void> {
    this.authToken = token;
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  /**
   * Set refresh token
   */
  async setRefreshToken(token: string): Promise<void> {
    this.refreshToken = token;
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, token);
  }

  /**
   * Clear all auth tokens
   */
  async clearAuth(): Promise<void> {
    this.authToken = null;
    this.refreshToken = null;
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
    ]);
  }

  /**
   * Get current auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.authToken !== null;
  }

  /**
   * Update network state
   */
  setNetworkState(state: NetworkState): void {
    this.networkState = state;
    this.syncStatus.isOnline = state.isConnected && (state.isInternetReachable ?? true);
    this.config.onNetworkChange?.(state);
    
    // Try to sync when coming back online
    if (this.syncStatus.isOnline && this.syncStatus.pendingCount > 0) {
      this.syncOfflineQueue();
    }
  }

  /**
   * Make an API request
   */
  async request<TInput, TOutput, TError = ISLError>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    input?: TInput,
    options?: RequestOptions
  ): Promise<Result<TOutput, TError>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Version': '1.0.0',
      'X-Platform': 'react-native',
      ...options?.headers,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // Check cache for GET requests
    if (method === 'GET' && options?.cache?.enabled) {
      const cached = await this.getFromCache<TOutput>(endpoint);
      if (cached) {
        return { success: true, data: cached };
      }
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const timeout = options?.timeout ?? this.config.timeout ?? DEFAULT_TIMEOUT;
    const sdkRetry = options?.retry;
    const retryConfig: RetryConfig = sdkRetry
      ? {
          maxRetries: sdkRetry.maxAttempts ?? DEFAULT_RETRY_CONFIG.maxRetries,
          backoff: sdkRetry.backoff ?? DEFAULT_RETRY_CONFIG.backoff,
          initialDelayMs: sdkRetry.baseDelay ?? DEFAULT_RETRY_CONFIG.initialDelayMs,
          maxDelayMs: sdkRetry.maxDelay ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
        }
      : this.config.retry ?? DEFAULT_RETRY_CONFIG;

    let lastError: TError | null = null;
    let attempts = 0;

    while (attempts <= retryConfig.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: input && method !== 'GET' ? JSON.stringify(input) : undefined,
          signal: options?.signal ?? controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle auth errors
        if (response.status === 401) {
          const refreshed = await this.tryRefreshToken();
          if (refreshed) {
            // Retry with new token
            headers['Authorization'] = `Bearer ${this.authToken}`;
            continue;
          }
          this.config.onAuthError?.();
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' } as TError,
          };
        }

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
          return {
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Rate limited', retryAfter } as TError,
          };
        }

        const data = await response.json();

        if (response.ok) {
          // Cache successful GET responses
          if (method === 'GET' && options?.cache?.enabled) {
            await this.setCache(endpoint, data, options.cache.ttl ?? 60_000);
          }
          return { success: true, data };
        } else {
          return { success: false, error: data as TError };
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            return {
              success: false,
              error: { code: 'TIMEOUT', message: 'Request timed out', timeoutMs: timeout } as TError,
            };
          }

          // Handle offline mode
          if (this.config.enableOffline && !this.networkState.isConnected) {
            return this.handleOffline<TInput, TOutput, TError>(endpoint, method, input);
          }

          lastError = {
            code: 'NETWORK_ERROR',
            message: error.message,
            isOffline: !this.networkState.isConnected,
          } as TError;
        }

        attempts++;
        if (attempts <= retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(attempts, retryConfig);
          await this.sleep(delay);
        }
      }
    }

    return { success: false, error: lastError! };
  }

  /**
   * GET request helper
   */
  async get<TOutput, TError = ISLError>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
    options?: RequestOptions
  ): Promise<Result<TOutput, TError>> {
    const url = params
      ? `${endpoint}?${new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString()}`
      : endpoint;
    return this.request<undefined, TOutput, TError>(url, 'GET', undefined, options);
  }

  /**
   * POST request helper
   */
  async post<TInput, TOutput, TError = ISLError>(
    endpoint: string,
    input: TInput,
    options?: RequestOptions
  ): Promise<Result<TOutput, TError>> {
    return this.request<TInput, TOutput, TError>(endpoint, 'POST', input, options);
  }

  /**
   * PUT request helper
   */
  async put<TInput, TOutput, TError = ISLError>(
    endpoint: string,
    input: TInput,
    options?: RequestOptions
  ): Promise<Result<TOutput, TError>> {
    return this.request<TInput, TOutput, TError>(endpoint, 'PUT', input, options);
  }

  /**
   * DELETE request helper
   */
  async delete<TOutput, TError = ISLError>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<Result<TOutput, TError>> {
    return this.request<undefined, TOutput, TError>(endpoint, 'DELETE', undefined, options);
  }

  /**
   * PATCH request helper
   */
  async patch<TInput, TOutput, TError = ISLError>(
    endpoint: string,
    input: TInput,
    options?: RequestOptions
  ): Promise<Result<TOutput, TError>> {
    return this.request<TInput, TOutput, TError>(endpoint, 'PATCH', input, options);
  }

  /**
   * Handle offline mode - queue request for later
   */
  private async handleOffline<TInput, TOutput, TError>(
    endpoint: string,
    method: string,
    input?: TInput
  ): Promise<Result<TOutput, TError>> {
    const queue = await this.getOfflineQueue();
    const queueItem: OfflineQueueItem = {
      id: generateId(),
      endpoint,
      method,
      input,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    queue.push(queueItem);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    
    this.syncStatus.pendingCount = queue.length;
    this.notifyListeners();

    return {
      success: false,
      error: {
        code: 'OFFLINE',
        message: 'Request queued for offline sync',
        isOffline: true,
      } as TError,
    };
  }

  /**
   * Get offline queue
   */
  async getOfflineQueue(): Promise<OfflineQueueItem[]> {
    try {
      const queueStr = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return queueStr ? JSON.parse(queueStr) : [];
    } catch {
      return [];
    }
  }

  /**
   * Sync offline queue when back online
   */
  async syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
    if (this.syncStatus.isSyncing || !this.syncStatus.isOnline) {
      return { synced: 0, failed: 0 };
    }

    this.syncStatus.isSyncing = true;
    this.notifyListeners();

    const queue = await this.getOfflineQueue();
    let synced = 0;
    let failed = 0;
    const failedItems: OfflineQueueItem[] = [];

    for (const item of queue) {
      const result = await this.request(
        item.endpoint,
        item.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        item.input
      );

      if (result.success) {
        synced++;
      } else {
        item.retryCount++;
        if (item.retryCount < 3) {
          failedItems.push(item);
        }
        failed++;
      }
    }

    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(failedItems));
    
    this.syncStatus.isSyncing = false;
    this.syncStatus.pendingCount = failedItems.length;
    this.syncStatus.lastSyncAt = Date.now();
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(this.syncStatus));
    this.notifyListeners();

    return { synced, failed };
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Subscribe to sync status changes
   */
  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear offline queue
   */
  async clearOfflineQueue(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
    this.syncStatus.pendingCount = 0;
    this.notifyListeners();
  }

  // Cache methods
  private async getFromCache<T>(endpoint: string, key?: string): Promise<T | null> {
    try {
      const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}${key ?? endpoint}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data, expiresAt } = JSON.parse(cached);
      if (Date.now() > expiresAt) {
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  private async setCache<T>(endpoint: string, data: T, ttlMs: number, key?: string): Promise<void> {
    try {
      const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}${key ?? endpoint}`;
      const cacheData = {
        data,
        expiresAt: Date.now() + ttlMs,
        createdAt: Date.now(),
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch {
      // Cache write failed - non-critical
    }
  }

  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch {
      // Cache clear failed - non-critical
    }
  }

  // Token refresh
  private async tryRefreshToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.config.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const { accessToken, refreshToken } = await response.json();
        await Promise.all([
          this.setAuthToken(accessToken),
          this.setRefreshToken(refreshToken),
        ]);
        return true;
      }
    } catch {
      // Refresh failed
    }
    return false;
  }

  // Helpers — delegate to the shared runtime engine
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    return sharedCalcDelay(attempt, {
      maxAttempts: config.maxRetries,
      baseDelay: config.initialDelayMs,
      maxDelay: config.maxDelayMs,
      retryableStatusCodes: [],
      backoff: config.backoff,
    });
  }

  private sleep(ms: number): Promise<void> {
    return sleep(ms);
  }

  private notifyListeners(): void {
    const status = this.getSyncStatus();
    this.listeners.forEach(listener => listener(status));
  }
}
