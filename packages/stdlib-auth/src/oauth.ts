/**
 * OAuth 2.0 / Social Login
 */

import type { OAuthConnection, OAuthProvider, AuthResult } from './types';

export interface OAuthStore {
  createConnection(connection: Omit<OAuthConnection, 'id' | 'connectedAt'>): Promise<OAuthConnection>;
  findConnection(id: string): Promise<OAuthConnection | null>;
  findByProvider(userId: string, provider: OAuthProvider): Promise<OAuthConnection | null>;
  findByProviderUserId(provider: OAuthProvider, providerUserId: string): Promise<OAuthConnection | null>;
  findUserConnections(userId: string): Promise<OAuthConnection[]>;
  updateConnection(id: string, updates: Partial<OAuthConnection>): Promise<OAuthConnection>;
  deleteConnection(id: string): Promise<void>;
}

export interface OAuthProviderConfig {
  provider: OAuthProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

// Provider configurations
const PROVIDER_CONFIGS: Record<OAuthProvider, Omit<OAuthProviderConfig, 'clientId' | 'clientSecret' | 'redirectUri' | 'scopes'>> = {
  google: {
    provider: 'google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
  },
  github: {
    provider: 'github',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
  },
  apple: {
    provider: 'apple',
    authorizationUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    userInfoUrl: '', // Apple uses ID token
  },
  microsoft: {
    provider: 'microsoft',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
  },
  facebook: {
    provider: 'facebook',
    authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/v18.0/me',
  },
  twitter: {
    provider: 'twitter',
    authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
  },
  linkedin: {
    provider: 'linkedin',
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
  },
  discord: {
    provider: 'discord',
    authorizationUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
  },
  slack: {
    provider: 'slack',
    authorizationUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    userInfoUrl: 'https://slack.com/api/users.identity',
  },
};

export interface OAuthUserInfo {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  raw: Record<string, unknown>;
}

export class OAuthService {
  private configs = new Map<OAuthProvider, OAuthProviderConfig>();

  constructor(private store: OAuthStore) {}

  /**
   * Configure OAuth provider
   */
  configureProvider(
    provider: OAuthProvider,
    config: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      scopes?: string[];
    }
  ): void {
    const baseConfig = PROVIDER_CONFIGS[provider];
    this.configs.set(provider, {
      ...baseConfig,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      scopes: config.scopes || this.getDefaultScopes(provider),
    });
  }

