/**
 * HTTP Client
 */

import type {
  Method,
  Headers,
  QueryParams,
  RequestOptions,
  RetryConfig,
  HTTPResponse,
  HTTPResult,
  HTTPError,
} from './types';

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  delay: 1000,
  backoffMultiplier: 2,
  retryOn: [408, 429, 500, 502, 503, 504],
};

/**
 * HTTP client with retry and timeout support
 */
export class HTTPClient {
  private baseUrl: string;
  private defaultHeaders: Headers;
  private defaultTimeout: number;
  private defaultRetry: RetryConfig;

  constructor(options: {
    baseUrl?: string;
    headers?: Headers;
    timeout?: number;
    retry?: RetryConfig;
  } = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultHeaders = options.headers || {};
    this.defaultTimeout = options.timeout || DEFAULT_TIMEOUT;
    this.defaultRetry = { ...DEFAULT_RETRY, ...options.retry };
  }

  /**
   * Make HTTP request
   */
  async fetch<T = unknown>(
    url: string,
    options: RequestOptions = {}
  ): Promise<HTTPResult<T>> {
    const fullUrl = this.buildUrl(url, options.query);
    const headers = { ...this.defaultHeaders, ...options.headers };
    const timeout = options.timeout || this.defaultTimeout;
    const retry = options.retry || this.defaultRetry;

    let lastError: HTTPError | null = null;

    for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
      try {
        const result = await this.doFetch<T>(fullUrl, {
          ...options,
          headers,
          timeout,
        });

        if (result.ok) {
          return result;
        }

        const error = result.error;
        lastError = error;

        // Check if we should retry
        if (
          attempt < retry.maxAttempts &&
          retry.retryOn?.includes(error.status)
        ) {
          const delay = retry.delay * Math.pow(retry.backoffMultiplier || 1, attempt - 1);
          await this.sleep(delay);
          continue;
        }

        return result;
      } catch (error) {
        lastError = new (HTTPError as any)(
          0,
          'NETWORK_ERROR',
          error instanceof Error ? error.message : 'Network error'
        );

        if (attempt < retry.maxAttempts) {
          const delay = retry.delay * Math.pow(retry.backoffMultiplier || 1, attempt - 1);
          await this.sleep(delay);
          continue;
        }
      }
    }

    return {
      ok: false,
      error: lastError || new (HTTPError as any)(0, 'UNKNOWN', 'Unknown error'),
    };
  }

  /**
   * GET request
   */
  async get<T = unknown>(
    url: string,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
  ): Promise<HTTPResult<T>> {
    return this.fetch<T>(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    url: string,
    body?: unknown,
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<HTTPResult<T>> {
    return this.fetch<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    url: string,
    body?: unknown,
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<HTTPResult<T>> {
    return this.fetch<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    url: string,
    body?: unknown,
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<HTTPResult<T>> {
    return this.fetch<T>(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    url: string,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
  ): Promise<HTTPResult<T>> {
    return this.fetch<T>(url, { ...options, method: 'DELETE' });
  }

  // Private methods

  private async doFetch<T>(
    url: string,
    options: RequestOptions & { timeout: number }
  ): Promise<HTTPResult<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    const start = Date.now();

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers as HeadersInit,
        body: options.body,
        signal: options.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      const headers: Headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      let body: T;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        body = await response.json();
      } else {
        body = (await response.text()) as unknown as T;
      }

      const httpResponse: HTTPResponse<T> = {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        url: response.url,
        redirected: response.redirected,
        timing: {
          total: Date.now() - start,
        },
      };

      if (!response.ok) {
        return {
          ok: false,
          error: new (HTTPError as any)(
            response.status,
            `HTTP_${response.status}`,
            response.statusText,
            body
          ),
        };
      }

      return {
        ok: true,
        data: httpResponse,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          ok: false,
          error: new (HTTPError as any)(0, 'TIMEOUT', 'Request timed out'),
        };
      }

      throw error;
    }
  }

  private buildUrl(url: string, query?: QueryParams): string {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

    if (!query || Object.keys(query).length === 0) {
      return fullUrl;
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else {
        params.append(key, value);
      }
    }

    const separator = fullUrl.includes('?') ? '&' : '?';
    return `${fullUrl}${separator}${params.toString()}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create HTTP client
 */
export function createClient(options?: {
  baseUrl?: string;
  headers?: Headers;
  timeout?: number;
  retry?: RetryConfig;
}): HTTPClient {
  return new HTTPClient(options);
}

// Default client instance
export const http = createClient();
