/**
 * Bigint-based Money type.
 * All amounts are stored as minor-unit integers (cents).
 * No floating-point arithmetic is ever used for storage or calculation.
 */

import type { Currency } from './types.js';
import { CurrencyMismatchError, InvalidMoneyOperationError } from './errors.js';

// ============================================================================
// MONEY VALUE OBJECT
// ============================================================================

export class Money {
  /** Amount in minor units (e.g. cents). Always an integer. */
  readonly amount: bigint;
  readonly currency: Currency;

  private constructor(amount: bigint, currency: Currency) {
    this.amount = amount;
    this.currency = currency;
  }

  // --------------------------------------------------------------------------
  // FACTORIES
  // --------------------------------------------------------------------------

  /** Create Money from minor-unit integer (cents). */
  static fromCents(cents: bigint | number, currency: Currency): Money {
    const val = typeof cents === 'number' ? BigInt(Math.trunc(cents)) : cents;
    return new Money(val, currency);
  }

  /** Create Money from a major-unit string (e.g. "19.99"). Avoids float. */
  static fromString(value: string, currency: Currency): Money {
    const decimals = Money.minorUnitDigits(currency);
    const negative = value.startsWith('-');
    const abs = negative ? value.slice(1) : value;
    const parts = abs.split('.');
    const whole = parts[0] ?? '0';
    let frac = parts[1] ?? '';

    if (frac.length > decimals) {
      throw new InvalidMoneyOperationError(
        `Too many decimal places for ${currency}: got ${frac.length}, max ${decimals}`,
      );
    }

    frac = frac.padEnd(decimals, '0');
    const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac);
    return new Money(negative ? -raw : raw, currency);
  }

  /** Create zero Money. */
  static zero(currency: Currency): Money {
    return new Money(0n, currency);
  }

  // --------------------------------------------------------------------------
  // ARITHMETIC (returns new Money — immutable)
  // --------------------------------------------------------------------------

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  /** Multiply by an integer quantity. */
  multiply(factor: bigint | number): Money {
    const f = typeof factor === 'number' ? BigInt(Math.trunc(factor)) : factor;
    return new Money(this.amount * f, this.currency);
  }

  /**
   * Proportional split: (amount * numerator) / denominator.
   * Uses banker's rounding (round half to even) on the bigint division.
   */
  allocate(numerator: bigint | number, denominator: bigint | number): Money {
    const n = typeof numerator === 'number' ? BigInt(numerator) : numerator;
    const d = typeof denominator === 'number' ? BigInt(denominator) : denominator;
    if (d === 0n) {
      throw new InvalidMoneyOperationError('Division by zero');
    }
    const result = Money.bigintDivRound(this.amount * n, d);
    return new Money(result, this.currency);
  }

  /** Negate. */
  negate(): Money {
    return new Money(-this.amount, this.currency);
  }

  /** Absolute value. */
  abs(): Money {
    return new Money(this.amount < 0n ? -this.amount : this.amount, this.currency);
  }

  // --------------------------------------------------------------------------
  // PERCENTAGE
  // --------------------------------------------------------------------------

  /**
   * Apply a percentage (basis-points precision).
   * `percent` is a number like 8.25 meaning 8.25%.
   * Internally: amount * percentBp / 10000, rounded.
   */
  percentage(percent: number): Money {
    const bp = BigInt(Math.round(percent * 100));
    const result = Money.bigintDivRound(this.amount * bp, 10000n);
    return new Money(result, this.currency);
  }

  // --------------------------------------------------------------------------
  // COMPARISON
  // --------------------------------------------------------------------------

  isZero(): boolean {
    return this.amount === 0n;
  }

  isPositive(): boolean {
    return this.amount > 0n;
  }

  isNegative(): boolean {
    return this.amount < 0n;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount === other.amount;
  }

  compareTo(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.amount < other.amount) return -1;
    if (this.amount > other.amount) return 1;
    return 0;
  }

  greaterThan(other: Money): boolean {
    return this.compareTo(other) === 1;
  }

  lessThan(other: Money): boolean {
    return this.compareTo(other) === -1;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.compareTo(other) >= 0;
  }

  lessThanOrEqual(other: Money): boolean {
    return this.compareTo(other) <= 0;
  }

  static min(a: Money, b: Money): Money {
    a.assertSameCurrency(b);
    return a.amount <= b.amount ? a : b;
  }

  static max(a: Money, b: Money): Money {
    a.assertSameCurrency(b);
    return a.amount >= b.amount ? a : b;
  }

  // --------------------------------------------------------------------------
  // DISPLAY
  // --------------------------------------------------------------------------

  /** Convert to major-unit string, e.g. "19.99". */
  toMajorString(): string {
    const decimals = Money.minorUnitDigits(this.currency);
    if (decimals === 0) return this.amount.toString();

    const negative = this.amount < 0n;
    const abs = negative ? -this.amount : this.amount;
    const divisor = 10n ** BigInt(decimals);
    const whole = abs / divisor;
    const frac = abs % divisor;
    const fracStr = frac.toString().padStart(decimals, '0');
    return `${negative ? '-' : ''}${whole}.${fracStr}`;
  }

  /** Format for display: "$19.99" */
  toDisplayString(locale: string = 'en-US'): string {
    const decimals = Money.minorUnitDigits(this.currency);
    const num = Number(this.amount) / Math.pow(10, decimals);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
    }).format(num);
  }

  toString(): string {
    return `${this.toMajorString()} ${this.currency}`;
  }

  toJSON(): { amount: string; currency: Currency } {
    return { amount: this.amount.toString(), currency: this.currency };
  }

  /** Number of cents (as number). Use only when bigint is not needed. */
  toCentsNumber(): number {
    return Number(this.amount);
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  /** Number of minor-unit digits for a currency. */
  static minorUnitDigits(currency: Currency): number {
    const zeroDecimal = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'BIF', 'DJF', 'GNF', 'KMF', 'MGA', 'PYG', 'RWF', 'VUV', 'XAF', 'XOF', 'XPF']);
    const threeDecimal = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);
    if (zeroDecimal.has(currency)) return 0;
    if (threeDecimal.has(currency)) return 3;
    return 2;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  /**
   * Integer division with banker's rounding (round half to even).
   */
  static bigintDivRound(numerator: bigint, denominator: bigint): bigint {
    const negative = (numerator < 0n) !== (denominator < 0n);
    const absNum = numerator < 0n ? -numerator : numerator;
    const absDen = denominator < 0n ? -denominator : denominator;

    const quotient = absNum / absDen;
    const remainder = absNum % absDen;
    const doubleRemainder = remainder * 2n;

    let rounded: bigint;
    if (doubleRemainder > absDen) {
      rounded = quotient + 1n;
    } else if (doubleRemainder < absDen) {
      rounded = quotient;
    } else {
      // Exactly half — round to even
      rounded = quotient % 2n === 0n ? quotient : quotient + 1n;
    }

    return negative ? -rounded : rounded;
  }
}
