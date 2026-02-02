// ============================================================================
// CreateUser Tests - Test fixture
// ============================================================================

import { describe, it, expect } from 'vitest';
import { createUser } from '../src/createUser';

describe('CreateUser', () => {
  describe('preconditions', () => {
    it('should require non-empty email', async () => {
      await expect(createUser({ email: '' })).rejects.toThrow('Email is required');
    });
    
    it('should require valid email format', async () => {
      await expect(createUser({ email: 'invalid' })).rejects.toThrow('Invalid email format');
    });
  });
  
  describe('postconditions', () => {
    it('should return user with matching email', async () => {
      const result = await createUser({ email: 'test@example.com' });
      expect(result.email).toBe('test@example.com');
    });
    
    it('should return user with active status', async () => {
      const result = await createUser({ email: 'test@example.com' });
      expect(result.active).toBe(true);
    });
    
    it('should return user with generated id', async () => {
      const result = await createUser({ email: 'test@example.com' });
      expect(result.id).toBeDefined();
      expect(result.id.startsWith('user-')).toBe(true);
    });
  });
});
