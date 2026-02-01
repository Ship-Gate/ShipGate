// ============================================================================
// Request/Response Interceptors
// ============================================================================

import type { RequestInterceptor, ResponseInterceptor } from './types.js';

/**
 * Create a retry interceptor
 */
export function createRetryInterceptor(options: {
  maxRetries: number;
  retryDelay: number;
  retryableStatuses: number[];
}): ResponseInterceptor {
  return async (response, request) => {
    if (!options.retryableStatuses.includes(response.status)) {
      return response;
    }

    // Clone request for retry
    const retryRequest = { ...request };
    let lastResponse = response;

    for (let i = 0; i < options.maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, options.retryDelay * (i + 1)));
      
      const retryResponse = await fetch(retryRequest.url ?? '', retryRequest);
      lastResponse = retryResponse;

      if (!options.retryableStatuses.includes(retryResponse.status)) {
        return retryResponse;
      }
    }

    return lastResponse;
  };
}

/**
 * Create a logging interceptor
 */
export function createLoggingInterceptor(options?: {
  logRequest?: boolean;
  logResponse?: boolean;
  logErrors?: boolean;
}): { request: RequestInterceptor; response: ResponseInterceptor } {
  const opts = {
    logRequest: true,
    logResponse: true,
    logErrors: true,
    ...options,
  };

  return {
    request: async (config) => {
      if (opts.logRequest) {
        console.log(`[ISL SDK] ${config.method ?? 'GET'} ${config.url}`, {
          headers: config.headers,
          body: config.body,
        });
      }
      return config;
    },
    response: async (response, request) => {
      if (opts.logResponse) {
        const logLevel = response.ok ? 'log' : 'error';
        console[logLevel](`[ISL SDK] ${response.status} ${request.url ?? ''}`, {
          status: response.status,
          statusText: response.statusText,
        });
      }
      return response;
    },
  };
}

/**
 * Create an auth interceptor with token refresh
 */
export function createAuthInterceptor(options: {
  getToken: () => string | null;
  refreshToken: () => Promise<string>;
  onRefreshFailed: () => void;
}): { request: RequestInterceptor; response: ResponseInterceptor } {
  let isRefreshing = false;
  let refreshPromise: Promise<string> | null = null;

  return {
    request: async (config) => {
      const token = options.getToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return config;
    },
    response: async (response, request) => {
      if (response.status !== 401) {
        return response;
      }

      // Try to refresh token
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = options.refreshToken()
          .catch((error) => {
            options.onRefreshFailed();
            throw error;
          })
          .finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
      }

      try {
        const newToken = await refreshPromise;
        
        // Retry original request with new token
        const retryRequest = {
          ...request,
          headers: {
            ...request.headers,
            Authorization: `Bearer ${newToken}`,
          },
        };

        return fetch(retryRequest.url ?? '', retryRequest);
      } catch {
        return response;
      }
    },
  };
}

/**
 * Create a request timing interceptor
 */
export function createTimingInterceptor(onTiming: (url: string, duration: number) => void): {
  request: RequestInterceptor;
  response: ResponseInterceptor;
} {
  const timings = new Map<string, number>();

  return {
    request: async (config) => {
      const requestId = `${config.method}:${config.url}:${Date.now()}`;
      timings.set(requestId, performance.now());
      (config as { _requestId?: string })._requestId = requestId;
      return config;
    },
    response: async (response, request) => {
      const requestId = (request as { _requestId?: string })._requestId;
      if (requestId) {
        const startTime = timings.get(requestId);
        if (startTime) {
          const duration = performance.now() - startTime;
          timings.delete(requestId);
          onTiming(request.url ?? '', duration);
        }
      }
      return response;
    },
  };
}

/**
 * Create a cache interceptor
 */
export function createCacheInterceptor(options: {
  ttl: number;
  storage?: Storage;
}): { request: RequestInterceptor; response: ResponseInterceptor } {
  const cache = new Map<string, { data: Response; timestamp: number }>();
  const storage = options.storage;

  const getCacheKey = (url: string, method: string) => `isl_cache:${method}:${url}`;

  return {
    request: async (config) => {
      if (config.method !== 'GET') return config;

      const key = getCacheKey(config.url, config.method ?? 'GET');
      
      // Check memory cache
      const memCached = cache.get(key);
      if (memCached && Date.now() - memCached.timestamp < options.ttl) {
        return { ...config, _cached: memCached.data.clone() } as typeof config;
      }

      // Check storage cache
      if (storage) {
        const stored = storage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Date.now() - parsed.timestamp < options.ttl) {
            return config;
          }
        }
      }

      return config;
    },
    response: async (response, request) => {
      if (request.method !== 'GET' || !response.ok) return response;

      const key = getCacheKey(request.url ?? '', request.method ?? 'GET');
      
      // Store in memory cache
      cache.set(key, { data: response.clone(), timestamp: Date.now() });

      // Store in storage
      if (storage) {
        try {
          const body = await response.clone().text();
          storage.setItem(key, JSON.stringify({
            body,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            timestamp: Date.now(),
          }));
        } catch {
          // Storage full or unavailable
        }
      }

      return response;
    },
  };
}
