domain Transfer {
  version: "1.0.0"

  entity Account {
    id: UUID
    balance: Int
  }

  behavior Transfer {
    input {
      fromId: UUID
      toId: UUID
      amount: Int
    }

    output {
      success: Boolean
      errors {
        INSUFFICIENT_FUNDS { when: "Not enough balance" }
        INVALID_AMOUNT { when: "Amount must be positive" }
      }
    }

    preconditions {
      - input.amount > 0
      - input.fromId != input.toId
    }

    postconditions {
      success implies {
        - result == true
      }
    }
  }
}
