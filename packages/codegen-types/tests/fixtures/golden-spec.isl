// Golden Fixture Test Specification
// This spec is used to verify cross-language codegen consistency

domain GoldenTest version "1.0.0"

// Simple entity with invariants
entity Account {
  id: UUID
  balance: Decimal
  isActive: Boolean
  
  invariants {
    balance >= 0 "Balance must be non-negative"
    isActive == true or balance == 0 "Inactive accounts must have zero balance"
  }
}

// Entity for testing references
entity User {
  id: UUID
  email: String
  accountId: UUID
}

// Enum for testing
enum TransactionType {
  CREDIT
  DEBIT
  TRANSFER
}

// Type with constraints
type PositiveAmount = Decimal { min: 0.01 }
type Email = String { pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" }

// Behavior with comprehensive contracts
behavior TransferFunds {
  "Transfer funds between accounts"
  
  input {
    senderId: UUID
    receiverId: UUID
    amount: PositiveAmount
    type: TransactionType
  }
  
  output {
    success: Account
    errors {
      INSUFFICIENT_FUNDS when "sender has insufficient balance"
      ACCOUNT_NOT_FOUND when "sender or receiver account not found"
      ACCOUNT_INACTIVE when "either account is inactive"
      INVALID_AMOUNT when "amount is not positive" retriable true
    }
  }
  
  preconditions {
    amount > 0 "Amount must be positive"
    senderId != receiverId "Cannot transfer to same account"
  }
  
  postconditions {
    success implies {
      result.balance >= 0 "Resulting balance must be non-negative"
      Account.exists(senderId) "Sender account must still exist"
      Account.exists(receiverId) "Receiver account must still exist"
    }
    failure implies {
      old(Account.lookup(senderId)).balance == Account.lookup(senderId).balance 
        "Failed transfer should not change sender balance"
    }
  }
}

// Simple behavior for testing
behavior GetAccountBalance {
  input {
    accountId: UUID
  }
  
  output {
    success: Decimal
    errors {
      NOT_FOUND when "account does not exist"
    }
  }
  
  preconditions {
    Account.exists(accountId) "Account must exist"
  }
  
  postconditions {
    success implies {
      result >= 0 "Balance must be non-negative"
    }
  }
}

// Invariants block
invariants DataIntegrity {
  "Ensures data consistency across the domain"
  
  all account in Account.all(): account.balance >= 0
    "All accounts must have non-negative balance"
}
