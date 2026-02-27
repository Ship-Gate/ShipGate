/**
 * Test Fixture: Output Referenced in Preconditions
 * 
 * Contains examples of preconditions that incorrectly reference
 * result/output, which should trigger E0311 diagnostics.
 */

domain OutputInPrecondition version "1.0.0"

/**
 * Example 1: Direct result reference in precondition
 * result doesn't exist when preconditions are checked.
 */
behavior BadResultReference {
  input {
    value: Decimal
  }
  output {
    success: { total: Decimal }
  }
  
  preconditions {
    result.total > 0  // E0311: result doesn't exist in preconditions
  }
}

/**
 * Example 2: Using result keyword directly
 */
behavior ResultKeywordInPrecond {
  input {
    data: String
  }
  output {
    success: Boolean
  }
  
  preconditions {
    result == true  // E0311: result doesn't exist yet
  }
}

/**
 * Example 3: Nested result reference
 */
behavior NestedResultReference {
  input {
    count: Int
  }
  output {
    success: { items: List<String>, total: Int }
  }
  
  preconditions {
    result.items.length > 0 and result.total > input.count  // E0311
  }
}
