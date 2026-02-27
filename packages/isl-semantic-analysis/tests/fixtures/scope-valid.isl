// Fixture: Valid scope references (control test)
// This spec should pass with no errors

domain TestDomain {
  version: "1.0.0"

  entity Account {
    id: UUID [immutable, unique]
    balance: Decimal
    owner: String
  }

  behavior Transfer {
    input {
      fromId: UUID
      toId: UUID
      amount: Decimal
    }
    output {
      success: { transferred: Decimal }
      
      errors {
        InsufficientFunds {
          when: "Not enough balance"
          retriable: false
        }
        AccountNotFound {
          when: "Account does not exist"
          retriable: false
        }
      }
    }
    
    // Preconditions - only input and entity references
    preconditions {
      input.amount > 0
      input.fromId != input.toId
    }
    
    // Postconditions - result and old() are valid here
    postconditions {
      success implies {
        result.transferred == input.amount
        sender.balance == old(sender.balance) - input.amount
        receiver.balance == old(receiver.balance) + input.amount
      }
      
      InsufficientFunds implies {
        sender.balance == old(sender.balance)  // No change on error
      }
    }
    
    // Invariants - entity properties
    invariants {
      sender.balance >= 0
      receiver.balance >= 0
    }
  }
}
