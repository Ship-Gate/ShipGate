// Webhooks: Retry logic and backoff
domain WebhooksRetry {
  version: "1.0.0"

  enum RetryStatus {
    SCHEDULED
    IN_PROGRESS
    COMPLETED
    EXHAUSTED
    CANCELLED
  }

  entity RetryAttempt {
    id: UUID [immutable, unique]
    delivery_id: UUID [indexed]
    attempt_number: Int
    scheduled_for: Timestamp
    started_at: Timestamp?
    completed_at: Timestamp?
    status: RetryStatus
    response_status: Int?
    error_message: String?
    duration_ms: Int?
    created_at: Timestamp [immutable]

    invariants {
      attempt_number >= 1
      attempt_number <= 10
    }

    lifecycle {
      SCHEDULED -> IN_PROGRESS
      IN_PROGRESS -> COMPLETED
      IN_PROGRESS -> EXHAUSTED
      SCHEDULED -> CANCELLED
    }
  }

  entity RetryPolicy {
    id: UUID [immutable, unique]
    name: String
    max_attempts: Int
    initial_delay_seconds: Int
    max_delay_seconds: Int
    backoff_multiplier: Decimal
    retry_on_status_codes: List<Int>
    created_at: Timestamp [immutable]

    invariants {
      max_attempts >= 1
      max_attempts <= 20
      initial_delay_seconds >= 1
      max_delay_seconds >= initial_delay_seconds
      backoff_multiplier >= 1
    }
  }

  behavior ScheduleRetry {
    description: "Schedule a delivery retry"

    actors {
      System { }
    }

    input {
      delivery_id: UUID
      delay_seconds: Int?
    }

    output {
      success: RetryAttempt

      errors {
        DELIVERY_NOT_FOUND {
          when: "Delivery not found"
          retriable: false
        }
        MAX_RETRIES_EXCEEDED {
          when: "Maximum retries exceeded"
          retriable: false
        }
        DELIVERY_SUCCEEDED {
          when: "Delivery already succeeded"
          retriable: false
        }
      }
    }

    pre {
      input.delay_seconds == null or input.delay_seconds >= 0
    }

    post success {
      - RetryAttempt.exists(result.id)
      - result.status == SCHEDULED
      - result.scheduled_for > now()
    }
  }

  behavior ExecuteRetry {
    description: "Execute a scheduled retry"

    actors {
      System { }
    }

    input {
      retry_id: UUID
    }

    output {
      success: RetryAttempt

      errors {
        RETRY_NOT_FOUND {
          when: "Retry not found"
          retriable: false
        }
        NOT_SCHEDULED {
          when: "Retry not in scheduled state"
          retriable: false
        }
        ENDPOINT_DISABLED {
          when: "Endpoint is disabled"
          retriable: false
        }
      }
    }

    pre {
      RetryAttempt.exists(input.retry_id)
      RetryAttempt.lookup(input.retry_id).status == SCHEDULED
    }

    post success {
      - result.status == COMPLETED or result.status == EXHAUSTED
      - result.started_at != null
      - result.completed_at != null
    }

    temporal {
      - within 30s (p99): retry completed
    }
  }

  behavior CancelRetry {
    description: "Cancel a scheduled retry"

    actors {
      User { must: authenticated }
      System { }
    }

    input {
      retry_id: UUID
    }

    output {
      success: RetryAttempt

      errors {
        RETRY_NOT_FOUND {
          when: "Retry not found"
          retriable: false
        }
        NOT_CANCELLABLE {
          when: "Retry cannot be cancelled"
          retriable: false
        }
      }
    }

    pre {
      RetryAttempt.exists(input.retry_id)
      RetryAttempt.lookup(input.retry_id).status == SCHEDULED
    }

    post success {
      - result.status == CANCELLED
    }
  }

  behavior GetRetryHistory {
    description: "Get retry history for delivery"

    actors {
      User { must: authenticated }
    }

    input {
      delivery_id: UUID
    }

    output {
      success: {
        delivery_id: UUID
        attempts: List<RetryAttempt>
        total_attempts: Int
        last_attempt_at: Timestamp?
        next_retry_at: Timestamp?
      }

      errors {
        DELIVERY_NOT_FOUND {
          when: "Delivery not found"
          retriable: false
        }
      }
    }
  }

  behavior CreateRetryPolicy {
    description: "Create a retry policy"

    actors {
      Admin { must: authenticated }
    }

    input {
      name: String
      max_attempts: Int
      initial_delay_seconds: Int
      max_delay_seconds: Int
      backoff_multiplier: Decimal?
      retry_on_status_codes: List<Int>?
    }

    output {
      success: RetryPolicy

      errors {
        NAME_EXISTS {
          when: "Policy name already exists"
          retriable: false
        }
        INVALID_CONFIG {
          when: "Invalid configuration"
          retriable: true
        }
      }
    }

    pre {
      input.max_attempts >= 1
      input.max_attempts <= 20
      input.initial_delay_seconds >= 1
      input.max_delay_seconds >= input.initial_delay_seconds
    }

    post success {
      - RetryPolicy.exists(result.id)
    }
  }

  scenarios ScheduleRetry {
    scenario "schedule with exponential backoff" {
      when {
        result = ScheduleRetry(
          delivery_id: "delivery-123",
          delay_seconds: 60
        )
      }

      then {
        result is success
        result.status == SCHEDULED
      }
    }
  }
}
