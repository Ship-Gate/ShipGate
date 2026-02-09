// ============================================================================
// Web SDK Client — Thin skin over @isl-lang/generator-sdk/runtime
// ============================================================================

import { BaseClient } from '@isl-lang/generator-sdk/runtime';
import type { ApiResponse } from '@isl-lang/generator-sdk/runtime';
import type { RequestConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

/**
 * ISL Web Client
 *
 * Browser-specific API client that extends the shared BaseClient.
 * All retry, auth, caching, and deduplication logic lives in the
 * shared engine — this skin adds only web-specific convenience.
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
export class ISLClient extends BaseClient {
  private _webConfig: Required<RequestConfig>;

  constructor(config: Partial<RequestConfig> = {}) {
    const merged: Required<RequestConfig> = {
      ...DEFAULT_CONFIG,
      ...config,
      headers: { ...DEFAULT_CONFIG.headers, ...config.headers },
      retry: { ...DEFAULT_CONFIG.retry, ...config.retry },
      auth: { ...DEFAULT_CONFIG.auth, ...config.auth },
      cache: { ...DEFAULT_CONFIG.cache, ...config.cache },
    };

    // Delegate to shared BaseClient
    super({
      baseUrl: merged.baseUrl,
      timeout: merged.timeout,
      headers: merged.headers,
      auth: merged.auth,
      retry: merged.retry,
      cache: {
        enabled: merged.cache.enabled,
        ttl: merged.cache.ttl,
        maxSize: merged.cache.maxSize,
      },
      interceptors: merged.interceptors,
    });

    this._webConfig = merged;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<RequestConfig>): void {
    this._webConfig = {
      ...this._webConfig,
      ...config,
      headers: { ...this._webConfig.headers, ...config.headers },
    };
    // Sync the shared headers
    if (config.headers) {
      for (const [k, v] of Object.entries(config.headers)) {
        this.setHeader(k, v);
      }
    }
  }

  /**
   * Set auth token (convenience for bearer auth)
   */
  setAuthToken(token: string): void {
    if (this._webConfig.auth.type === 'bearer') {
      this._webConfig.auth.token = token;
    }
  }
}

/**
 * Create an ISL client instance
 */
export function createClient(config?: Partial<RequestConfig>): ISLClient {
  return new ISLClient(config);
}