  /**
   * Get authorization URL
   */
  getAuthorizationUrl(
    provider: OAuthProvider,
    state: string,
    additionalParams?: Record<string, string>
  ): AuthResult<string> {
    const config = this.configs.get(provider);
    if (!config) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_NOT_CONFIGURED',
          message: `Provider ${provider} is not configured`,
        },
      };
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      ...additionalParams,
    });

    return {
      ok: true,
      data: `${config.authorizationUrl}?${params.toString()}`,
    };
  }

  /**
   * Exchange code for tokens
   */
  async exchangeCode(
    provider: OAuthProvider,
    code: string
  ): Promise<AuthResult<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType: string;
  }>> {
    const config = this.configs.get(provider);
    if (!config) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_NOT_CONFIGURED',
          message: `Provider ${provider} is not configured`,
        },
      };
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
          code,
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: {
            code: 'TOKEN_EXCHANGE_FAILED',
            message: 'Failed to exchange authorization code',
          },
        };
      }

      const data = await response.json();

      return {
        ok: true,
        data: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          tokenType: data.token_type || 'Bearer',
        },
      };
    } catch {
      return {
        ok: false,
        error: {
          code: 'TOKEN_EXCHANGE_FAILED',
          message: 'Network error during token exchange',
        },
      };
    }
  }

  /**
   * Get user info from provider
   */
  async getUserInfo(
    provider: OAuthProvider,
    accessToken: string
  ): Promise<AuthResult<OAuthUserInfo>> {
    const config = this.configs.get(provider);
    if (!config) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_NOT_CONFIGURED',
          message: `Provider ${provider} is not configured`,
        },
      };
    }

    try {
      const response = await fetch(config.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return {
          ok: false,
          error: {
            code: 'USER_INFO_FAILED',
            message: 'Failed to fetch user info',
          },
        };
      }

      const data = await response.json();
      const userInfo = this.normalizeUserInfo(provider, data);

      return { ok: true, data: userInfo };
    } catch {
      return {
        ok: false,
        error: {
          code: 'USER_INFO_FAILED',
          message: 'Network error fetching user info',
        },
      };
    }
  }

  /**
   * Connect OAuth account to user
   */
  async connect(
    userId: string,
    provider: OAuthProvider,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): Promise<AuthResult<OAuthConnection>> {
    // Get user info
    const userInfoResult = await this.getUserInfo(provider, accessToken);
    if (!userInfoResult.ok) {
      return userInfoResult;
    }

    const userInfo = userInfoResult.data;

    // Check if already connected
    const existing = await this.store.findByProviderUserId(provider, userInfo.id);
    if (existing && existing.userId !== userId) {
      return {
        ok: false,
        error: {
          code: 'ALREADY_CONNECTED',
          message: 'This account is already connected to another user',
        },
      };
    }

    if (existing) {
      // Update existing connection
      const updated = await this.store.updateConnection(existing.id, {
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
        lastUsedAt: new Date(),
      });
      return { ok: true, data: updated };
    }

    // Create new connection
    const connection = await this.store.createConnection({
      userId,
      provider,
      providerUserId: userInfo.id,
      accessToken,
      refreshToken,
      tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.avatarUrl,
      lastUsedAt: new Date(),
    });

    return { ok: true, data: connection };
  }

  /**
   * Disconnect OAuth account
   */
  async disconnect(connectionId: string): Promise<AuthResult<void>> {
    const connection = await this.store.findConnection(connectionId);
    if (!connection) {
      return {
        ok: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'OAuth connection not found',
        },
      };
    }

    await this.store.deleteConnection(connectionId);
    return { ok: true, data: undefined };
  }

  /**
   * Get user's connected accounts
   */
  async getUserConnections(userId: string): Promise<OAuthConnection[]> {
    return this.store.findUserConnections(userId);
  }

  // Private methods

  private getDefaultScopes(provider: OAuthProvider): string[] {
    switch (provider) {
      case 'google':
        return ['openid', 'email', 'profile'];
      case 'github':
        return ['read:user', 'user:email'];
      case 'microsoft':
        return ['openid', 'email', 'profile', 'User.Read'];
      case 'facebook':
        return ['email', 'public_profile'];
      case 'discord':
        return ['identify', 'email'];
      case 'slack':
        return ['openid', 'email', 'profile'];
      default:
        return ['openid', 'email'];
    }
  }

  private normalizeUserInfo(provider: OAuthProvider, data: Record<string, unknown>): OAuthUserInfo {
    switch (provider) {
      case 'google':
        return {
          id: data.sub as string,
          email: data.email as string,
          name: data.name as string,
          avatarUrl: data.picture as string,
          raw: data,
        };
      case 'github':
        return {
          id: String(data.id),
          email: data.email as string,
          name: data.name as string || data.login as string,
          avatarUrl: data.avatar_url as string,
          raw: data,
        };
      case 'microsoft':
        return {
          id: data.id as string,
          email: data.mail as string || data.userPrincipalName as string,
          name: data.displayName as string,
          avatarUrl: undefined,
          raw: data,
        };
      case 'discord':
        return {
          id: data.id as string,
          email: data.email as string,
          name: data.username as string,
          avatarUrl: data.avatar
            ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
            : undefined,
          raw: data,
        };
      default:
        return {
          id: String(data.id || data.sub),
          email: data.email as string,
          name: data.name as string,
          avatarUrl: data.picture as string || data.avatar_url as string,
          raw: data,
        };
    }
  }
}

/**
 * Create OAuth service
 */
export function createOAuthService(store: OAuthStore): OAuthService {
  return new OAuthService(store);
}
