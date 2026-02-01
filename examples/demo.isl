# Demo Domain - Counter Service
# A simple but complete example to demonstrate the ISL pipeline

domain Counter {
  version: "1.0.0"

  # Simple counter entity
  entity CounterValue {
    id: UUID [immutable, unique]
    value: Int [default: 0]
    max_value: Int [default: 100]
    created_at: Timestamp [immutable]
  }

  # Increment the counter
  behavior Increment {
    description: "Increment the counter by a specified amount"

    input {
      counter_id: UUID
      amount: Int [default: 1]
    }

    output {
      success: CounterValue
      errors {
        NOT_FOUND {
          when: "Counter does not exist"
          retriable: false
        }
        MAX_EXCEEDED {
          when: "Increment would exceed maximum value"
          retriable: false
        }
        INVALID_AMOUNT {
          when: "Amount must be positive"
          retriable: false
        }
      }
    }

    preconditions {
      amount > 0
    }
  }

  # Get current counter value
  behavior GetCounter {
    description: "Retrieve the current counter value"

    input {
      counter_id: UUID
    }

    output {
      success: CounterValue
      errors {
        NOT_FOUND {
          when: "Counter does not exist"
          retriable: false
        }
      }
    }
  }

  # Create a new counter
  behavior CreateCounter {
    description: "Create a new counter with optional max value"

    input {
      max_value: Int? [default: 100]
    }

    output {
      success: CounterValue
      errors {
        INVALID_MAX {
          when: "Max value must be positive"
          retriable: false
        }
      }
    }
  }
}
