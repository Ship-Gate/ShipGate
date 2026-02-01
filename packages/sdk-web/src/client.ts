// ============================================================================
// Web SDK Client
// ============================================================================

import type {
  RequestConfig,
  ApiResponse,
  AuthConfig,
  RetryConfig,
  CacheConfig,
  HttpMethod,
} from './types.js';
import { ApiError, DEFAULT_CONFIG } from './types.js';

/**
 * Cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * ISL Web Client
 * 
 * Type-safe API client for browser environments with:
 * - Automatic retries with exponential backoff
 * - Request/response interceptors
 * - Authentication handling
 * - Response caching
 * - Request deduplication
 * 
 * @example
 * ```typescript
 * const client = new ISLClient({
 *   baseUrl: 'https://api.example.com',
 *   auth: { type: 'bearer', token: () => getToken() },
 * });
 * 
 * const user = await client.get<User>('/users/123');
 * ```
 */
export class ISLClient {
  private config: Required<RequestConfig>;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private pendingRequests: Map<string, Promise<unknown>> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: Partial<RequestConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      headers: { ...DEFAULT_CONFIG.headers, ...config.headers },
      retry: { ...DEFAULT_CONFIG.retry, ...config.retry },
      auth: { ...DEFAULT_CONFIG.auth, ...config.auth },
      cache: { ...DEFAULT_CONFIG.cache, ...config.cache },
    };
  }

  /**
   * GET request
   */
  async get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path, params);
    return this.request<T>('GET', url);
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    return this.request<T>('POST', url, body);
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    return this.request<T>('PUT', url, body);
  }

  /**
   * PATCH request
   */
  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    return this.request<T>('PATCH', url, body);
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    return this.request<T>('DELETE', url);
  }

  /**
   * Cancel a pending request
   */
  cancel(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.pendingRequests.clear();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update configuration
   */
  configure(config: Partial<RequestConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      headers: { ...this.config.headers, ...config.headers },
    };
  }

  /**
   * Set auth token
   */
  setAuthToken(token: string): void {
    if (this.config.auth.type === 'bearer') {
      this.config.auth.token = token;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async request<T>(
    method: HttpMethod,
    url: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const requestId = `${method}:${url}:${JSON.stringify(body ?? '')}`;

    // Check cache for GET requests
    if (method === 'GET' && this.config.cache.enabled) {
      const cached = this.getFromCache<T>(requestId);
      if (cached) return cached;
    }

    // Deduplicate concurrent identical requests
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      return pending as Promise<ApiResponse<T>>;
    }

    const promise = this.executeRequest<T>(method, url, body, requestId);
    this.pendingRequests.set(requestId, promise);

    try {
      const result = await promise;

      // Cache GET responses
      if (method === 'GET' && this.config.cache.enabled) {
        this.setCache(requestId, result);
      }

      return result;
    } finally {
      this.pendingRequests.delete(requestId);
    }
  }

  private async executeRequest<T>(
    method: HttpMethod,
    url: string,
    body: unknown,
    requestId: string
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    let config: RequestInit & { url: string } = {
      url,
      method,
      headers: await this.buildHeaders(),
      signal: controller.signal,
    };

    if (body !== undefined && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    // Apply request interceptors
    for (const interceptor of this.config.interceptors.request ?? []) {
      config = await interceptor(config);
    }

    // Execute with retry
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.config.retry.maxAttempts) {
      try {
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        let response = await fetch(config.url, config);
        
        clearTimeout(timeoutId);

        // Apply response interceptors
        for (const interceptor of this.config.interceptors.response ?? []) {
          response = await interceptor(response, config);
        }

        if (!response.ok) {
          // Handle auth errors
          if (response.status === 401 && this.config.auth.onUnauthorized) {
            this.config.auth.onUnauthorized();
          }

          // Check if retryable
          if (this.config.retry.retryableStatusCodes.includes(response.status)) {
            throw new ApiError(
              response.status,
              response.statusText,
              await this.parseResponseBody(response),
              response.headers
            );
          }

          // Non-retryable error
          const errorBody = await this.parseResponseBody(response);
          throw new ApiError(response.status, response.statusText, errorBody, response.headers);
        }

        const data = await this.parseResponseBody(response) as T;

        this.abortControllers.delete(requestId);

        return {
          data,
          status: response.status,
          headers: response.headers,
          ok: true,
        };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof ApiError && !this.config.retry.retryableStatusCodes.includes(error.status)) {
          throw error;
        }

        if ((error as Error).name === 'AbortError') {
          throw new Error('Request was cancelled');
        }

        attempt++;
        if (attempt < this.config.retry.maxAttempts) {
          await this.delay(this.calculateDelay(attempt));
        }
      }
    }

    this.abortControllers.delete(requestId);
    throw lastError ?? new Error('Request failed');
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const headers = { ...this.config.headers };

    // Add auth header
    if (this.config.auth) {
      const authHeader = await this.getAuthHeader();
      if (authHeader) {
        Object.assign(headers, authHeader);
      }
    }

    return headers;
  }

  private async getAuthHeader(): Promise<Record<string, string> | null> {
    const auth = this.config.auth;

    switch (auth.type) {
      case 'bearer': {
        const token = typeof auth.token === 'function' ? await auth.token() : auth.token;
        return token ? { Authorization: `Bearer ${token}` } : null;
      }
      case 'api-key': {
        const header = auth.apiKeyHeader ?? 'X-API-Key';
        return auth.apiKey ? { [header]: auth.apiKey } : null;
      }
      case 'basic': {
        return auth.token ? { Authorization: `Basic ${auth.token}` } : null;
      }
      default:
        return null;
    }
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${base}${cleanPath}`;

    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    
    if (contentType?.includes('text/')) {
      return response.text();
    }

    return response.blob();
  }

  private calculateDelay(attempt: number): number {
    const { baseDelay, maxDelay, backoff } = this.config.retry;

    if (backoff === 'linear') {
      return Math.min(baseDelay * attempt, maxDelay);
    }

    // Exponential backoff with jitter
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = delay * 0.1 * Math.random();
    return delay + jitter;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getFromCache<T>(key: string): ApiResponse<T> | null {
    const entry = this.cache.get(key) as CacheEntry<ApiResponse<T>> | undefined;
    
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, value: ApiResponse<T>): void {
    // Enforce max size
    if (this.config.cache.maxSize && this.cache.size >= this.config.cache.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: this.config.cache.ttl,
    });
  }
}

/**
 * Create an ISL client instance
 */
export function createClient(config?: Partial<RequestConfig>): ISLClient {
  return new ISLClient(config);
}
