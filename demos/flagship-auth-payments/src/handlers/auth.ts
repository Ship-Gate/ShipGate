/**
 * OAuth Authentication Handlers
 * Implements the behavioral contracts from spec/auth.isl
 */

import { v4 as uuid } from 'uuid';
import {
  type User,
  type Session,
  type ApiResponse,
  OAuthProvider,
  UserStatus,
  SessionStatus,
} from '../types.js';
import { users, sessions, logAuditEvent } from '../store.js';

// ============================================
// Mock OAuth Provider Responses
// ============================================

interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

async function exchangeOAuthCode(
  provider: OAuthProvider,
  code: string
): Promise<OAuthUserInfo | null> {
  // Mock OAuth exchange - in production this would call the provider's API
  // Simulate invalid codes
  if (code === 'invalid_code' || code.length < 10) {
    return null;
  }

  // Mock successful responses
  const mockUsers: Record<string, OAuthUserInfo> = {
    google_alice: {
      id: 'google_123',
      email: 'alice@example.com',
      name: 'Alice Smith',
      avatar_url: 'https://example.com/alice.jpg',
    },
    github_bob: {
      id: 'github_456',
      email: 'bob@github.com',
      name: 'Bob Developer',
    },
    default: {
      id: `${provider.toLowerCase()}_${Date.now()}`,
      email: `user_${Date.now()}@example.com`,
      name: 'Demo User',
    },
  };

  // Return mock user based on code pattern
  if (code.includes('alice')) return mockUsers.google_alice;
  if (code.includes('bob')) return mockUsers.github_bob;
  return mockUsers.default;
}

// ============================================
// OAuthLogin Handler
// ============================================

export interface OAuthLoginInput {
  provider: OAuthProvider;
  oauth_code: string;
  redirect_uri: string;
  ip_address: string;
  user_agent?: string;
}

export interface OAuthLoginSuccess {
  user: User;
  session: Session;
  access_token: string;
  refresh_token: string;
}

export async function oauthLogin(
  input: OAuthLoginInput
): Promise<ApiResponse<OAuthLoginSuccess>> {
  // Precondition: validate inputs
  if (!input.oauth_code || input.oauth_code.length === 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_OAUTH_CODE',
        message: 'OAuth authorization code is required',
        retriable: false,
      },
    };
  }

  if (!input.redirect_uri || input.redirect_uri.length === 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_REDIRECT_URI',
        message: 'Redirect URI is required',
        retriable: false,
      },
    };
  }

  if (!Object.values(OAuthProvider).includes(input.provider)) {
    return {
      success: false,
      error: {
        code: 'INVALID_OAUTH_CODE',
        message: 'Invalid OAuth provider',
        retriable: false,
      },
    };
  }

  // Exchange OAuth code for user info
  const oauthUser = await exchangeOAuthCode(input.provider, input.oauth_code);

  if (!oauthUser) {
    logAuditEvent({
      type: 'auth.oauth_login_failed',
      resource_type: 'session',
      resource_id: '',
      action: 'INVALID_OAUTH_CODE',
      ip_address: input.ip_address,
      metadata: { provider: input.provider },
    });

    return {
      success: false,
      error: {
        code: 'INVALID_OAUTH_CODE',
        message: 'OAuth authorization code is invalid or expired',
        retriable: false,
      },
    };
  }

  // Check for existing user by OAuth ID
  let user = users.findBy(
    (u) => u.oauth_id === oauthUser.id && u.oauth_provider === input.provider
  );

  // Check if user is suspended
  if (user && user.status === UserStatus.SUSPENDED) {
    logAuditEvent({
      type: 'auth.oauth_login_failed',
      actor_id: user.id,
      resource_type: 'user',
      resource_id: user.id,
      action: 'USER_SUSPENDED',
      ip_address: input.ip_address,
    });

    return {
      success: false,
      error: {
        code: 'USER_SUSPENDED',
        message: 'User account has been suspended',
        retriable: false,
      },
    };
  }

  const now = new Date();

  // Create new user if doesn't exist
  if (!user) {
    user = users.create({
      id: uuid(),
      email: oauthUser.email,
      display_name: oauthUser.name,
      avatar_url: oauthUser.avatar_url,
      oauth_provider: input.provider,
      oauth_id: oauthUser.id,
      status: UserStatus.ACTIVE,
      created_at: now,
      updated_at: now,
      last_login: now,
    });

    logAuditEvent({
      type: 'auth.user_created',
      actor_id: user.id,
      resource_type: 'user',
      resource_id: user.id,
      action: 'CREATE',
      ip_address: input.ip_address,
      metadata: { provider: input.provider },
    });
  } else {
    // Update existing user's last login
    user = users.update(user.id, {
      last_login: now,
      updated_at: now,
    })!;
  }

  // Create session
  const session = sessions.create({
    id: uuid(),
    user_id: user.id,
    status: SessionStatus.ACTIVE,
    ip_address: input.ip_address,
    user_agent: input.user_agent,
    expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
    created_at: now,
  });

  // Generate tokens (mock - in production use proper JWT/crypto)
  const access_token = `at_${uuid().replace(/-/g, '')}`;
  const refresh_token = `rt_${uuid().replace(/-/g, '')}`;

  logAuditEvent({
    type: 'auth.oauth_login_success',
    actor_id: user.id,
    resource_type: 'session',
    resource_id: session.id,
    action: 'CREATE',
    ip_address: input.ip_address,
    metadata: { provider: input.provider },
  });

  return {
    success: true,
    data: {
      user,
      session,
      access_token,
      refresh_token,
    },
  };
}

