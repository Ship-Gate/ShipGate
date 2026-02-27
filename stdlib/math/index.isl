# Math Standard Library Module
# Provides mathematical operations
#
# DETERMINISM NOTE:
# All functions in this module are DETERMINISTIC

module Math version "1.0.0"

# ============================================
# Types
# ============================================

type PositiveInt = Int {
  min: 1
  description: "Positive integer (> 0)"
}

type NonNegativeInt = Int {
  min: 0
  description: "Non-negative integer (>= 0)"
}

type Percentage = Number {
  min: 0
  max: 100
  description: "Percentage value (0-100)"
}

type UnitInterval = Number {
  min: 0
  max: 1
  description: "Unit interval value (0-1)"
}

type RoundingMode = enum {
  HALF_UP      # Round half away from zero (default)
  HALF_DOWN    # Round half towards zero
  HALF_EVEN    # Round half to even (banker's rounding)
  FLOOR        # Round towards negative infinity
  CEIL         # Round towards positive infinity
  TRUNC        # Round towards zero
}

# ============================================
# Entities
# ============================================

entity NumericRange {
  min: Number
  max: Number
  inclusive_min: Boolean [default: true]
  inclusive_max: Boolean [default: true]
  
  invariants {
    min <= max
  }
}

entity StatisticsResult {
  count: NonNegativeInt
  sum: Number
  average: Number?
  min: Number?
  max: Number?
  variance: Number?
  std_dev: Number?
  
  invariants {
    count == 0 implies average == null
    count == 0 implies min == null
    count == 0 implies max == null
  }
}

# ============================================
# Behaviors - Basic Operations
# ============================================

behavior Abs {
  description: "Get absolute value of a number (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
  }

  output {
    success: Number
  }

  post success {
    result >= 0
    result == value or result == -value
  }
}

behavior Sign {
  description: "Get sign of a number (-1, 0, or 1) (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
  }

  output {
    success: Int { min: -1, max: 1 }
  }

  post success {
    input.value > 0 implies result == 1
    input.value == 0 implies result == 0
    input.value < 0 implies result == -1
  }
}

behavior Min {
  description: "Get minimum of two numbers (DETERMINISTIC)"
  deterministic: true

  input {
    a: Number
    b: Number
  }

  output {
    success: Number
  }

  post success {
    result <= input.a
    result <= input.b
    result == input.a or result == input.b
  }
}

behavior Max {
  description: "Get maximum of two numbers (DETERMINISTIC)"
  deterministic: true

  input {
    a: Number
    b: Number
  }

  output {
    success: Number
  }

  post success {
    result >= input.a
    result >= input.b
    result == input.a or result == input.b
  }
}

behavior Clamp {
  description: "Clamp value to range [min, max] (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
    min: Number
    max: Number
  }

  output {
    success: Number
  }

  pre {
    min <= max
  }

  post success {
    result >= input.min
    result <= input.max
    input.value < input.min implies result == input.min
    input.value > input.max implies result == input.max
    input.value >= input.min and input.value <= input.max implies result == input.value
  }
}

# ============================================
# Behaviors - Rounding Operations
# ============================================

behavior Floor {
  description: "Round towards negative infinity (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
  }

  output {
    success: Int
  }

  post success {
    result <= input.value
    result > input.value - 1
  }
}

behavior Ceil {
  description: "Round towards positive infinity (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
  }

  output {
    success: Int
  }

  post success {
    result >= input.value
    result < input.value + 1
  }
}

behavior Round {
  description: "Round to nearest integer (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
    mode: RoundingMode [default: HALF_UP]
  }

  output {
    success: Int
  }

  post success {
    Abs(result - input.value) <= 0.5
  }
}

behavior RoundTo {
  description: "Round to specified decimal places (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
    decimals: NonNegativeInt
    mode: RoundingMode [default: HALF_UP]
  }

  output {
    success: Number
  }

  pre {
    decimals >= 0
    decimals <= 15
  }
}

behavior Trunc {
  description: "Truncate towards zero (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
  }

  output {
    success: Int
  }

  post success {
    Abs(result) <= Abs(input.value)
  }
}

# ============================================
# Behaviors - Arithmetic Operations
# ============================================

behavior Add {
  description: "Add two numbers (DETERMINISTIC)"
  deterministic: true

  input {
    a: Number
    b: Number
  }

  output {
    success: Number
  }

  post success {
    result == input.a + input.b
  }
}

behavior Subtract {
  description: "Subtract two numbers (DETERMINISTIC)"
  deterministic: true

  input {
    a: Number
    b: Number
  }

  output {
    success: Number
  }

  post success {
    result == input.a - input.b
  }
}

behavior Multiply {
  description: "Multiply two numbers (DETERMINISTIC)"
  deterministic: true

  input {
    a: Number
    b: Number
  }

  output {
    success: Number
  }

  post success {
    result == input.a * input.b
  }
}

