// Domain with error definitions
domain ErrorHandling {
  version: "1.0.0"
  
  entity Account {
    id: UUID [immutable]
    email: String [unique]
    balance: Decimal
    status: String
    created_at: Timestamp [immutable]
  }
  
  behavior CreateAccount {
    description: "Create a new account"
    input {
      email: String
      initial_balance: Decimal?
    }
    output {
      success: Account
      errors {
        EMAIL_ALREADY_EXISTS {
          when: "Email is already registered"
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
        }
        RATE_LIMITED {
          when: "Too many requests"
        }
      }
    }
  }
  
  behavior TransferFunds {
    description: "Transfer funds between accounts"
    input {
      from_account_id: UUID
      to_account_id: UUID
      amount: Decimal
    }
    output {
      success: Account
      errors {
        ACCOUNT_NOT_FOUND {
          when: "Account does not exist"
        }
        INSUFFICIENT_FUNDS {
          when: "Not enough balance"
        }
        SAME_ACCOUNT {
          when: "Cannot transfer to same account"
        }
        INVALID_AMOUNT {
          when: "Amount must be positive"
        }
      }
    }
  }
}
