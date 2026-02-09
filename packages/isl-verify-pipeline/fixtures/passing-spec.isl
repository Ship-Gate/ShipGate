// Passing spec fixture: Simple Greeting domain
// All postconditions are straightforward and should verify
domain Greeting {
  version: "1.0.0"

  entity GreetingLog {
    id: UUID [immutable]
    name: String
    message: String
    created_at: Timestamp [immutable]
  }

  behavior Greet {
    description: "Greet a user by name"

    input {
      name: String
    }

    output {
      success: {
        message: String
      }

      errors {
        EMPTY_NAME {
          when: "Name is empty"
          retriable: false
        }
      }
    }

    preconditions {
      input.name.length > 0
    }

    postconditions {
      success implies {
        result.message != null
      }

      EMPTY_NAME implies {
        result == null
      }
    }
  }
}
