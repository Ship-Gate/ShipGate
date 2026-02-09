/**
 * Shared Auth Hooks
 *
 * Canonical authentication logic shared across all SDK targets.
 * Handles bearer, API-key, basic, and OAuth2 token resolution,
 * plus automatic token refresh with request-coalescing.
 */

import type {
  AuthConfig,
  RequestInitWithUrl,
  RequestInterceptor,
  ResponseInterceptor,
} from './types.js';

// ============================================================================
// Token Resolution
// ============================================================================

/**
 * Resolve the current auth header from an AuthConfig.
 */
export async function resolveAuthHeader(
  auth: AuthConfig,
): Promise<Record<string, string> | null> {
  switch (auth.type) {
    case 'bearer': {
      const token =
        typeof auth.token === 'function' ? await auth.token() : auth.token;
      return token ? { Authorization: `Bearer ${token}` } : null;
    }
    case 'api-key': {
      const header = auth.apiKeyHeader ?? 'X-API-Key';
      return auth.apiKey ? { [header]: auth.apiKey } : null;
    }
    case 'basic': {
      const token =
        typeof auth.token === 'function' ? await auth.token() : auth.token;
      return token ? { Authorization: `Basic ${token}` } : null;
    }
    case 'oauth2': {
      const token =
        typeof auth.token === 'function' ? await auth.token() : auth.token;
      return token ? { Authorization: `Bearer ${token}` } : null;
    }
    default:
      return null;
  }
}

// ============================================================================
// Auth Interceptor (request-level)
// ============================================================================

/**
 * Creates a pair of interceptors that:
 * 1. Attach auth headers on every request.
 * 2. On 401, attempt a single token-refresh and retry the original request.
 *    Concurrent 401s are coalesced into one refresh call.
 */
export function createAuthInterceptors(auth: AuthConfig): {
  request: RequestInterceptor;
  response: ResponseInterceptor;
} {
  let isRefreshing = false;
  let refreshPromise: Promise<string> | null = null;

  const request: RequestInterceptor = async (config) => {
    const header = await resolveAuthHeader(auth);
    if (header) {
      config.headers = { ...(config.headers as Record<string, string>), ...header };
    }
    return config;
  };

  const response: ResponseInterceptor = async (res, req) => {
    if (res.status !== 401 || !auth.refreshToken) {
      if (res.status === 401) auth.onUnauthorized?.();
      return res;
    }

    // Coalesce concurrent refresh calls
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = auth
        .refreshToken()
        .catch((err) => {
          auth.onUnauthorized?.();
          throw err;
        })
        .finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
    }

    try {
      const newToken = await refreshPromise;
      // Retry the original request with the new token
      const retryReq: RequestInitWithUrl = {
        ...req,
        headers: {
          ...((req.headers as Record<string, string>) ?? {}),
          Authorization: `Bearer ${newToken}`,
        },
      };
      return fetch(retryReq.url, retryReq);
    } catch {
      return res;
    }
  };

  return { request, response };
}

// ============================================================================
// Simple Helpers
// ============================================================================

/**
 * Lightweight check: does the config have credentials that could
 * produce an auth header?
 */
export function hasAuthCredentials(auth?: AuthConfig): boolean {
  if (!auth) return false;
  switch (auth.type) {
    case 'bearer':
    case 'basic':
    case 'oauth2':
      return auth.token != null;
    case 'api-key':
      return auth.apiKey != null;
    default:
      return false;
  }
}
