// Type-error spec fixture: Contains type mismatches
domain BadTypes {
  version: "1.0.0"

  entity Account {
    id: UUID [immutable]
    balance: Int
    name: String
  }

  behavior Withdraw {
    description: "Withdraw from an account"

    input {
      account_id: UUID
      amount: Int
    }

    output {
      success: {
        new_balance: Int
      }

      errors {
        INSUFFICIENT_FUNDS {
          when: "Balance too low"
          retriable: false
        }
      }
    }

    preconditions {
      input.amount > 0
    }

    postconditions {
      success implies {
        result.new_balance >= 0
      }
    }
  }
}
