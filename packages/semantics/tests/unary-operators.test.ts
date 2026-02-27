import { describe, it, expect } from 'vitest';
import { V1_SEMANTICS } from '../src/index.js';
import type { UnaryOperator, Value } from '../src/types.js';

// Load fixtures
import unaryFixtures from '../fixtures/v1/unary-operators/unary.json';

describe('Unary Operators', () => {
  const semantics = V1_SEMANTICS;

  describe('Unary operator evaluation', () => {
    it.each(unaryFixtures.cases)(
      '$description',
      ({ operator, operand, expected }) => {
        const op = semantics.getUnaryOperator(operator as UnaryOperator);
        expect(op).toBeDefined();
        const result = op!.evaluate(operand as Value);
        // For numbers, compare using == to handle -0 === 0 (IEEE 754 semantics)
        if (typeof expected === 'number' && typeof result === 'number') {
          expect(result == expected).toBe(true);
        } else {
          expect(result).toBe(expected);
        }
      }
    );
  });

  describe('Error cases', () => {
    it.each(unaryFixtures.errorCases)(
      '$description',
      ({ operator, operand, expectedError }) => {
        const op = semantics.getUnaryOperator(operator as UnaryOperator);
        expect(op).toBeDefined();
        expect(() => op!.evaluate(operand as Value)).toThrow(expectedError);
      }
    );
  });

  describe('Operator properties', () => {
    it('should have both unary operators defined', () => {
      expect(semantics.getUnaryOperator('not')).toBeDefined();
      expect(semantics.getUnaryOperator('-')).toBeDefined();
    });

    it('not operator should return boolean type', () => {
      const notOp = semantics.getUnaryOperator('not')!;
      expect(notOp.resultType).toBe('boolean');
    });

    it('unary minus should return number type', () => {
      const minusOp = semantics.getUnaryOperator('-')!;
      expect(minusOp.resultType).toBe('number');
    });
  });
});
