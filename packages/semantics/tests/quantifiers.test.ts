import { describe, it, expect } from 'vitest';
import { V1_SEMANTICS } from '../src/index.js';
import type { Quantifier, Value } from '../src/types.js';

// Load fixtures
import quantifierFixtures from '../fixtures/v1/quantifiers/quantifiers.json';

describe('Quantifiers', () => {
  const semantics = V1_SEMANTICS;

  // Helper to create simple predicates for testing
  const createPredicate = (description: string): ((item: Value) => Value) => {
    if (description.includes('> 0')) return (x) => (x as number) > 0;
    if (description.includes('> 2')) return (x) => (x as number) > 2;
    if (description.includes('> 3')) return (x) => (x as number) > 3;
    if (description.includes('> 10')) return (x) => (x as number) > 10;
    if (description.includes('< 0')) return (x) => (x as number) < 0;
    if (description.includes('identity') || description === 'x') return (x) => x;
    return (x) => Boolean(x);
  };

  describe('Quantifier evaluation', () => {
    it.each(quantifierFixtures.cases)(
      '$description',
      ({ quantifier, collection, predicateDescription, expected }) => {
        const q = semantics.getQuantifier(quantifier as Quantifier);
        expect(q).toBeDefined();
        
        const predicate = createPredicate(predicateDescription);
        const result = q!.evaluate(collection as Value[], predicate);
        
        if (Array.isArray(expected)) {
          expect(result).toEqual(expected);
        } else {
          expect(result).toBe(expected);
        }
      }
    );
  });

  describe('Short-circuit behavior', () => {
    it.each(quantifierFixtures.shortCircuitBehavior)(
      '$quantifier: $description',
      ({ quantifier, shortCircuit }) => {
        const q = semantics.getQuantifier(quantifier as Quantifier);
        expect(q).toBeDefined();
        expect(q!.shortCircuit).toBe(shortCircuit);
      }
    );

    it('all quantifier should short-circuit on first false', () => {
      const q = semantics.getQuantifier('all')!;
      let callCount = 0;
      const predicate = (x: Value) => {
        callCount++;
        return (x as number) > 0;
      };

      const result = q.evaluate([1, 2, -1, 4, 5] as Value[], predicate);
      expect(result).toBe(false);
      expect(callCount).toBe(3); // Should stop after hitting -1
    });

    it('any quantifier should short-circuit on first true', () => {
      const q = semantics.getQuantifier('any')!;
      let callCount = 0;
      const predicate = (x: Value) => {
        callCount++;
        return (x as number) > 3;
      };

      const result = q.evaluate([1, 2, 4, 5, 6] as Value[], predicate);
      expect(result).toBe(true);
      expect(callCount).toBe(3); // Should stop after hitting 4
    });
  });

  describe('Result types', () => {
    it('all/any/none should return boolean', () => {
      expect(semantics.getQuantifier('all')!.resultType).toBe('boolean');
      expect(semantics.getQuantifier('any')!.resultType).toBe('boolean');
      expect(semantics.getQuantifier('none')!.resultType).toBe('boolean');
    });

    it('count/sum should return number', () => {
      expect(semantics.getQuantifier('count')!.resultType).toBe('number');
      expect(semantics.getQuantifier('sum')!.resultType).toBe('number');
    });

    it('filter should return array', () => {
      expect(semantics.getQuantifier('filter')!.resultType).toBe('array');
    });
  });

  describe('Sum quantifier type checking', () => {
    it('should throw if predicate returns non-number', () => {
      const q = semantics.getQuantifier('sum')!;
      const predicate = () => 'not a number' as Value;

      expect(() => q.evaluate([1, 2, 3] as Value[], predicate)).toThrow(/numeric/);
    });
  });
});
