import { describe, it, expect } from 'vitest';
import { V1_SEMANTICS } from '../src/index.js';
import type { TemporalOperator } from '../src/types.js';

// Load fixtures
import temporalFixtures from '../fixtures/v1/temporal/temporal-operators.json';

describe('Temporal Operators', () => {
  const semantics = V1_SEMANTICS;

  describe('Temporal operator definitions', () => {
    it.each(temporalFixtures.operators)(
      '$operator: $description',
      ({ operator, requiresDuration, allowsNesting, interpretation }) => {
        const op = semantics.getTemporalOperator(operator as TemporalOperator);
        expect(op).toBeDefined();
        expect(op!.requiresDuration).toBe(requiresDuration);
        expect(op!.allowsNesting).toBe(allowsNesting);
        expect(op!.interpretation).toBe(interpretation);
      }
    );
  });

  describe('Operator properties', () => {
    it('should have all temporal operators defined', () => {
      const operators: TemporalOperator[] = [
        'eventually', 'always', 'within', 'never', 'immediately', 'response'
      ];

      for (const op of operators) {
        expect(semantics.getTemporalOperator(op)).toBeDefined();
      }
    });

    it('operators requiring duration', () => {
      expect(semantics.getTemporalOperator('eventually')!.requiresDuration).toBe(true);
      expect(semantics.getTemporalOperator('always')!.requiresDuration).toBe(true);
      expect(semantics.getTemporalOperator('within')!.requiresDuration).toBe(true);
      expect(semantics.getTemporalOperator('response')!.requiresDuration).toBe(true);
    });

    it('operators not requiring duration', () => {
      expect(semantics.getTemporalOperator('never')!.requiresDuration).toBe(false);
      expect(semantics.getTemporalOperator('immediately')!.requiresDuration).toBe(false);
    });

    it('only response allows nesting', () => {
      for (const [op, def] of semantics.temporalOperators) {
        if (op === 'response') {
          expect(def.allowsNesting).toBe(true);
        } else {
          expect(def.allowsNesting).toBe(false);
        }
      }
    });
  });
});
