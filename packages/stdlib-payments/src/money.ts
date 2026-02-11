/**
 * Money utility with bigint support for precise financial calculations
 * @packageDocumentation
 */

import { Currency, Money, MoneyOptions } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Number of decimal places for each currency
 * Based on ISO 4217
 */
const CURRENCY_PRECISION: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  CNY: 2,
  INR: 2,
  AUD: 2,
  CAD: 2,
  CHF: 2,
  SEK: 2,
  NOK: 2,
  DKK: 2,
  PLN: 2,
  BRL: 2,
  MXN: 2,
  ARS: 2,
  CLP: 0,
  COP: 0,
  KRW: 0,
  VND: 0,
  // Add more currencies as needed
};

/**
 * Default precision for unknown currencies
 */
const DEFAULT_PRECISION = 2;

/**
 * Multiplier for converting between decimal and integer representation
 */
const MULTIPLIERS: Record<string, bigint> = {};

// Pre-calculate multipliers for common currencies
for (const [currency, precision] of Object.entries(CURRENCY_PRECISION)) {
  MULTIPLIERS[currency] = 10n ** BigInt(precision);
}

// ============================================================================
// MONEY CLASS
// ============================================================================

/**
 * Money class for precise financial calculations using bigint
 */
export class MoneyValue {
  private readonly _amount: bigint;
  private readonly _currency: Currency;

  constructor(amount: bigint | number | string, currency: Currency) {
    // Convert to bigint if needed
    if (typeof amount === 'number') {
      // Check if the number is an integer
      if (!Number.isInteger(amount)) {
        throw new Error('Amount must be an integer when using number constructor');
      }
      this._amount = BigInt(amount);
    } else if (typeof amount === 'string') {
      // Parse string to bigint
      try {
        this._amount = BigInt(amount);
      } catch (e) {
        throw new Error(`Invalid amount string: ${amount}`);
      }
    } else {
      this._amount = amount;
    }

    this._currency = currency.toUpperCase();
  }

  /**
   * Create Money from decimal amount (e.g., 10.99 for $10.99)
   */
  static fromDecimal(amount: number | string, currency: Currency): MoneyValue {
    const precision = CURRENCY_PRECISION[currency] ?? DEFAULT_PRECISION;
    const multiplier = MULTIPLIERS[currency] ?? 10n ** BigInt(precision);

    let decimalAmount: string;
    if (typeof amount === 'number') {
      decimalAmount = amount.toFixed(precision);
    } else {
      decimalAmount = amount;
    }

    // Remove decimal point and convert to bigint
    const [integerPart, fractionalPart = ''] = decimalAmount.split('.');
    const paddedFractional = fractionalPart.padEnd(precision, '0').slice(0, precision);
    const amountInCents = BigInt(integerPart) * multiplier + BigInt(paddedFractional);

    return new MoneyValue(amountInCents, currency);
  }

  /**
   * Create Money from cents/integer amount
   */
  static fromCents(amount: bigint | number, currency: Currency): MoneyValue {
    return new MoneyValue(amount, currency);
  }

  /**
   * Get amount as bigint (in smallest currency unit)
   */
  get amount(): bigint {
    return this._amount;
  }

  /**
   * Get currency code
   */
  get currency(): Currency {
    return this._currency;
  }

  /**
   * Get precision for this currency
   */
  get precision(): number {
    return CURRENCY_PRECISION[this._currency] ?? DEFAULT_PRECISION;
  }

  /**
   * Get multiplier for this currency
   */
  get multiplier(): bigint {
    return MULTIPLIERS[this._currency] ?? 10n ** BigInt(this.precision);
  }

  /**
   * Convert to decimal string (e.g., "10.99")
   */
  toDecimal(options?: MoneyOptions): string {
    const precision = options?.precision ?? this.precision;
    const multiplier = 10n ** BigInt(precision);
    
    const isNegative = this._amount < 0n;
    const absAmount = this._amount < 0n ? -this._amount : this._amount;
    
    const integerPart = (absAmount / multiplier).toString();
    let fractionalPart = (absAmount % multiplier).toString();
    
    // Pad fractional part with leading zeros
    fractionalPart = fractionalPart.padStart(precision, '0');
    
    // Remove trailing zeros unless precision is explicitly set
    if (options?.precision === undefined) {
      fractionalPart = fractionalPart.replace(/0+$/, '');
    }
    
    const result = fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
    return isNegative ? `-${result}` : result;
  }

