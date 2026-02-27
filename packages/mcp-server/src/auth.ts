// ============================================================================
// ISL MCP Server — Auth Guard
// ============================================================================
//
// Two modes:
//   1. local  (default) — stdio transport is inherently local; always passes.
//   2. token  — if ISL_MCP_TOKEN env var is set, every tool call must include
//               a matching `_token` argument (or the request is rejected).
//
// For local development no configuration is needed.
// For network / shared deployments, set ISL_MCP_TOKEN.
// ============================================================================

import { timingSafeEqual as tse } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface AuthConfig {
  mode: 'local' | 'token';
  token?: string;
}

export interface AuthContext {
  authenticated: boolean;
  mode: 'local' | 'token';
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Resolve auth configuration from environment variables.
 */
export function resolveAuthConfig(): AuthConfig {
  const token = process.env.ISL_MCP_TOKEN;
  if (token && token.length > 0) {
    return { mode: 'token', token };
  }
  return { mode: 'local' };
}

// ============================================================================
// Authentication
// ============================================================================

/**
 * Authenticate a request.
 *
 * - local mode: always succeeds.
 * - token mode: constant-time comparison of the provided token.
 */
export function authenticate(
  config: AuthConfig,
  providedToken?: string,
): AuthContext {
  if (config.mode === 'local') {
    return { authenticated: true, mode: 'local' };
  }

  if (!providedToken) {
    return {
      authenticated: false,
      mode: 'token',
      error: 'Token required. Set ISL_MCP_TOKEN or pass _token in request.',
    };
  }

  if (!safeEqual(config.token!, providedToken)) {
    return { authenticated: false, mode: 'token', error: 'Invalid token' };
  }

  return { authenticated: true, mode: 'token' };
}

// ============================================================================
// Guard factory
// ============================================================================

/**
 * Create a guard function that extracts `_token` from tool arguments
 * and authenticates against the given config.
 */
export function createAuthGuard(config: AuthConfig) {
  return function guard(args: Record<string, unknown>): AuthContext {
    if (config.mode === 'local') {
      return { authenticated: true, mode: 'local' };
    }
    const token = args._token as string | undefined;
    return authenticate(config, token);
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeEqual(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) {
    // Still do a comparison to keep timing more uniform
    tse(Buffer.from(expected), Buffer.from(expected));
    return false;
  }
  return tse(Buffer.from(expected), Buffer.from(actual));
}
