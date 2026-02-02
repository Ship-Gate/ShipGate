import { describe, it, expect } from 'vitest';
import { getSemantics, V1_SEMANTICS } from '../src/index.js';
import type { BinaryOperator, Value } from '../src/types.js';

// Load fixtures
import equalityFixtures from '../fixtures/v1/binary-operators/equality.json';
import comparisonFixtures from '../fixtures/v1/binary-operators/comparison.json';
import arithmeticFixtures from '../fixtures/v1/binary-operators/arithmetic.json';
import logicalFixtures from '../fixtures/v1/binary-operators/logical.json';
import membershipFixtures from '../fixtures/v1/binary-operators/membership.json';

describe('Binary Operators', () => {
  const semantics = V1_SEMANTICS;

  describe('Equality Operators (== and !=)', () => {
    it.each(equalityFixtures.cases)(
      '$description',
      ({ operator, left, right, expected }) => {
        const op = semantics.getBinaryOperator(operator as BinaryOperator);
        expect(op).toBeDefined();
        const result = op!.evaluate(left as Value, right as Value);
        expect(result).toBe(expected);
      }
    );
  });

  describe('Comparison Operators (<, >, <=, >=)', () => {
    it.each(comparisonFixtures.cases)(
      '$description',
      ({ operator, left, right, expected }) => {
        const op = semantics.getBinaryOperator(operator as BinaryOperator);
        expect(op).toBeDefined();
        const result = op!.evaluate(left as Value, right as Value);
        expect(result).toBe(expected);
      }
    );
  });

  describe('Arithmetic Operators (+, -, *, /, %)', () => {
    it.each(arithmeticFixtures.cases)(
      '$description',
      ({ operator, left, right, expected }) => {
        const op = semantics.getBinaryOperator(operator as BinaryOperator);
        expect(op).toBeDefined();
        const result = op!.evaluate(left as Value, right as Value);
        expect(result).toBe(expected);
      }
    );

    describe('Error cases', () => {
      it.each(arithmeticFixtures.errorCases)(
        '$description',
        ({ operator, left, right, expectedError }) => {
          const op = semantics.getBinaryOperator(operator as BinaryOperator);
          expect(op).toBeDefined();
          expect(() => op!.evaluate(left as Value, right as Value)).toThrow(expectedError);
        }
      );
    });
  });

  describe('Logical Operators (and, or, implies, iff)', () => {
    it.each(logicalFixtures.cases)(
      '$description',
      ({ operator, left, right, expected }) => {
        const op = semantics.getBinaryOperator(operator as BinaryOperator);
        expect(op).toBeDefined();
        const result = op!.evaluate(left as Value, right as Value);
        expect(result).toBe(expected);
      }
    );

    describe('Short-circuit behavior', () => {
      it.each(logicalFixtures.shortCircuitCases)(
        '$operator: $description',
        ({ operator, shortCircuit }) => {
          const op = semantics.getBinaryOperator(operator as BinaryOperator);
          expect(op).toBeDefined();
          expect(op!.shortCircuit).toBe(shortCircuit);
        }
      );
    });
  });

  describe('Membership Operator (in)', () => {
    it.each(membershipFixtures.cases)(
      '$description',
      ({ operator, left, right, expected }) => {
        const op = semantics.getBinaryOperator(operator as BinaryOperator);
        expect(op).toBeDefined();
        const result = op!.evaluate(left as Value, right as Value);
        expect(result).toBe(expected);
      }
    );
  });

  describe('Operator properties', () => {
    it('should have all operators defined', () => {
      const operators: BinaryOperator[] = [
        '==', '!=', '<', '>', '<=', '>=',
        '+', '-', '*', '/', '%',
        'and', 'or', 'implies', 'iff', 'in'
      ];

      for (const op of operators) {
        expect(semantics.getBinaryOperator(op)).toBeDefined();
      }
    });

    it('should have valid precedence values', () => {
      for (const [op, def] of semantics.binaryOperators) {
        expect(def.precedence).toBeGreaterThan(0);
        expect(def.precedence).toBeLessThan(10);
      }
    });
  });
});
