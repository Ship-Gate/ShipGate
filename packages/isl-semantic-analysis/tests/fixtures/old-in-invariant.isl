// Fixture: old() used in invariants
// Expected Error: E0304 - old() cannot be used in invariants

domain TestDomain {
  version: "1.0.0"

  entity Counter {
    id: UUID [immutable, unique]
    value: Int
  }

  behavior Increment {
    input {
      counterId: UUID
    }
    output {
      success: Int
    }
    
    invariants {
      old(value) >= 0  // E0304: old() invalid in invariants
    }
    
    postconditions {
      success implies {
        result == old(value) + 1  // Valid: old() OK in postconditions
      }
    }
  }
}
