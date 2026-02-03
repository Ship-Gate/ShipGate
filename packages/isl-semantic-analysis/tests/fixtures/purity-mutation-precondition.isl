// Fixture: Mutation in precondition (forbidden)
// Expected Error: E0400 - Side effect in precondition
// Pass: purity-constraints

domain PurityTest {
  version: "1.0.0"

  entity Account {
    id: UUID [immutable]
    balance: Decimal
  }

  behavior Withdraw {
    input {
      accountId: UUID
      amount: Decimal
    }
    output {
      success: Account
      errors: [InsufficientFunds]
    }

    preconditions {
      // E0400: Mutating method 'update()' cannot be called in preconditions
      account.update(amount) == true
      
      // E0400: Mutating method 'save()' cannot be called in preconditions
      account.save()
    }

    postconditions {
      when success {
        result.balance == old(account.balance) - input.amount
      }
    }
  }
}
