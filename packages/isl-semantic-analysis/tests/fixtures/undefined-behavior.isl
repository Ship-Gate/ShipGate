// Fixture: References a non-existent behavior in scenarios
// Expected Error: E0302 - Behavior 'NonExistentBehavior' is not defined

domain TestDomain {
  version: "1.0.0"

  entity Account {
    id: UUID [immutable, unique]
    balance: Decimal
  }

  behavior TransferMoney {
    input {
      fromId: UUID
      toId: UUID
      amount: Decimal
    }
    output {
      success: Boolean
    }
  }

  scenarios NonExistentBehavior {
    scenario "basic test" {
      given {
        x = 1
      }
      when {
        result = NonExistentBehavior()
      }
      then {
        result is success
      }
    }
  }
}
