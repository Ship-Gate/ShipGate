// Webhooks: Delivery logs and debugging
domain WebhooksLogs {
  version: "1.0.0"

  enum LogLevel {
    DEBUG
    INFO
    WARNING
    ERROR
  }

  entity WebhookLog {
    id: UUID [immutable, unique]
    delivery_id: UUID [indexed]
    endpoint_id: UUID [indexed]
    level: LogLevel
    message: String
    context: Map<String, String>
    timestamp: Timestamp [immutable, indexed]

    invariants {
      message.length > 0
    }
  }

  entity DeliveryMetrics {
    id: UUID [immutable, unique]
    endpoint_id: UUID [indexed]
    date: String [indexed]
    total_deliveries: Int
    successful_deliveries: Int
    failed_deliveries: Int
    avg_response_time_ms: Decimal
    p99_response_time_ms: Decimal
    total_retries: Int

    invariants {
      total_deliveries >= 0
      successful_deliveries >= 0
      failed_deliveries >= 0
      total_deliveries == successful_deliveries + failed_deliveries
    }
  }

  behavior GetDeliveryLogs {
    description: "Get logs for a delivery"

    actors {
      User { must: authenticated }
    }

    input {
      delivery_id: UUID
      level: LogLevel?
      from: Timestamp?
      to: Timestamp?
      limit: Int?
    }

    output {
      success: List<WebhookLog>

      errors {
        DELIVERY_NOT_FOUND {
          when: "Delivery not found"
          retriable: false
        }
      }
    }

    pre {
      input.limit == null or (input.limit >= 1 and input.limit <= 1000)
    }

    post success {
      - all(l in result: l.delivery_id == input.delivery_id)
      - input.level != null implies all(l in result: l.level == input.level)
    }
  }

  behavior GetEndpointLogs {
    description: "Get logs for an endpoint"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID
      level: LogLevel?
      from: Timestamp?
      to: Timestamp?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        logs: List<WebhookLog>
        total_count: Int
        has_more: Boolean
      }

      errors {
        ENDPOINT_NOT_FOUND {
          when: "Endpoint not found"
          retriable: false
        }
      }
    }

    post success {
      - all(l in result.logs: l.endpoint_id == input.endpoint_id)
    }
  }

  behavior GetEndpointMetrics {
    description: "Get delivery metrics for endpoint"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID
      from: Timestamp?
      to: Timestamp?
      granularity: String?
    }

    output {
      success: {
        endpoint_id: UUID
        period_start: Timestamp
        period_end: Timestamp
        total_deliveries: Int
        success_rate: Decimal
        avg_response_time_ms: Decimal
        by_period: List<DeliveryMetrics>
      }

      errors {
        ENDPOINT_NOT_FOUND {
          when: "Endpoint not found"
          retriable: false
        }
      }
    }
  }

  behavior GetFailureAnalysis {
    description: "Analyze delivery failures"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID
      from: Timestamp?
      to: Timestamp?
    }

    output {
      success: {
        total_failures: Int
        by_status_code: Map<Int, Int>
        by_error_type: Map<String, Int>
        common_errors: List<{ message: String, count: Int }>
        avg_time_to_failure_ms: Decimal
      }

      errors {
        ENDPOINT_NOT_FOUND {
          when: "Endpoint not found"
          retriable: false
        }
      }
    }
  }

  behavior TestEndpoint {
    description: "Send test webhook to endpoint"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID
      event_type: String?
      payload: Map<String, String>?
    }

    output {
      success: {
        delivery_id: UUID
        response_status: Int
        response_body: String?
        duration_ms: Int
        success: Boolean
      }

      errors {
        ENDPOINT_NOT_FOUND {
          when: "Endpoint not found"
          retriable: false
        }
        ENDPOINT_DISABLED {
          when: "Endpoint is disabled"
          retriable: false
        }
        DELIVERY_FAILED {
          when: "Test delivery failed"
          retriable: true
        }
      }
    }

    temporal {
      - within 30s (p99): test complete
    }
  }

  behavior PurgeOldLogs {
    description: "Purge logs older than retention period"

    actors {
      System { }
      Admin { must: authenticated }
    }

    input {
      endpoint_id: UUID?
      older_than: Duration
    }

    output {
      success: {
        deleted_count: Int
        freed_bytes: Int
      }
    }

    pre {
      input.older_than >= 1.day
    }
  }

  scenarios GetEndpointMetrics {
    scenario "get last 7 days" {
      given {
        endpoint = WebhookEndpoint.create()
      }

      when {
        result = GetEndpointMetrics(
          endpoint_id: endpoint.id,
          from: now() - 7.days,
          to: now(),
          granularity: "day"
        )
      }

      then {
        result is success
        result.by_period.length <= 7
      }
    }
  }
}
