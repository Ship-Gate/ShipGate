/**
 * Shared Base Client
 *
 * Canonical HTTP client engine shared across all SDK targets.
 * Each platform skin extends or wraps this with platform-specific concerns
 * (e.g. React Native offline queue, browser cache storage).
 */

import type {
  ISLClientConfig,
  HttpMethod,
  ApiResponse,
  RetryConfig,
  CacheConfig,
  RequestInitWithUrl,
  RequestInterceptor,
  ResponseInterceptor,
  RequestOptions,
} from './types.js';
import {
  DEFAULT_RETRY,
  DEFAULT_CACHE,
  DEFAULT_HEADERS,
  DEFAULT_TIMEOUT,
} from './types.js';
import { resolveAuthHeader } from './auth.js';
import { calculateRetryDelay, isRetryableStatus, sleep } from './retry.js';
import { ApiError, NetworkError, errorFromStatus } from './errors.js';

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// Resolved Config (internal)
// ============================================================================

interface ResolvedConfig {
  baseUrl: string;
  timeout: number;
  headers: Record<string, string>;
  retry: RetryConfig;
  cache: CacheConfig;
  requestInterceptors: RequestInterceptor[];
  responseInterceptors: ResponseInterceptor[];
  fetchImpl: typeof globalThis.fetch;
  auth: ISLClientConfig['auth'];
  verification: ISLClientConfig['verification'];
}

// ============================================================================
// Base Client
// ============================================================================

export class BaseClient {
  protected readonly _config: ResolvedConfig;
  private _cache = new Map<string, CacheEntry<unknown>>();
  private _pending = new Map<string, Promise<unknown>>();
  private _abortControllers = new Map<string, AbortController>();

