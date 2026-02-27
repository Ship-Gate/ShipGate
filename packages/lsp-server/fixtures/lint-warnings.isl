// File with various semantic lint issues for testing
domain LintWarnings {
  version: "1.0.0"

  // Unused type (ISL1003)
  type UnusedType = String { max_length: 100 }

  // Entity without id field (ISL1011)
  entity NoIdEntity {
    name: String
    email: String
  }

  // Entity with sensitive field without constraints (ISL1020)
  entity UserWithPassword {
    id: UUID
    password: String
    apiKey: String
  }

  // Behavior without postconditions (ISL1001)
  // Behavior without description (ISL1010)
  // State-modifying without temporal (ISL1012)
  // State-modifying without security (ISL1021)
  // No scenarios (ISL1013)
  behavior CreateNoPost {
    input {
      name: String
    }

    output {
      success: Boolean
    }

    preconditions {
      name != null
    }
  }

  // Behavior with precondition but no error cases (ISL1002)
  behavior CheckSomething {
    description: "Check something"

    input {
      value: Int
    }

    output {
      success: Boolean
    }

    preconditions {
      value > 0
      value < 1000
    }

    postconditions {
      success implies {
        result == true
      }
    }
  }

  // Behavior returning list without pagination (ISL1031)
  behavior ListItems {
    description: "List all items"

    input {
      filter: String?
    }

    output {
      success: List<String>
    }

    postconditions {
      success implies {
        result != null
      }
    }
  }

  // Reference to non-existent behavior in scenarios (ISL1004)
  scenarios NonExistentBehavior {
    scenario "Test something" {
      when {
        result = NonExistentBehavior()
      }

      then {
        result != null
      }
    }
  }
}
