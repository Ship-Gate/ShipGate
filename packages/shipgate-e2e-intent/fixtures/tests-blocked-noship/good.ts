// Good implementation — but tests won't execute because of
// intentionally broken import in the test generation path.
// This proves: even correct code MUST NOT SHIP if tests can't run.

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
}

// This import will cause vitest to fail at execution time
import { nonExistentModule } from 'this-package-does-not-exist-12345';

const _forceImport = nonExistentModule;

export function Login(input: { username: string; password: string }): Session {
  if (!input.username || !input.password) {
    throw new Error('INVALID_CREDENTIALS');
  }
  return {
    id: crypto.randomUUID(),
    user_id: `user_${input.username}`,
    token: crypto.randomUUID() + crypto.randomUUID(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
}
