export interface Token {
  id: string;
  value: string;
  expires_at: string;
  revoked: boolean;
}

function generateSecureToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const tokenStore = new Map<string, Token>();

export function GenerateToken(input: { user_id: string; ttl_seconds: number }): Token {
  if (input.ttl_seconds <= 0) {
    throw new Error('INVALID_TTL');
  }
  const token: Token = {
    id: crypto.randomUUID(),
    value: generateSecureToken(),
    expires_at: new Date(Date.now() + input.ttl_seconds * 1000).toISOString(),
    revoked: false,
  };
  tokenStore.set(token.id, token);
  return token;
}

export function RevokeToken(input: { token_id: string }): boolean {
  const token = tokenStore.get(input.token_id);
  if (!token) {
    throw new Error('TOKEN_NOT_FOUND');
  }
  token.revoked = true;
  return true;
}
