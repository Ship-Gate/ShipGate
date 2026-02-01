// Semantic error: invalid constraint values

domain InvalidConstraint {
  version: "1.0.0"
  
  // Negative length constraint
  type InvalidString = String {
    min_length: -5
    max_length: 10
  }
  
  // Min greater than max
  type InvalidRange = Int {
    min: 100
    max: 10
  }
  
  // Invalid precision
  type InvalidDecimal = Decimal {
    precision: -2
  }
  
  // Invalid format value
  type InvalidFormat = String {
    format: nonexistent_format
  }
  
  // Constraint on non-constrainable type
  type InvalidBoolean = Boolean {
    min: 0
    max: 1
  }
}