behavior Divide {
  description: "Divide two numbers (DETERMINISTIC)"
  deterministic: true

  input {
    a: Number
    b: Number
  }

  output {
    success: Number

    errors {
      DIVISION_BY_ZERO {
        when: "Divisor is zero"
        retriable: false
      }
    }
  }

  pre {
    b != 0
  }

  post success {
    Abs(result * input.b - input.a) < 0.0000001
  }
}

behavior Mod {
  description: "Modulo operation (DETERMINISTIC)"
  deterministic: true

  input {
    a: Number
    b: Number
  }

  output {
    success: Number

    errors {
      DIVISION_BY_ZERO {
        when: "Divisor is zero"
        retriable: false
      }
    }
  }

  pre {
    b != 0
  }

  post success {
    Abs(result) < Abs(input.b)
  }
}

behavior Pow {
  description: "Raise to power (DETERMINISTIC)"
  deterministic: true

  input {
    base: Number
    exponent: Number
  }

  output {
    success: Number

    errors {
      INVALID_EXPONENT {
        when: "Negative base with non-integer exponent"
        retriable: false
      }
    }
  }
}

behavior Sqrt {
  description: "Square root (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
  }

  output {
    success: Number

    errors {
      NEGATIVE_VALUE {
        when: "Cannot take square root of negative number"
        retriable: false
      }
    }
  }

  pre {
    value >= 0
  }

  post success {
    result >= 0
    Abs(result * result - input.value) < 0.0000001
  }
}

# ============================================
# Behaviors - Safe Arithmetic (Overflow Protection)
# ============================================

behavior SafeAdd {
  description: "Add with overflow protection (DETERMINISTIC)"
  deterministic: true

  input {
    a: Int
    b: Int
    max_value: Int [default: 9007199254740991]  # MAX_SAFE_INTEGER
    min_value: Int [default: -9007199254740991] # MIN_SAFE_INTEGER
  }

  output {
    success: Int

    errors {
      OVERFLOW {
        when: "Result exceeds max_value"
        retriable: false
      }
      UNDERFLOW {
        when: "Result is below min_value"
        retriable: false
      }
    }
  }

  post success {
    result >= input.min_value
    result <= input.max_value
  }
}

behavior SafeSubtract {
  description: "Subtract with underflow protection (DETERMINISTIC)"
  deterministic: true

  input {
    a: Int
    b: Int
    max_value: Int [default: 9007199254740991]
    min_value: Int [default: -9007199254740991]
  }

  output {
    success: Int

    errors {
      OVERFLOW {
        when: "Result exceeds max_value"
        retriable: false
      }
      UNDERFLOW {
        when: "Result is below min_value"
        retriable: false
      }
    }
  }

  post success {
    result >= input.min_value
    result <= input.max_value
  }
}

behavior SafeMultiply {
  description: "Multiply with overflow protection (DETERMINISTIC)"
  deterministic: true

  input {
    a: Int
    b: Int
    max_value: Int [default: 9007199254740991]
    min_value: Int [default: -9007199254740991]
  }

  output {
    success: Int

    errors {
      OVERFLOW {
        when: "Result exceeds safe integer range"
        retriable: false
      }
    }
  }

  post success {
    result >= input.min_value
    result <= input.max_value
  }
}

# ============================================
# Behaviors - Comparison Operations
# ============================================

behavior Approximately {
  description: "Check if two numbers are approximately equal (DETERMINISTIC)"
  deterministic: true

  input {
    a: Number
    b: Number
    epsilon: Number [default: 0.0000001]
  }

  output {
    success: Boolean
  }

  pre {
    epsilon > 0
  }

  post success {
    result == (Abs(input.a - input.b) <= input.epsilon)
  }
}

behavior IsPositive {
  description: "Check if number is positive (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
  }

  output {
    success: Boolean
  }

  post success {
    result == (input.value > 0)
  }
}

behavior IsNegative {
  description: "Check if number is negative (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
  }

  output {
    success: Boolean
  }

  post success {
    result == (input.value < 0)
  }
}

behavior IsZero {
  description: "Check if number is zero (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
    epsilon: Number [default: 0]
  }

  output {
    success: Boolean
  }

  post success {
    input.epsilon == 0 implies result == (input.value == 0)
    input.epsilon > 0 implies result == (Abs(input.value) <= input.epsilon)
  }
}

behavior IsInteger {
  description: "Check if number is an integer (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
  }

  output {
    success: Boolean
  }

  post success {
    result == (Floor(input.value) == input.value)
  }
}

behavior IsFinite {
  description: "Check if number is finite (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
  }

  output {
    success: Boolean
  }
}

# ============================================
# Behaviors - Range Operations
# ============================================

behavior InRange {
  description: "Check if value is within range (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
    min: Number
    max: Number
    inclusive: Boolean [default: true]
  }

  output {
    success: Boolean
  }

  pre {
    min <= max
  }

  post success {
    input.inclusive implies result == (input.value >= input.min and input.value <= input.max)
    not input.inclusive implies result == (input.value > input.min and input.value < input.max)
  }
}

