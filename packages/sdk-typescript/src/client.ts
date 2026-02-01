/**
 * ISL Client - Main client implementation.
 */

import type { ISLClientConfig } from './config';
import { defaultConfig } from './config';
import { UserService } from './services/user-service';

/**
 * ISL Client for type-safe API access
 */
export class ISLClient {
  private readonly config: Required<ISLClientConfig>;
  private readonly _users: UserService;

  constructor(config: ISLClientConfig) {
    this.config = {
      ...defaultConfig,
      ...config,
      retry: { ...defaultConfig.retry, ...config.retry },
      verification: { ...defaultConfig.verification, ...config.verification },
    };

    this._users = new UserService(this.config);
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
    return this.config.baseUrl;
  }
}

/**
 * Create ISL client
 */
export function createISLClient(config: ISLClientConfig): ISLClient {
  return new ISLClient(config);
}
