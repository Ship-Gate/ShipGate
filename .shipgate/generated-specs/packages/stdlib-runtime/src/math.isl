# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: abs, sign, min, max, clamp, floor, ceil, round, roundTo, trunc, add, subtract, multiply, divide, mod, pow, sqrt, safeAdd, safeSubtract, safeMultiply, approximately, isPositive, isNegative, isZero, isInteger, isFiniteNum, inRange, lerp, inverseLerp, sum, average, median, variance, stdDev, minOf, maxOf, statistics, percentage, percentageOf, roundCurrency, discountedPrice, PI, E, SQRT2, LN2, LN10, EPSILON, Math_, RoundingMode, NumericRange, StatisticsResult
# dependencies: 

domain Math {
  version: "1.0.0"

  type RoundingMode = String
  type NumericRange = String
  type StatisticsResult = String

  invariants exports_present {
    - true
  }
}