  /**
   * Convert to number (may lose precision for large amounts)
   */
  toNumber(): number {
    return Number(this.toDecimal());
  }

  /**
   * Convert to plain Money object
   */
  toObject(): Money {
    return {
      amount: this._amount,
      currency: this._currency,
    };
  }

  /**
   * Format as currency string (e.g., "$10.99", "€10.99")
   */
  format(locale?: string, options?: Intl.NumberFormatOptions): string {
    const formatter = new Intl.NumberFormat(locale || 'en-US', {
      style: 'currency',
      currency: this._currency,
      minimumFractionDigits: this.precision,
      maximumFractionDigits: this.precision,
      ...options,
    });

    return formatter.format(this.toNumber());
  }

  /**
   * Add two Money values (must have same currency)
   */
  add(other: MoneyValue): MoneyValue {
    this.assertSameCurrency(other);
    return new MoneyValue(this._amount + other._amount, this._currency);
  }

  /**
   * Subtract two Money values (must have same currency)
   */
  subtract(other: MoneyValue): MoneyValue {
    this.assertSameCurrency(other);
    return new MoneyValue(this._amount - other._amount, this._currency);
  }

  /**
   * Multiply by a number
   */
  multiply(factor: number | bigint): MoneyValue {
    const result = this._amount * BigInt(factor);
    return new MoneyValue(result, this._currency);
  }

  /**
   * Divide by a number, with rounding
   */
  divide(divisor: number | bigint, options?: MoneyOptions): MoneyValue {
    if (divisor === 0) {
      throw new Error('Division by zero');
    }

    const rounding = options?.rounding ?? 'half_even';
    const precision = options?.precision ?? this.precision;
    const multiplier = 10n ** BigInt(precision);

    const dividend = this._amount * multiplier;
    const divisorBigInt = BigInt(divisor);

    let result: bigint;
    const remainder = dividend % divisorBigInt;
    const quotient = dividend / divisorBigInt;

    if (remainder === 0n) {
      result = quotient;
    } else {
      // Apply rounding
      const isNegative = dividend < 0n;
      const absRemainder = remainder < 0n ? -remainder : remainder;
      const halfDivisor = divisorBigInt / 2n;
      
      let shouldRoundUp = false;
      
      switch (rounding) {
        case 'half_up':
          shouldRoundUp = absRemainder >= halfDivisor;
          break;
        case 'half_even':
          shouldRoundUp = absRemainder > halfDivisor || 
            (absRemainder === halfDivisor && (quotient % 2n !== 0n));
          break;
        case 'down':
          shouldRoundUp = false;
          break;
      }

      if (isNegative) {
        result = shouldRoundUp ? quotient : quotient - 1n;
      } else {
        result = shouldRoundUp ? quotient + 1n : quotient;
      }
    }

    return new MoneyValue(result, this._currency);
  }

  /**
   * Calculate percentage
   */
  percentage(percent: number): MoneyValue {
    return this.multiply(percent).divide(100);
  }

  /**
   * Compare with another Money value
   */
  compare(other: MoneyValue): number {
    this.assertSameCurrency(other);
    
    if (this._amount < other._amount) return -1;
    if (this._amount > other._amount) return 1;
    return 0;
  }

  /**
   * Check if equal to another Money value
   */
  equals(other: MoneyValue): boolean {
    return this.compare(other) === 0;
  }

  /**
   * Check if greater than another Money value
   */
  greaterThan(other: MoneyValue): boolean {
    return this.compare(other) > 0;
  }

  /**
   * Check if greater than or equal to another Money value
   */
  greaterThanOrEqual(other: MoneyValue): boolean {
    return this.compare(other) >= 0;
  }

  /**
   * Check if less than another Money value
   */
  lessThan(other: MoneyValue): boolean {
    return this.compare(other) < 0;
  }

  /**
   * Check if less than or equal to another Money value
   */
  lessThanOrEqual(other: MoneyValue): boolean {
    return this.compare(other) <= 0;
  }

