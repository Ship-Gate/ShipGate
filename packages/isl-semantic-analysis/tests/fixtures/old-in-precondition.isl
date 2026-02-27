// Fixture: old() used in preconditions
// Expected Error: E0304 - old() cannot be used in preconditions

domain TestDomain {
  version: "1.0.0"

  entity Account {
    id: UUID [immutable, unique]
    balance: Decimal
  }

  behavior BadOldRef {
    input {
      accountId: UUID
      amount: Decimal
    }
    output {
      success: Account
    }
    
    preconditions {
      old(sender.balance) >= input.amount  // E0304: old() invalid in preconditions
    }
    
    postconditions {
      success implies {
        sender.balance == old(sender.balance) - input.amount  // Valid: old() OK in postconditions
      }
    }
  }
}
