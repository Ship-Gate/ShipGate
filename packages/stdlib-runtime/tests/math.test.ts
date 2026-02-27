import { describe, test, expect } from 'vitest';
import * as Math_ from '../src/math';

describe('Math Module', () => {
  describe('Basic Operations', () => {
    test('abs returns absolute value', () => {
      expect(Math_.abs(5)).toBe(5);
      expect(Math_.abs(-5)).toBe(5);
      expect(Math_.abs(0)).toBe(0);
    });

    test('sign returns sign', () => {
      expect(Math_.sign(5)).toBe(1);
      expect(Math_.sign(-5)).toBe(-1);
      expect(Math_.sign(0)).toBe(0);
    });

    test('min returns minimum', () => {
      expect(Math_.min(3, 7)).toBe(3);
      expect(Math_.min(-1, 1)).toBe(-1);
    });

    test('max returns maximum', () => {
      expect(Math_.max(3, 7)).toBe(7);
      expect(Math_.max(-1, 1)).toBe(1);
    });

    test('clamp restricts value to range', () => {
      expect(Math_.clamp(5, 0, 10)).toBe(5);
      expect(Math_.clamp(-5, 0, 10)).toBe(0);
      expect(Math_.clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('Rounding Operations', () => {
    test('floor rounds towards negative infinity', () => {
      expect(Math_.floor(3.7)).toBe(3);
      expect(Math_.floor(-3.7)).toBe(-4);
    });

    test('ceil rounds towards positive infinity', () => {
      expect(Math_.ceil(3.2)).toBe(4);
      expect(Math_.ceil(-3.2)).toBe(-3);
    });

    test('round rounds to nearest', () => {
      expect(Math_.round(3.5)).toBe(4);
      expect(Math_.round(3.4)).toBe(3);
      expect(Math_.round(-3.5)).toBe(-3);
    });

    test('roundTo rounds to decimal places', () => {
      expect(Math_.roundTo(3.14159, 2)).toBe(3.14);
      expect(Math_.roundTo(3.145, 2)).toBe(3.15);
    });

    test('trunc truncates towards zero', () => {
      expect(Math_.trunc(3.7)).toBe(3);
      expect(Math_.trunc(-3.7)).toBe(-3);
    });
  });

  describe('Arithmetic Operations', () => {
    test('add adds numbers', () => {
      expect(Math_.add(2, 3)).toBe(5);
      expect(Math_.add(-2, 3)).toBe(1);
    });

    test('subtract subtracts numbers', () => {
      expect(Math_.subtract(5, 3)).toBe(2);
      expect(Math_.subtract(3, 5)).toBe(-2);
    });

    test('multiply multiplies numbers', () => {
      expect(Math_.multiply(3, 4)).toBe(12);
      expect(Math_.multiply(-3, 4)).toBe(-12);
    });

    test('divide divides numbers', () => {
      expect(Math_.divide(10, 2)).toBe(5);
      expect(Math_.divide(7, 2)).toBe(3.5);
      expect(() => Math_.divide(5, 0)).toThrow('DIVISION_BY_ZERO');
    });

    test('mod returns remainder', () => {
      expect(Math_.mod(10, 3)).toBe(1);
      expect(Math_.mod(10, 2)).toBe(0);
    });

    test('pow raises to power', () => {
      expect(Math_.pow(2, 3)).toBe(8);
      expect(Math_.pow(2, 0)).toBe(1);
    });

    test('sqrt returns square root', () => {
      expect(Math_.sqrt(4)).toBe(2);
      expect(Math_.sqrt(9)).toBe(3);
      expect(() => Math_.sqrt(-1)).toThrow('NEGATIVE_VALUE');
    });
  });

  describe('Safe Arithmetic', () => {
    test('safeAdd throws on overflow', () => {
      expect(Math_.safeAdd(5, 3)).toBe(8);
      expect(() => Math_.safeAdd(Number.MAX_SAFE_INTEGER, 1)).toThrow('OVERFLOW');
    });

    test('safeSubtract throws on underflow', () => {
      expect(Math_.safeSubtract(5, 3)).toBe(2);
      expect(() => Math_.safeSubtract(Number.MIN_SAFE_INTEGER, 1)).toThrow('UNDERFLOW');
    });
  });

  describe('Comparison Operations', () => {
    test('approximately checks floating point equality', () => {
      expect(Math_.approximately(0.1 + 0.2, 0.3)).toBe(true);
      expect(Math_.approximately(1.0, 1.0001, 0.001)).toBe(true);
      expect(Math_.approximately(1.0, 2.0)).toBe(false);
    });

    test('isPositive checks positive', () => {
      expect(Math_.isPositive(5)).toBe(true);
      expect(Math_.isPositive(-5)).toBe(false);
      expect(Math_.isPositive(0)).toBe(false);
    });

    test('isNegative checks negative', () => {
      expect(Math_.isNegative(-5)).toBe(true);
      expect(Math_.isNegative(5)).toBe(false);
    });

    test('isZero checks zero', () => {
      expect(Math_.isZero(0)).toBe(true);
      expect(Math_.isZero(0.0001, 0.001)).toBe(true);
      expect(Math_.isZero(5)).toBe(false);
    });

    test('isInteger checks integer', () => {
      expect(Math_.isInteger(5)).toBe(true);
      expect(Math_.isInteger(5.5)).toBe(false);
    });
  });

  describe('Range Operations', () => {
    test('inRange checks value in range', () => {
      expect(Math_.inRange(5, 0, 10)).toBe(true);
      expect(Math_.inRange(0, 0, 10)).toBe(true);
      expect(Math_.inRange(10, 0, 10)).toBe(true);
      expect(Math_.inRange(0, 0, 10, false)).toBe(false);
    });

    test('lerp interpolates linearly', () => {
      expect(Math_.lerp(0, 10, 0)).toBe(0);
      expect(Math_.lerp(0, 10, 1)).toBe(10);
      expect(Math_.lerp(0, 10, 0.5)).toBe(5);
    });

    test('inverseLerp finds interpolation factor', () => {
      expect(Math_.inverseLerp(0, 10, 5)).toBe(0.5);
      expect(Math_.inverseLerp(0, 10, 0)).toBe(0);
      expect(Math_.inverseLerp(0, 10, 10)).toBe(1);
    });
  });

  describe('Statistics Operations', () => {
    test('sum calculates sum', () => {
      expect(Math_.sum([1, 2, 3, 4, 5])).toBe(15);
      expect(Math_.sum([])).toBe(0);
    });

    test('average calculates mean', () => {
      expect(Math_.average([1, 2, 3, 4, 5])).toBe(3);
      expect(Math_.average([])).toBe(null);
    });

    test('median calculates median', () => {
      expect(Math_.median([1, 2, 3, 4, 5])).toBe(3);
      expect(Math_.median([1, 2, 3, 4])).toBe(2.5);
    });

    test('minOf finds minimum', () => {
      expect(Math_.minOf([3, 1, 4, 1, 5])).toBe(1);
      expect(Math_.minOf([])).toBe(null);
    });

    test('maxOf finds maximum', () => {
      expect(Math_.maxOf([3, 1, 4, 1, 5])).toBe(5);
      expect(Math_.maxOf([])).toBe(null);
    });
  });

  describe('Financial Operations', () => {
    test('percentage calculates percentage', () => {
      expect(Math_.percentage(100, 20)).toBe(20);
      expect(Math_.percentage(50, 10)).toBe(5);
    });

    test('percentageOf calculates what percentage', () => {
      expect(Math_.percentageOf(20, 100)).toBe(20);
      expect(Math_.percentageOf(1, 4)).toBe(25);
    });

    test('roundCurrency rounds to 2 decimals', () => {
      expect(Math_.roundCurrency(10.999)).toBe(11);
      expect(Math_.roundCurrency(10.994)).toBe(10.99);
    });

    test('discountedPrice applies discount', () => {
      expect(Math_.discountedPrice(100, 20)).toBe(80);
      expect(Math_.discountedPrice(50, 10)).toBe(45);
    });
  });
});