  /**
   * Check if amount is zero
   */
  isZero(): boolean {
    return this._amount === 0n;
  }

  /**
   * Check if amount is positive
   */
  isPositive(): boolean {
    return this._amount > 0n;
  }

  /**
   * Check if amount is negative
   */
  isNegative(): boolean {
    return this._amount < 0n;
  }

  /**
   * Get absolute value
   */
  abs(): MoneyValue {
    return new MoneyValue(this._amount < 0n ? -this._amount : this._amount, this._currency);
  }

  /**
   * Round to specific precision
   */
  round(precision: number, rounding: MoneyOptions['rounding'] = 'half_even'): MoneyValue {
    if (precision === this.precision) {
      return this;
    }

    const factor = 10n ** BigInt(precision - this.precision);
    if (precision > this.precision) {
      return new MoneyValue(this._amount * factor, this._currency);
    } else {
      return this.divide(factor, { rounding, precision });
    }
  }

  /**
   * Allocate money to multiple parts
   */
  allocate(ratios: number[]): MoneyValue[] {
    const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
    if (total === 0) {
      throw new Error('Sum of ratios cannot be zero');
    }

    const results: MoneyValue[] = [];
    let remaining = this._amount;

    // Calculate initial allocations
    for (let i = 0; i < ratios.length - 1; i++) {
      const allocated = this._amount * BigInt(ratios[i]) / BigInt(total);
      results.push(new MoneyValue(allocated, this._currency));
      remaining -= allocated;
    }

    // Give remainder to last allocation
    results.push(new MoneyValue(remaining, this._currency));

    return results;
  }

  /**
   * Split money equally
   */
  split(parts: number): MoneyValue[] {
    const ratios = new Array(parts).fill(1);
    return this.allocate(ratios);
  }

  /**
   * Assert that currencies match
   */
  private assertSameCurrency(other: MoneyValue): void {
    if (this._currency !== other._currency) {
      throw new Error(`Currency mismatch: ${this._currency} != ${other._currency}`);
    }
  }

  /**
   * String representation
   */
  toString(): string {
    return `${this.toDecimal()} ${this._currency}`;
  }

  /**
   * JSON representation
   */
  toJSON(): Money {
    return this.toObject();
  }

  /**
   * Create a copy
   */
  clone(): MoneyValue {
    return new MoneyValue(this._amount, this._currency);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create Money from decimal amount
 */
export function money(amount: number | string, currency: Currency): MoneyValue {
  return MoneyValue.fromDecimal(amount, currency);
}

/**
 * Create Money from cents
 */
export function cents(amount: bigint | number, currency: Currency): MoneyValue {
  return MoneyValue.fromCents(amount, currency);
}

/**
 * Calculate tax amount
 */
export function calculateTax(baseAmount: MoneyValue, taxRate: number): MoneyValue {
  return baseAmount.percentage(taxRate);
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(baseAmount: MoneyValue, discountRate: number): MoneyValue {
  return baseAmount.percentage(discountRate);
}

/**
 * Calculate total with tax and discounts
 */
export function calculateTotal(
  subtotal: MoneyValue,
  taxRate: number = 0,
  discountRate: number = 0
): { subtotal: MoneyValue; tax: MoneyValue; discount: MoneyValue; total: MoneyValue } {
  const tax = calculateTax(subtotal, taxRate);
  const discount = calculateDiscount(subtotal, discountRate);
  const total = subtotal.add(tax).subtract(discount);

  return { subtotal, tax, discount, total };
}

/**
 * Exchange currency (requires exchange rate)
 */
export function exchangeCurrency(
  amount: MoneyValue,
  targetCurrency: Currency,
  exchangeRate: number // 1 source currency = exchangeRate target currency
): MoneyValue {
  const exchangedAmount = amount.multiply(exchangeRate);
  return new MoneyValue(exchangedAmount.amount, targetCurrency);
}

/**
 * Validate currency code
 */
export function isValidCurrency(currency: string): currency is Currency {
  return /^[A-Z]{3}$/.test(currency);
}

/**
 * Get currency precision
 */
export function getCurrencyPrecision(currency: Currency): number {
  return CURRENCY_PRECISION[currency] ?? DEFAULT_PRECISION;
}
