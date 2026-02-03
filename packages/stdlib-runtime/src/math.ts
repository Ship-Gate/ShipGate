/**
 * ISL Standard Library - Math Module
 * Provides mathematical operations
 * 
 * DETERMINISM: 100% deterministic - all functions produce same output for same input
 */

// ============================================
// Types
// ============================================

export type RoundingMode = 'HALF_UP' | 'HALF_DOWN' | 'HALF_EVEN' | 'FLOOR' | 'CEIL' | 'TRUNC';

export interface NumericRange {
  min: number;
  max: number;
  inclusive_min?: boolean;
  inclusive_max?: boolean;
}

export interface StatisticsResult {
  count: number;
  sum: number;
  average: number | null;
  min: number | null;
  max: number | null;
  variance: number | null;
  std_dev: number | null;
}

// ============================================
// Basic Operations
// ============================================

export function abs(value: number): number {
  return Math.abs(value);
}

export function sign(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

export function min(a: number, b: number): number {
  return Math.min(a, b);
}

export function max(a: number, b: number): number {
  return Math.max(a, b);
}

export function clamp(value: number, minVal: number, maxVal: number): number {
  if (minVal > maxVal) {
    throw new Error('min must be less than or equal to max');
  }
  return Math.min(Math.max(value, minVal), maxVal);
}

// ============================================
// Rounding Operations
// ============================================

export function floor(value: number): number {
  return Math.floor(value);
}

export function ceil(value: number): number {
  return Math.ceil(value);
}

export function round(value: number, mode: RoundingMode = 'HALF_UP'): number {
  switch (mode) {
    case 'HALF_UP':
      return Math.round(value);
    case 'HALF_DOWN':
      return value >= 0 
        ? Math.ceil(value - 0.5) 
        : Math.floor(value + 0.5);
    case 'HALF_EVEN':
      const rounded = Math.round(value);
      const diff = Math.abs(value - rounded);
      if (Math.abs(diff - 0.5) < Number.EPSILON) {
        return rounded % 2 === 0 ? rounded : rounded - Math.sign(value);
      }
      return rounded;
    case 'FLOOR':
      return Math.floor(value);
    case 'CEIL':
      return Math.ceil(value);
    case 'TRUNC':
      return Math.trunc(value);
    default:
      return Math.round(value);
  }
}

export function roundTo(value: number, decimals: number, mode: RoundingMode = 'HALF_UP'): number {
  if (decimals < 0 || decimals > 15) {
    throw new Error('decimals must be between 0 and 15');
  }
  const multiplier = Math.pow(10, decimals);
  return round(value * multiplier, mode) / multiplier;
}

export function trunc(value: number): number {
  return Math.trunc(value);
}

// ============================================
// Arithmetic Operations
// ============================================

export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('DIVISION_BY_ZERO: Divisor is zero');
  }
  return a / b;
}

export function mod(a: number, b: number): number {
  if (b === 0) {
    throw new Error('DIVISION_BY_ZERO: Divisor is zero');
  }
  return a % b;
}

export function pow(base: number, exponent: number): number {
  if (base < 0 && !Number.isInteger(exponent)) {
    throw new Error('INVALID_EXPONENT: Negative base with non-integer exponent');
  }
  return Math.pow(base, exponent);
}

export function sqrt(value: number): number {
  if (value < 0) {
    throw new Error('NEGATIVE_VALUE: Cannot take square root of negative number');
  }
  return Math.sqrt(value);
}

// ============================================
// Safe Arithmetic (Overflow Protection)
// ============================================

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;

export function safeAdd(
  a: number, 
  b: number, 
  maxValue = MAX_SAFE_INTEGER, 
  minValue = MIN_SAFE_INTEGER
): number {
  const result = a + b;
  if (result > maxValue) {
    throw new Error('OVERFLOW: Result exceeds max_value');
  }
  if (result < minValue) {
    throw new Error('UNDERFLOW: Result is below min_value');
  }
  return result;
}

export function safeSubtract(
  a: number, 
  b: number, 
  maxValue = MAX_SAFE_INTEGER, 
  minValue = MIN_SAFE_INTEGER
): number {
  const result = a - b;
  if (result > maxValue) {
    throw new Error('OVERFLOW: Result exceeds max_value');
  }
  if (result < minValue) {
    throw new Error('UNDERFLOW: Result is below min_value');
  }
  return result;
}