behavior Lerp {
  description: "Linear interpolation between two values (DETERMINISTIC)"
  deterministic: true

  input {
    a: Number
    b: Number
    t: UnitInterval
  }

  output {
    success: Number
  }

  pre {
    t >= 0
    t <= 1
  }

  post success {
    input.t == 0 implies result == input.a
    input.t == 1 implies result == input.b
    Approximately(result, input.a + (input.b - input.a) * input.t)
  }
}

behavior InverseLerp {
  description: "Inverse linear interpolation (find t for value) (DETERMINISTIC)"
  deterministic: true

  input {
    a: Number
    b: Number
    value: Number
  }

  output {
    success: UnitInterval

    errors {
      INVALID_RANGE {
        when: "a equals b (cannot interpolate)"
        retriable: false
      }
    }
  }

  pre {
    a != b
  }

  post success {
    result >= 0
    result <= 1
  }
}

# ============================================
# Behaviors - Statistics Operations
# ============================================

behavior Sum {
  description: "Calculate sum of numbers (DETERMINISTIC)"
  deterministic: true

  input {
    values: List<Number>
  }

  output {
    success: Number
  }

  post success {
    input.values.length == 0 implies result == 0
  }
}

behavior Average {
  description: "Calculate arithmetic mean (DETERMINISTIC)"
  deterministic: true

  input {
    values: List<Number>
  }

  output {
    success: Number?
  }

  post success {
    input.values.length == 0 implies result == null
    input.values.length > 0 implies result == Sum(input.values) / input.values.length
  }
}

behavior Median {
  description: "Calculate median value (DETERMINISTIC)"
  deterministic: true

  input {
    values: List<Number>
  }

  output {
    success: Number?
  }

  post success {
    input.values.length == 0 implies result == null
  }
}

behavior Variance {
  description: "Calculate population variance (DETERMINISTIC)"
  deterministic: true

  input {
    values: List<Number>
    sample: Boolean [default: false]
  }

  output {
    success: Number?
  }

  post success {
    input.values.length == 0 implies result == null
    result != null implies result >= 0
  }
}

behavior StdDev {
  description: "Calculate standard deviation (DETERMINISTIC)"
  deterministic: true

  input {
    values: List<Number>
    sample: Boolean [default: false]
  }

  output {
    success: Number?
  }

  post success {
    input.values.length == 0 implies result == null
    result != null implies result >= 0
  }
}

behavior MinOf {
  description: "Find minimum value in list (DETERMINISTIC)"
  deterministic: true

  input {
    values: List<Number>
  }

  output {
    success: Number?
  }

  post success {
    input.values.length == 0 implies result == null
    result != null implies forall v in input.values: result <= v
  }
}

behavior MaxOf {
  description: "Find maximum value in list (DETERMINISTIC)"
  deterministic: true

  input {
    values: List<Number>
  }

  output {
    success: Number?
  }

  post success {
    input.values.length == 0 implies result == null
    result != null implies forall v in input.values: result >= v
  }
}

behavior Statistics {
  description: "Calculate comprehensive statistics (DETERMINISTIC)"
  deterministic: true

  input {
    values: List<Number>
    include_variance: Boolean [default: true]
  }

  output {
    success: StatisticsResult
  }

  post success {
    result.count == input.values.length
  }
}

# ============================================
# Behaviors - Financial Operations
# ============================================

behavior Percentage {
  description: "Calculate percentage of a value (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
    percent: Percentage
  }

  output {
    success: Number
  }

  post success {
    Approximately(result, input.value * input.percent / 100)
  }
}

behavior PercentageOf {
  description: "Calculate what percentage a is of b (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
    total: Number
  }

  output {
    success: Percentage

    errors {
      DIVISION_BY_ZERO {
        when: "Total is zero"
        retriable: false
      }
    }
  }

  pre {
    total != 0
  }

  post success {
    result >= 0
    result <= 100 or input.value > input.total
  }
}

behavior RoundCurrency {
  description: "Round to currency precision (2 decimals) (DETERMINISTIC)"
  deterministic: true

  input {
    value: Number
    mode: RoundingMode [default: HALF_EVEN]
  }

  output {
    success: Number
  }

  post success {
    # Result has at most 2 decimal places
    Approximately(RoundTo(result, 2), result)
  }
}

behavior DiscountedPrice {
  description: "Calculate price after discount (DETERMINISTIC)"
  deterministic: true

  input {
    price: Number
    discount_percent: Percentage
  }

  output {
    success: Number
  }

  pre {
    price >= 0
    discount_percent >= 0
    discount_percent <= 100
  }

  post success {
    result >= 0
    result <= input.price
    Approximately(result, input.price * (100 - input.discount_percent) / 100)
  }
}

# ============================================
# Constants
# ============================================

const PI: Number = 3.141592653589793
const E: Number = 2.718281828459045
const SQRT2: Number = 1.4142135623730951
const LN2: Number = 0.6931471805599453
const LN10: Number = 2.302585092994046
const MAX_SAFE_INTEGER: Int = 9007199254740991
const MIN_SAFE_INTEGER: Int = -9007199254740991
const EPSILON: Number = 0.0000001
