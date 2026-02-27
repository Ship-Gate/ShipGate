// ============================================================================
// Generated Tests for Login
// Domain: Auth
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Behavior implementation
import { login } from '../src/Login';
import type { LoginInput, LoginResult } from '../src/types';

// Entity mocks
import { User, Session } from './fixtures';

// Test context
let testContext: {
  reset: () => void;
  captureState: () => Record<string, unknown>;
};

beforeEach(() => {
  testContext = {
    reset: () => {
      // Reset entity state
      User.reset?.();
      Session.reset?.();
    },
    captureState: () => ({
      timestamp: Date.now(),
    }),
  };
  testContext.reset();
});

afterEach(() => {
  // Cleanup
});

describe('Login', () => {

  describe('Valid Inputs', () => {

    it('valid email and password', async () => {
      // Arrange
      const input: LoginInput = {
        email: "user@example.com",
        password: "SecureP@ss1",
      };

      // Act
      const result = await login(input);

      // Assert
      // Primary assertions
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(await Session.exists({ id: result.data.session.id })).toBe(true);
      expect(result.data.access_token).not.toBe(null);
      expect((await User.lookup({ email: input.email })).failed_login_attempts).toBe(0);
    });
  });

  describe('Invalid Inputs (Negative Tests)', () => {

    it('rejects empty email', async () => {
      // Arrange
      const input: LoginInput = {
        email: "",
        password: "SecureP@ss1",
      };

      // Act
      const result = await login(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it('returns INVALID_CREDENTIALS for wrong password', async () => {
      // Arrange
      const input: LoginInput = {
        email: "user@example.com",
        password: "wrong-password",
      };

      // Capture state before execution
      const __old__: Record<string, unknown> = {};
      __old__['User_lookup'] = await captureState('User_lookup');

      // Act
      const result = await login(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code ?? result.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns ACCOUNT_LOCKED after too many failures', async () => {
      // Arrange
      const input: LoginInput = {
        email: "locked@example.com",
        password: "anypassword",
      };

      // Act
      const result = await login(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code ?? result.error).toBe('ACCOUNT_LOCKED');
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

async function captureState(path: string): Promise<unknown> {
  // Implement state capture for old() expressions
  return undefined;
}
