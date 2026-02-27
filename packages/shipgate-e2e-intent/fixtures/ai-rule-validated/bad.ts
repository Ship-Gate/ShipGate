// BAD: Token value too short (< 32 chars) — violates postcondition "result.value.length >= 32"
// Also doesn't throw on invalid TTL

export interface Token {
  id: string;
  value: string;
  expires_at: string;
  revoked: boolean;
}

export function GenerateToken(input: { user_id: string; ttl_seconds: number }): Token {
  // Missing: no TTL validation — violates precondition
  return {
    id: crypto.randomUUID(),
    value: 'short',
    expires_at: new Date(Date.now() + input.ttl_seconds * 1000).toISOString(),
    revoked: false,
  };
}

export function RevokeToken(input: { token_id: string }): boolean {
  // Always returns true without checking if token exists
  return true;
}
