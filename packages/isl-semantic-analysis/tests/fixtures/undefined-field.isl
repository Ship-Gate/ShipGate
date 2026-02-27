// Fixture: References a non-existent field on input
// Expected Error: E0202 - Field 'nonExistentField' does not exist on type 'input'

domain TestDomain {
  version: "1.0.0"

  behavior Transfer {
    input {
      amount: Decimal
      fromAccount: UUID
    }
    output {
      success: Boolean
    }
    
    preconditions {
      input.nonExistentField > 0  // Error: nonExistentField not in input
    }
  }
}
