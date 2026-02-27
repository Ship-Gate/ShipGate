/**
 * Money utility tests
 */

import { describe, it, expect } from 'vitest';
import { MoneyValue, money, cents, calculateTax, calculateDiscount, calculateTotal } from '../src/money';

describe('MoneyValue', () => {
  describe('construction', () => {
    it('should create Money from cents', () => {
      const m = new MoneyValue(1000n, 'USD');
      expect(m.amount).toBe(1000n);
      expect(m.currency).toBe('USD');
    });

    it('should create Money from decimal', () => {
      const m = MoneyValue.fromDecimal(10.99, 'USD');
      expect(m.amount).toBe(1099n);
      expect(m.currency).toBe('USD');
    });

    it('should create Money from string decimal', () => {
      const m = MoneyValue.fromDecimal('10.99', 'USD');
      expect(m.amount).toBe(1099n);
      expect(m.currency).toBe('USD');
    });

    it('should handle zero decimal currencies', () => {
      const m = MoneyValue.fromDecimal(1000, 'JPY');
      expect(m.amount).toBe(1000n);
      expect(m.precision).toBe(0);
    });
  });

  describe('formatting', () => {
    it('should convert to decimal string', () => {
      const m = MoneyValue.fromDecimal(10.99, 'USD');
      expect(m.toDecimal()).toBe('10.99');
    });

    it('should convert to number', () => {
      const m = MoneyValue.fromDecimal(10.99, 'USD');
      expect(m.toNumber()).toBe(10.99);
    });

    it('should format as currency', () => {
      const m = MoneyValue.fromDecimal(10.99, 'USD');
      expect(m.format()).toBe('$10.99');
    });

    it('should format with different locale', () => {
      const m = MoneyValue.fromDecimal(10.99, 'EUR');
      expect(m.format('de-DE')).toBe('10,99 €');
    });
  });

  describe('arithmetic', () => {
    it('should add money', () => {
      const m1 = money(10, 'USD');
      const m2 = money(5, 'USD');
      const sum = m1.add(m2);
      expect(sum.amount).toBe(1500n);
    });

    it('should subtract money', () => {
      const m1 = money(10, 'USD');
      const m2 = money(5, 'USD');
      const diff = m1.subtract(m2);
      expect(diff.amount).toBe(500n);
    });

    it('should multiply by number', () => {
      const m = money(10, 'USD');
      const product = m.multiply(3);
      expect(product.amount).toBe(3000n);
    });

    it('should divide by number', () => {
      const m = money(10, 'USD');
      const quotient = m.divide(3);
      expect(quotient.amount).toBe(333n); // Rounded
    });

    it('should calculate percentage', () => {
      const m = money(100, 'USD');
      const percent = m.percentage(25);
      expect(percent.amount).toBe(2500n);
    });
  });

  describe('comparison', () => {
    it('should compare equal money', () => {
      const m1 = money(10, 'USD');
      const m2 = money(10, 'USD');
      expect(m1.equals(m2)).toBe(true);
      expect(m1.compare(m2)).toBe(0);
    });

    it('should compare different money', () => {
      const m1 = money(10, 'USD');
      const m2 = money(5, 'USD');
      expect(m1.greaterThan(m2)).toBe(true);
      expect(m2.lessThan(m1)).toBe(true);
    });

    it('should throw error for different currencies', () => {
      const m1 = money(10, 'USD');
      const m2 = money(10, 'EUR');
      expect(() => m1.add(m2)).toThrow('Currency mismatch');
    });
  });

  describe('allocation', () => {
    it('should allocate by ratios', () => {
      const m = money(100, 'USD');
      const parts = m.allocate([1, 2, 3]);
      expect(parts.length).toBe(3);
      expect(parts[0].amount).toBe(1667n);
      expect(parts[1].amount).toBe(3333n);
      expect(parts[2].amount).toBe(5000n);
    });

    it('should split equally', () => {
      const m = money(100, 'USD');
      const parts = m.split(3);
      expect(parts.length).toBe(3);
      expect(parts[0].amount).toBe(3333n);
      expect(parts[1].amount).toBe(3333n);
      expect(parts[2].amount).toBe(3334n); // Remainder
    });
  });

  describe('rounding', () => {
    it('should round to different precision', () => {
      const m = MoneyValue.fromDecimal(10.999, 'USD');
      const rounded = m.round(0, 'down');
      expect(rounded.amount).toBe(10n);
    });

    it('should handle half even rounding', () => {
      const m = MoneyValue.fromDecimal(10.5, 'USD');
      const rounded = m.round(0, 'half_even');
      expect(rounded.amount).toBe(10n);
    });
  });
});

describe('utility functions', () => {
  it('should create money from decimal', () => {
    const m = money(10.99, 'USD');
    expect(m.toDecimal()).toBe('10.99');
  });

  it('should create money from cents', () => {
    const m = cents(1099, 'USD');
    expect(m.toDecimal()).toBe('10.99');
  });

  it('should calculate tax', () => {
    const base = money(100, 'USD');
    const tax = calculateTax(base, 8.25);
    expect(tax.toDecimal()).toBe('8.25');
  });

  it('should calculate discount', () => {
    const base = money(100, 'USD');
    const discount = calculateDiscount(base, 10);
    expect(discount.toDecimal()).toBe('10.00');
  });

  it('should calculate total with tax and discount', () => {
    const subtotal = money(100, 'USD');
    const result = calculateTotal(subtotal, 8.25, 10);
    
    expect(result.subtotal.toDecimal()).toBe('100.00');
    expect(result.tax.toDecimal()).toBe('8.25');
    expect(result.discount.toDecimal()).toBe('10.00');
    expect(result.total.toDecimal()).toBe('98.25');
  });
});
