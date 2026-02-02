// Edge Case: Contradictory/impossible clauses
// This spec intentionally has contradictions and impossible conditions
// Used to test detection of specification inconsistencies

domain EdgeContradictory {
  version: "1.0.0"

  enum Status {
    ACTIVE
    INACTIVE
    DELETED
  }

  entity Resource {
    id: UUID [immutable, unique]
    name: String
    status: Status
    count: Int
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    // WARNING: Contradictory invariants
    invariants {
      count >= 0
      count <= 100
      // The following is impossible if status can be DELETED
      status != DELETED implies count > 0
    }
  }

  // WARNING: Contradictory pre/postconditions
  behavior CreateContradictory {
    description: "Create with contradictory conditions"

    actors {
      User { must: authenticated }
    }

    input {
      name: String
      initial_count: Int
    }

    output {
      success: Resource

      errors {
        INVALID {
          when: "Invalid input"
          retriable: false
        }
      }
    }

    pre {
      // Contradictory: requires count > 10 AND count < 5
      input.initial_count > 10
      input.initial_count < 5
    }

    post success {
      - Resource.exists(result.id)
    }
  }

  // WARNING: Postconditions contradict each other
  behavior UpdateContradictory {
    description: "Update with contradictory postconditions"

    actors {
      User { must: authenticated }
    }

    input {
      id: UUID
      new_count: Int
    }

    output {
      success: Resource

      errors {
        NOT_FOUND {
          when: "Not found"
          retriable: false
        }
      }
    }

    pre {
      Resource.exists(input.id)
    }

    post success {
      // Contradictory postconditions
      - result.count == input.new_count
      - result.count == 0
      - result.count > old(Resource.lookup(input.id).count)
    }
  }

  // WARNING: Impossible temporal constraints
  behavior ImpossibleTemporal {
    description: "Behavior with impossible timing"

    actors {
      User { must: authenticated }
    }

    input {
      id: UUID
    }

    output {
      success: Boolean
    }

    temporal {
      // Impossible: must respond within 0ms
      - within 0ms (p99): response returned
      // Also impossible: eventually within negative time
      - eventually within -1s: completed
    }
  }

  // WARNING: Conflicting error definitions
  behavior ConflictingErrors {
    description: "Errors with conflicting definitions"

    actors {
      User { must: authenticated }
    }

    input {
      value: Int
    }

    output {
      success: Resource

      errors {
        // Same condition, different errors
        TOO_LOW {
          when: "Value is less than 10"
          retriable: true
        }
        ALSO_TOO_LOW {
          when: "Value is less than 10"
          retriable: false
        }
        // Overlapping conditions
        IN_RANGE {
          when: "Value is between 5 and 15"
          retriable: true
        }
      }
    }

    pre {
      input.value > 0
    }
  }

  // WARNING: Lifecycle that allows impossible transitions
  behavior ImpossibleLifecycle {
    description: "Uses impossible status transitions"

    actors {
      System { }
    }

    input {
      id: UUID
    }

    output {
      success: Resource
    }

    pre {
      Resource.exists(input.id)
      Resource.lookup(input.id).status == ACTIVE
    }

    post success {
      // Tries to go from ACTIVE directly to state not in lifecycle
      - result.status == DELETED
      // Also claims it should be ACTIVE (contradiction)
      - result.status == ACTIVE
    }
  }

  scenarios CreateContradictory {
    scenario "impossible scenario" {
      when {
        // This input satisfies neither precondition
        result = CreateContradictory(name: "Test", initial_count: 7)
      }

      then {
        // This scenario can never succeed due to contradictory preconditions
        result is success
      }
    }
  }
}
