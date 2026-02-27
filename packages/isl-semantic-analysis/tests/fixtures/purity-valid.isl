// Fixture: Valid purity - no violations
// Expected: No diagnostics from purity-constraints pass
// Pass: purity-constraints

domain ValidPurityTest {
  version: "1.0.0"

  entity Account {
    id: UUID [immutable]
    balance: Decimal
    isActive: Boolean
  }

  behavior Transfer {
    input {
      fromAccountId: UUID
      toAccountId: UUID
      amount: Decimal
    }
    output {
      success: { fromBalance: Decimal, toBalance: Decimal }
      errors: [InsufficientFunds, AccountNotFound, SameAccount]
    }

    preconditions {
      // Pure expressions - all valid
      input.amount > 0
      input.fromAccountId != input.toAccountId
      fromAccount.isActive == true
      toAccount.isActive == true
      fromAccount.balance >= input.amount
    }

    postconditions {
      when success {
        // old() is valid in postconditions
        result.fromBalance == old(fromAccount.balance) - input.amount
        result.toBalance == old(toAccount.balance) + input.amount
      }
      when InsufficientFunds {
        // Error case - balance unchanged
        fromAccount.balance == old(fromAccount.balance)
      }
      when AccountNotFound {
        true  // Simple assertion
      }
      when SameAccount {
        true
      }
    }
  }
}
