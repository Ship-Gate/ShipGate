/**
 * Auth commands: login, logout, status, token
 */

import { loadCliConfig, saveCliConfig, getToken } from '../services/config-store.js';
import { api } from '../services/api-client.js';

export interface AuthLoginResult {
  success: boolean;
  message: string;
}

/**
 * Store a PAT token for API authentication.
 * Users create a PAT in the dashboard settings, then pass it here.
 */
export async function authLogin(token: string, apiUrl?: string): Promise<AuthLoginResult> {
  if (!token || !token.startsWith('sg_')) {
    return {
      success: false,
      message: 'Invalid token. Tokens start with "sg_". Create one at your dashboard → Settings → API Tokens.',
    };
  }

  const updates: Record<string, string> = { token };
  if (apiUrl) updates.apiUrl = apiUrl;
  saveCliConfig(updates);

  // Verify token works
  try {
    const res = await api.get<{ email: string; name: string }>('/api/v1/me');
    return {
      success: true,
      message: `Authenticated as ${res.data?.name ?? res.data?.email ?? 'user'}`,
    };
  } catch {
    saveCliConfig({ token: undefined });
    return {
      success: false,
      message: 'Token verification failed. Check that the token is valid and the API URL is correct.',
    };
  }
}

export function authLogout(): AuthLoginResult {
  saveCliConfig({ token: undefined });
  return { success: true, message: 'Logged out successfully.' };
}

export function authStatus(): {
  authenticated: boolean;
  apiUrl: string;
  tokenPrefix?: string;
} {
  const config = loadCliConfig();
  const token = config.token;
  return {
    authenticated: !!token,
    apiUrl: config.apiUrl,
    tokenPrefix: token ? token.slice(0, 11) + '...' : undefined,
  };
}

export function printAuthLoginResult(result: AuthLoginResult): void {
  if (result.success) {
    console.log(`✓ ${result.message}`);
  } else {
    console.error(`✗ ${result.message}`);
  }
}

export function printAuthStatus(status: ReturnType<typeof authStatus>): void {
  if (status.authenticated) {
    console.log(`✓ Authenticated`);
    console.log(`  API:   ${status.apiUrl}`);
    console.log(`  Token: ${status.tokenPrefix}`);
  } else {
    console.log(`✗ Not authenticated`);
    console.log(`  API:   ${status.apiUrl}`);
    console.log(`  Run: shipgate auth login <token>`);
  }
}
