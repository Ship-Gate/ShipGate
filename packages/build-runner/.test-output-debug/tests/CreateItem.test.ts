/**
 * Generated test file - Vitest
 * Do not modify manually. Regenerate from ISL spec.
 * @generated
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestContext } from '@isl-lang/test-runtime';
import { CreateItem } from '../src/CreateItem';
import type { CreateItemInput, CreateItemResult } from '../src/types';
import { createTestInput, createInvalidInput } from './helpers/test-utils';

// Entity bindings from test runtime: Item

/**
 * Tests for CreateItem behavior
 * Domain: Minimal
 * Creates a new item
 */
describe('CreateItem', () => {
  // Test setup
  beforeEach(() => {
    // Reset mocks and state before each test
    vi.clearAllMocks();
  });

  // Teardown
  afterEach(() => {
    // Cleanup after each test
    vi.restoreAllMocks();
  });

  describe('Preconditions', () => {
    
    describe('should validate length constraint', () => {
      it('should validate precondition', () => {
        // Precondition: (input.name.length > 0)
        const input = createTestInput();
        const preconditionMet = (input.name.length > 0);
        expect(preconditionMet).toBe(true);
      });

      it('should reject invalid input', async () => {
        const invalidInput = createInvalidInputForshould_validate_length_constraint();
        const result = await CreateItem(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  

    describe('should validate length constraint', () => {
      it('should validate precondition', () => {
        // Precondition: (input.name.length <= 100)
        const input = createTestInput();
        const preconditionMet = (input.name.length <= 100);
        expect(preconditionMet).toBe(true);
      });

      it('should reject invalid input', async () => {
        const invalidInput = createInvalidInputForshould_validate_length_constraint();
        const result = await CreateItem(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  
  });

  describe('Postconditions', () => {
    // Test context with entity bindings
    const ctx = createTestContext({ entities: ['Item'] });
    const { Item } = ctx.entities;

    beforeEach(() => ctx.reset());

    describe('on success', () => {
      it('should satisfy all success postconditions', async () => {
        // Setup
        const input = createValidInput();
        const __old__ = ctx.captureState();

        // Execute
        const result = await CreateItem(input);

        // Verify success
        expect(result.success).toBe(true);

        // Verify postconditions
        expect(result.name).toEqual(input.name);
      });
    });
  });

  describe('Contract Implications', () => {
    it('success implies (result.name === input.name)', async () => {
      const input = createInputForSuccess();
      const __old__ = ctx.captureState();
      const result = await CreateItem(input);

      if (result.success) {
        expect(result.name).toEqual(input.name);
      }
    });
  });

  

  describe('Error Cases', () => {
    it('should return INVALID_NAME when Name is empty or too long', async () => {
      const input = createInputForINVALID_NAME();
      const result = await CreateItem(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_NAME');
      expect(result.retriable).toBe(false);
    });
  });

  
});