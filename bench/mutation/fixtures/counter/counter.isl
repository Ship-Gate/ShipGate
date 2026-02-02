# Counter Domain
# 
# A simple counter with increment operation.
# Used for mutation testing validation.

domain Counter {
  version: "1.0.0"

  # ==========================================
  # Types
  # ==========================================
  
  type CounterId = UUID { immutable: true }
  type Amount = Int { min: 1 }

  # ==========================================
  # Entities
  # ==========================================

  entity Counter {
    id: CounterId [immutable, unique]
    value: Int [default: 0]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      value >= 0
      "Counter value must be non-negative"
    }
  }

  # ==========================================
  # Behaviors
  # ==========================================

  behavior Increment {
    description: "Increment a counter by a positive amount"

    input {
      counterId: CounterId
      amount: Amount
    }

    output {
      success: Counter

      errors {
        INVALID_AMOUNT {
          when: "Amount is not positive"
          retriable: true
        }
        COUNTER_NOT_FOUND {
          when: "Counter does not exist"
          retriable: false
        }
        OVERFLOW {
          when: "Increment would cause overflow"
          retriable: false
        }
      }
    }

    pre {
      - amount > 0
      - Counter.exists(counterId)
    }

    post success {
      - result.value == old(Counter.lookup(counterId).value) + input.amount
      - result.value > 0
      - result.updated_at >= old(result.updated_at)
    }

    post INVALID_AMOUNT {
      - Counter.lookup(counterId).value == old(Counter.lookup(counterId).value)
    }

    invariants {
      - result.value >= 0
      - "Value remains non-negative after operation"
    }
  }

  behavior Decrement {
    description: "Decrement a counter by a positive amount"

    input {
      counterId: CounterId
      amount: Amount
    }

    output {
      success: Counter

      errors {
        INVALID_AMOUNT {
          when: "Amount is not positive"
          retriable: true
        }
        COUNTER_NOT_FOUND {
          when: "Counter does not exist"
          retriable: false
        }
        UNDERFLOW {
          when: "Decrement would result in negative value"
          retriable: false
        }
      }
    }

    pre {
      - amount > 0
      - Counter.exists(counterId)
      - Counter.lookup(counterId).value >= amount
    }

    post success {
      - result.value == old(Counter.lookup(counterId).value) - input.amount
      - result.value >= 0
    }

    invariants {
      - result.value >= 0
    }
  }

  # ==========================================
  # Invariants
  # ==========================================

  invariants CounterBoundaries {
    description: "Counter value boundaries"
    scope: global

    always {
      - all(c in Counter, c.value >= 0)
      - all(c in Counter, c.value < 2147483647)
    }
  }
}