// ============================================
// RefreshAccessToken Handler
// ============================================

export interface RefreshTokenInput {
  refresh_token: string;
}

export interface RefreshTokenSuccess {
  access_token: string;
  expires_in: number;
}

export async function refreshAccessToken(
  input: RefreshTokenInput
): Promise<ApiResponse<RefreshTokenSuccess>> {
  // Precondition: validate refresh token format
  if (!input.refresh_token || input.refresh_token.length < 32) {
    return {
      success: false,
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid',
        retriable: false,
      },
    };
  }

  // Mock token validation - in production, look up token hash
  // For demo, we'll assume tokens starting with 'rt_' are valid
  if (!input.refresh_token.startsWith('rt_')) {
    return {
      success: false,
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid',
        retriable: false,
      },
    };
  }

  // Check if token is expired (mock check)
  if (input.refresh_token.includes('expired')) {
    return {
      success: false,
      error: {
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired',
        retriable: false,
      },
    };
  }

  // Generate new access token
  const access_token = `at_${uuid().replace(/-/g, '')}`;
  const expires_in = 3600; // 1 hour

  return {
    success: true,
    data: {
      access_token,
      expires_in,
    },
  };
}

// ============================================
// Logout Handler
// ============================================

export interface LogoutInput {
  session_id: string;
  revoke_all?: boolean;
}

export interface LogoutSuccess {
  revoked_count: number;
}

export async function logout(
  input: LogoutInput,
  actor_id: string
): Promise<ApiResponse<LogoutSuccess>> {
  const session = sessions.get(input.session_id);

  if (!session) {
    return {
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Session does not exist',
        retriable: false,
      },
    };
  }

  // Check authorization
  if (session.user_id !== actor_id) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'User does not own this session',
        retriable: false,
      },
    };
  }

  let revoked_count = 0;

  if (input.revoke_all) {
    // Revoke all sessions for this user
    const userSessions = sessions.findAll((s) => s.user_id === actor_id);
    for (const s of userSessions) {
      sessions.update(s.id, { status: SessionStatus.REVOKED });
      revoked_count++;
    }
  } else {
    // Revoke just this session
    sessions.update(session.id, { status: SessionStatus.REVOKED });
    revoked_count = 1;
  }

  logAuditEvent({
    type: 'auth.logout',
    actor_id,
    resource_type: 'session',
    resource_id: input.session_id,
    action: 'REVOKE',
    metadata: { revoke_all: input.revoke_all, revoked_count },
  });

  return {
    success: true,
    data: { revoked_count },
  };
}

// ============================================
// ValidateSession Handler
// ============================================

export interface ValidateSessionInput {
  access_token: string;
}

export interface ValidateSessionSuccess {
  user: User;
  session: Session;
}

export async function validateSession(
  input: ValidateSessionInput
): Promise<ApiResponse<ValidateSessionSuccess>> {
  if (!input.access_token || input.access_token.length === 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Access token is invalid',
        retriable: false,
      },
    };
  }

  // Mock token validation
  if (!input.access_token.startsWith('at_')) {
    return {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Access token is invalid',
        retriable: false,
      },
    };
  }

  if (input.access_token.includes('expired')) {
    return {
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired',
        retriable: false,
      },
    };
  }

  // For demo, return the first active session and user
  const session = sessions.findBy(
    (s) => s.status === SessionStatus.ACTIVE && s.expires_at > new Date()
  );

  if (!session) {
    return {
      success: false,
      error: {
        code: 'SESSION_REVOKED',
        message: 'Session was revoked',
        retriable: false,
      },
    };
  }

  const user = users.get(session.user_id);

  if (!user) {
    return {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'User not found',
        retriable: false,
      },
    };
  }

  if (user.status === UserStatus.SUSPENDED) {
    return {
      success: false,
      error: {
        code: 'USER_SUSPENDED',
        message: 'User is suspended',
        retriable: false,
      },
    };
  }

  return {
    success: true,
    data: { user, session },
  };
}
