// Failing spec fixture: Counter domain with a postcondition the impl violates
domain Counter {
  version: "1.0.0"

  entity Counter {
    id: UUID [immutable]
    value: Int
  }

  behavior Increment {
    description: "Increment a counter by 1"

    input {
      counter_id: UUID
    }

    output {
      success: {
        new_value: Int
      }

      errors {
        NOT_FOUND {
          when: "Counter does not exist"
          retriable: false
        }
      }
    }

    postconditions {
      success implies {
        result.new_value == old(Counter.lookup(input.counter_id).value) + 1
        result.new_value > 0
      }
    }
  }
}
