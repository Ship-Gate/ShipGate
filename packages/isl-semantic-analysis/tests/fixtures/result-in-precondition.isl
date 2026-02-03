// Fixture: result referenced in preconditions
// Expected Error: E0311 - result cannot be referenced in preconditions

domain TestDomain {
  version: "1.0.0"

  behavior BadResultRef {
    input {
      amount: Decimal
    }
    output {
      success: { total: Decimal }
    }
    
    preconditions {
      result.total > 0  // E0311: result doesn't exist in preconditions
    }
    
    postconditions {
      success implies {
        result.total == input.amount  // Valid: result is OK in postconditions
      }
    }
  }
}
