/**
 * ISL Client - Thin skin over the shared runtime BaseClient.
 *
 * Platform-agnostic HTTP logic (retry, auth, caching) lives in
 * @isl-lang/generator-sdk/runtime. This module adds the sdk-typescript
 * convenience layer (UserService, legacy config shape).
 */

import { BaseClient } from '@isl-lang/generator-sdk/runtime';
import type { ISLClientConfig } from './config';
import { defaultConfig } from './config';
import { UserService } from './services/user-service';

/**
 * ISL Client for type-safe API access.
 *
 * Extends the shared BaseClient so retry, auth, and caching are
 * implemented exactly once across all SDK targets.
 */
export class ISLClient extends BaseClient {
  private readonly _resolvedConfig: ISLClientConfig;
  private readonly _users: UserService;

  constructor(config: ISLClientConfig) {
    const merged = {
      ...defaultConfig,
      ...config,
      retry: { ...defaultConfig.retry, ...config.retry },
      verification: { ...defaultConfig.verification, ...config.verification },
    };

    // Translate sdk-typescript config shape → shared ISLClientConfig
    super({
      baseUrl: merged.baseUrl,
      timeout: merged.timeout,
      fetch: merged.fetch,
      headers: merged.headers,
      auth: merged.authToken
        ? { type: 'bearer' as const, token: merged.authToken }
        : undefined,
      retry: {
        maxAttempts: merged.retry.maxRetries ?? 3,
        baseDelay: merged.retry.initialDelay ?? 1000,
        maxDelay: merged.retry.maxDelay ?? 30000,
        retryableStatusCodes: [...(merged.retry.retryOnStatus ?? [429, 500, 502, 503, 504])],
        backoff: 'exponential' as const,
      },
      cache: merged.cache,
    });

    this._resolvedConfig = merged as ISLClientConfig;
    this._users = new UserService(this._resolvedConfig);
  }

  /**
   * User service for user operations
   */
  get users(): UserService {
    return this._users;
  }

  /**
   * Create a simple client
   */
  static simple(baseUrl: string, authToken?: string): ISLClient {
    return new ISLClient({ baseUrl, authToken });
  }

  /**
   * Get the base URL
   */
  get baseUrl(): string {
    return this._resolvedConfig.baseUrl;
  }
}

/**
 * Create ISL client
 */
export function createISLClient(config: ISLClientConfig): ISLClient {
  return new ISLClient(config);
}
