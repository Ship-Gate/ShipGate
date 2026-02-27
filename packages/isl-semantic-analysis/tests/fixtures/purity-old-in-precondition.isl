// Fixture: old() used in precondition (forbidden)
// Expected Error: E0411 - old() cannot be used in preconditions
// Pass: purity-constraints

domain PurityOldTest {
  version: "1.0.0"

  entity Counter {
    id: UUID [immutable]
    value: Int
  }

  behavior Increment {
    input {
      counterId: UUID
    }
    output {
      success: Counter
    }

    preconditions {
      // E0411: 'old()' cannot be used in preconditions
      old(counter.value) >= 0
    }

    postconditions {
      when success {
        result.value == old(counter.value) + 1  // This is correct
      }
    }
  }
}