export function safeMultiply(
  a: number, 
  b: number, 
  maxValue = MAX_SAFE_INTEGER, 
  minValue = MIN_SAFE_INTEGER
): number {
  const result = a * b;
  if (result > maxValue || result < minValue) {
    throw new Error('OVERFLOW: Result exceeds safe integer range');
  }
  return result;
}

// ============================================
// Comparison Operations
// ============================================

export function approximately(a: number, b: number, epsilon = 1e-7): boolean {
  return Math.abs(a - b) <= epsilon;
}

export function isPositive(value: number): boolean {
  return value > 0;
}

export function isNegative(value: number): boolean {
  return value < 0;
}

export function isZero(value: number, epsilon = 0): boolean {
  return epsilon === 0 ? value === 0 : Math.abs(value) <= epsilon;
}

export function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

export function isFiniteNum(value: number): boolean {
  return Number.isFinite(value);
}

// ============================================
// Range Operations
// ============================================

export function inRange(value: number, minVal: number, maxVal: number, inclusive = true): boolean {
  if (minVal > maxVal) {
    throw new Error('min must be less than or equal to max');
  }
  if (inclusive) {
    return value >= minVal && value <= maxVal;
  }
  return value > minVal && value < maxVal;
}

export function lerp(a: number, b: number, t: number): number {
  if (t < 0 || t > 1) {
    throw new Error('t must be between 0 and 1');
  }
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) {
    throw new Error('INVALID_RANGE: a equals b (cannot interpolate)');
  }
  return clamp((value - a) / (b - a), 0, 1);
}

// ============================================
// Statistics Operations
// ============================================

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return sum(values) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid] ?? null;
}

export function variance(values: number[], sample = false): number | null {
  if (values.length === 0) return null;
  const avg = average(values);
  if (avg === null) return null;
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  const divisor = sample ? values.length - 1 : values.length;
  if (divisor === 0) return null;
  return sum(squaredDiffs) / divisor;
}

export function stdDev(values: number[], sample = false): number | null {
  const v = variance(values, sample);
  if (v === null) return null;
  return Math.sqrt(v);
}

export function minOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.min(...values);
}

export function maxOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.max(...values);
}

export function statistics(values: number[], includeVariance = true): StatisticsResult {
  const count = values.length;
  const s = sum(values);
  const avg = average(values);
  const minVal = minOf(values);
  const maxVal = maxOf(values);
  
  let v: number | null = null;
  let sd: number | null = null;
  
  if (includeVariance) {
    v = variance(values);
    sd = stdDev(values);
  }
  
  return {
    count,
    sum: s,
    average: avg,
    min: minVal,
    max: maxVal,
    variance: v,
    std_dev: sd,
  };
}

// ============================================
// Financial Operations
// ============================================

export function percentage(value: number, percent: number): number {
  return value * percent / 100;
}

export function percentageOf(value: number, total: number): number {
  if (total === 0) {
    throw new Error('DIVISION_BY_ZERO: Total is zero');
  }
  return (value / total) * 100;
}

export function roundCurrency(value: number, mode: RoundingMode = 'HALF_EVEN'): number {
  return roundTo(value, 2, mode);
}

export function discountedPrice(price: number, discountPercent: number): number {
  if (price < 0) {
    throw new Error('Price must be non-negative');
  }
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount percent must be between 0 and 100');
  }
  return price * (100 - discountPercent) / 100;
}

// ============================================
// Constants
// ============================================

export const PI = Math.PI;
export const E = Math.E;
export const SQRT2 = Math.SQRT2;
export const LN2 = Math.LN2;
export const LN10 = Math.LN10;
export const EPSILON = 1e-7;

// ============================================
// Default Export
// ============================================

export const Math_ = {
  abs,
  sign,
  min,
  max,
  clamp,
  floor,
  ceil,
  round,
  roundTo,
  trunc,
  add,
  subtract,
  multiply,
  divide,
  mod,
  pow,
  sqrt,
  safeAdd,
  safeSubtract,
  safeMultiply,
  approximately,
  isPositive,
  isNegative,
  isZero,
  isInteger,
  isFinite: isFiniteNum,
  inRange,
  lerp,
  inverseLerp,
  sum,
  average,
  median,
  variance,
  stdDev,
  minOf,
  maxOf,
  statistics,
  percentage,
  percentageOf,
  roundCurrency,
  discountedPrice,
  PI,
  E,
  SQRT2,
  LN2,
  LN10,
  EPSILON,
  MAX_SAFE_INTEGER,
  MIN_SAFE_INTEGER,
};

export default Math_;
