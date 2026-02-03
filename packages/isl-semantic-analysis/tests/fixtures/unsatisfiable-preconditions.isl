/**
 * Test Fixture: Unsatisfiable Preconditions
 * 
 * Contains examples of preconditions that can never be satisfied,
 * which should trigger E0310 diagnostics.
 */

domain UnsatisfiablePreconditions version "1.0.0"

/**
 * Example 1: Contradictory numeric bounds
 * The condition amount > 1000 AND amount < 100 is impossible.
 */
behavior TransferWithBadBounds {
  input {
    amount: Decimal
  }
  output {
    success: Boolean
  }
  
  preconditions {
    input.amount > 1000 and input.amount < 100  // E0310: unsatisfiable
  }
}

/**
 * Example 2: Equal bounds with exclusive operators
 * The condition value > 5 AND value < 5 excludes all values.
 */
behavior ExclusiveEqualBounds {
  input {
    value: Int
  }
  output {
    success: Boolean
  }
  
  preconditions {
    input.value > 5 and input.value < 5  // E0310: no value can be > 5 AND < 5
  }
}

/**
 * Example 3: Multiple conflicting constraints on same variable
 */
behavior MultipleConflicts {
  input {
    x: Int
    y: Int
  }
  output {
    success: Boolean
  }
  
  preconditions {
    input.x > 100 and input.x >= 0 and input.x < 50  // E0310: > 100 conflicts with < 50
  }
}
