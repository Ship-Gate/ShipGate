// BAD: Broken implementation AND broken imports.
// Tests won't execute. Result: NO_SHIP regardless.

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
}

// This import will cause vitest to fail
import { brokenDep } from 'another-nonexistent-package-67890';

const _forceImport = brokenDep;

export function Login(_input: { username: string; password: string }): Session {
  // Returns empty values — violates all postconditions
  return {
    id: '',
    user_id: '',
    token: '',
    expires_at: '',
  };
}