  constructor(config: ISLClientConfig) {
    this._config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      headers: { ...DEFAULT_HEADERS, ...config.headers },
      retry: { ...DEFAULT_RETRY, ...config.retry } as RetryConfig,
      cache: { ...DEFAULT_CACHE, ...config.cache } as CacheConfig,
      requestInterceptors: [...(config.interceptors?.request ?? [])],
      responseInterceptors: [...(config.interceptors?.response ?? [])],
      fetchImpl: config.fetch ?? globalThis.fetch.bind(globalThis),
      auth: config.auth,
      verification: config.verification,
    };
  }

  // ==========================================================================
  // Public HTTP Methods
  // ==========================================================================

  async get<T>(path: string, params?: Record<string, string>, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return this._request<T>('GET', this._buildUrl(path, params), undefined, opts);
  }

  async post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return this._request<T>('POST', this._buildUrl(path), body, opts);
  }

  async put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return this._request<T>('PUT', this._buildUrl(path), body, opts);
  }

  async patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return this._request<T>('PATCH', this._buildUrl(path), body, opts);
  }

  async delete<T>(path: string, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return this._request<T>('DELETE', this._buildUrl(path), undefined, opts);
  }

  // ==========================================================================
  // Request Lifecycle
  // ==========================================================================

  cancel(requestId: string): void {
    this._abortControllers.get(requestId)?.abort();
    this._abortControllers.delete(requestId);
  }

  cancelAll(): void {
    for (const c of this._abortControllers.values()) c.abort();
    this._abortControllers.clear();
    this._pending.clear();
  }

  clearCache(): void {
    this._cache.clear();
  }

  setHeader(name: string, value: string): void {
    this._config.headers[name] = value;
  }

  // ==========================================================================
  // Internal Request Pipeline
  // ==========================================================================

  private async _request<T>(
    method: HttpMethod,
    url: string,
    body?: unknown,
    opts?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const requestId = `${method}:${url}:${JSON.stringify(body ?? '')}`;

    // --- Cache hit (GET only) ---
    if (method === 'GET' && this._config.cache.enabled) {
      const cached = this._fromCache<ApiResponse<T>>(requestId);
      if (cached) return cached;
    }

    // --- Dedup concurrent identical requests ---
    const pending = this._pending.get(requestId);
    if (pending) return pending as Promise<ApiResponse<T>>;

    const promise = this._execute<T>(method, url, body, requestId, opts);
    this._pending.set(requestId, promise);

    try {
      const result = await promise;
      if (method === 'GET' && this._config.cache.enabled) {
        this._toCache(requestId, result);
      }
      return result;
    } finally {
      this._pending.delete(requestId);
    }
  }

  private async _execute<T>(
    method: HttpMethod,
    url: string,
    body: unknown,
    requestId: string,
    opts?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    this._abortControllers.set(requestId, controller);

    const retryConfig: RetryConfig = {
      ...this._config.retry,
      ...opts?.retry,
    } as RetryConfig;
    const timeout = opts?.timeout ?? this._config.timeout;

    // Build initial request config
    let config: RequestInitWithUrl = {
      url,
      method,
      headers: await this._buildHeaders(opts?.headers),
      signal: opts?.signal ?? controller.signal,
      body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
    };

    // Apply request interceptors
    for (const interceptor of this._config.requestInterceptors) {
      config = await interceptor(config);
    }

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < retryConfig.maxAttempts) {
      attempt++;
      try {
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        let response = await this._config.fetchImpl(config.url, config);
        clearTimeout(timeoutId);

        // Apply response interceptors
        for (const interceptor of this._config.responseInterceptors) {
          response = await interceptor(response, config);
        }

        if (!response.ok) {
          // Handle 401
          if (response.status === 401 && this._config.auth?.onUnauthorized) {
            this._config.auth.onUnauthorized();
          }

          const errorBody = await this._parseBody(response);

          if (isRetryableStatus(response.status, retryConfig) && attempt < retryConfig.maxAttempts) {
            lastError = new ApiError(response.status, response.statusText, errorBody, response.headers);
            await sleep(calculateRetryDelay(attempt, retryConfig));
            continue;
          }

          this._abortControllers.delete(requestId);
          throw errorFromStatus(response.status, errorBody, response.headers);
        }

        const data = (await this._parseBody(response)) as T;
        this._abortControllers.delete(requestId);

        return { data, status: response.status, headers: response.headers, ok: true };
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          this._abortControllers.delete(requestId);
          throw new NetworkError('Request was cancelled or timed out', error as Error, true);
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        // If it's a non-retryable ISL error, throw immediately
        if (error instanceof ApiError && !isRetryableStatus(error.status, retryConfig)) {
          throw error;
        }

        if (attempt < retryConfig.maxAttempts) {
          await sleep(calculateRetryDelay(attempt, retryConfig));
        }
      }
    }

    this._abortControllers.delete(requestId);
    throw lastError ?? new NetworkError('Request failed after retries');
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async _buildHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
    const headers = { ...this._config.headers, ...extra };
    if (this._config.auth) {
      const authHeader = await resolveAuthHeader(this._config.auth);
      if (authHeader) Object.assign(headers, authHeader);
    }
    return headers;
  }

  protected _buildUrl(path: string, params?: Record<string, string>): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${this._config.baseUrl}${cleanPath}`;
    if (params && Object.keys(params).length > 0) {
      url += `?${new URLSearchParams(params).toString()}`;
    }
    return url;
  }

  private async _parseBody(response: Response): Promise<unknown> {
    const ct = response.headers.get('content-type');
    if (ct?.includes('application/json')) return response.json();
    if (ct?.includes('text/')) return response.text();
    return response.blob();
  }

  private _fromCache<T>(key: string): T | null {
    const entry = this._cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this._cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private _toCache<T>(key: string, value: T): void {
    if (this._config.cache.maxSize && this._cache.size >= this._config.cache.maxSize) {
      const oldest = this._cache.keys().next().value;
      if (oldest) this._cache.delete(oldest);
    }
    this._cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: this._config.cache.ttl,
    });
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createBaseClient(config: ISLClientConfig): BaseClient {
  return new BaseClient(config);
}
