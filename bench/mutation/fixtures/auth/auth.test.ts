/**
 * Authentication Tests
 * 
 * Test suite for auth implementation.
 * Used for mutation testing (delete-expectation mutations).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { login, resetState, getSession, AuthError } from './auth.impl';

describe('Authentication', () => {
  beforeEach(() => {
    resetState();
  });

  describe('login', () => {
    it('should create session on successful login', () => {
      const email = 'test@example.com';
      const password = 'Password123';
      
      const session = login(email, password);
      
      // Target for delete-expectation mutation
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.user_id).toBeDefined();
      expect(session.expires_at.getTime()).toBeGreaterThan(Date.now());
      
      // Verify session is stored
      const storedSession = getSession(session.id);
      expect(storedSession).toBeDefined();
      expect(storedSession?.id).toBe(session.id);
    });

    it('should reject passwords shorter than 8 characters', () => {
      expect(() => login('test@example.com', 'short')).toThrow(AuthError);
    });

    it('should reject passwords without uppercase', () => {
      expect(() => login('test@example.com', 'password123')).toThrow(AuthError);
    });

    it('should reject passwords without numbers', () => {
      expect(() => login('test@example.com', 'PasswordABC')).toThrow(AuthError);
    });

    it('should track failed attempts', () => {
      const email = 'test@example.com';
      
      // First failed attempt
      expect(() => login(email, 'WrongPass1')).toThrow('Invalid email or password');
      
      // Subsequent attempts should still work until lockout
      expect(() => login(email, 'WrongPass2')).toThrow('Invalid email or password');
    });

    it('should lock account after too many failed attempts', () => {
      const email = 'locktest@example.com';
      
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          login(email, 'WrongPass' + i);
        } catch {
          // Expected
        }
      }
      
      // 6th attempt should be locked
      expect(() => login(email, 'Password123')).toThrow(AuthError);
    });
  });

  describe('postconditions', () => {
    it('should have valid session expiry', () => {
      const session = login('user@example.com', 'Password123');
      
      expect(session.expires_at).toBeInstanceOf(Date);
      expect(session.expires_at.getTime()).toBeGreaterThan(session.created_at.getTime());
    });

    it('should reset failed attempts on success', () => {
      const email = 'reset@example.com';
      
      // Make a failed attempt
      try {
        login(email, 'WrongPass1');
      } catch {
        // Expected
      }
      
      // Successful login should reset
      const session = login(email, 'Password123');
      expect(session).toBeDefined();
      
      // Should be able to fail again without lockout
      try {
        login(email, 'WrongPass2');
      } catch {
        // Expected
      }
    });
  });

  describe('invariants', () => {
    it('should maintain failed_attempts bounds', () => {
      const email = 'bounds@example.com';
      
      // Even after lockout, failed_attempts shouldn't exceed max
      for (let i = 0; i < 10; i++) {
        try {
          login(email, 'WrongPass' + i);
        } catch {
          // Expected
        }
      }
      
      // System should still be consistent
      expect(() => login(email, 'Password123')).toThrow();
    });
  });
});
