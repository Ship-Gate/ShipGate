// Webhooks: Endpoint registration
domain WebhooksEndpoint {
  version: "1.0.0"

  enum EndpointStatus {
    ACTIVE
    DISABLED
    PENDING_VERIFICATION
  }

  entity WebhookEndpoint {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    url: String
    description: String?
    events: List<String>
    status: EndpointStatus
    secret: String [secret]
    signing_algorithm: String
    api_version: String?
    metadata: Map<String, String>
    enabled_events_count: Int
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      url starts_with "https://"
      events.length > 0
      secret.length >= 32
    }
  }

  behavior CreateEndpoint {
    description: "Register a webhook endpoint"

    actors {
      User { must: authenticated }
    }

    input {
      url: String
      events: List<String>
      description: String?
      api_version: String?
      metadata: Map<String, String>?
    }

    output {
      success: {
        endpoint: WebhookEndpoint
        secret: String
      }

      errors {
        INVALID_URL {
          when: "URL is invalid or not HTTPS"
          retriable: true
        }
        URL_NOT_REACHABLE {
          when: "Cannot reach webhook URL"
          retriable: true
        }
        INVALID_EVENTS {
          when: "Unknown event types"
          retriable: true
        }
        MAX_ENDPOINTS_REACHED {
          when: "Maximum endpoints reached"
          retriable: false
        }
      }
    }

    pre {
      input.url starts_with "https://"
      input.events.length > 0
    }

    post success {
      - WebhookEndpoint.exists(result.endpoint.id)
      - result.endpoint.status == ACTIVE or result.endpoint.status == PENDING_VERIFICATION
      - result.secret.length >= 32
    }

    invariants {
      - secret shown only once
      - secret is cryptographically random
    }
  }

  behavior GetEndpoint {
    description: "Get endpoint details"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID
    }

    output {
      success: WebhookEndpoint

      errors {
        NOT_FOUND {
          when: "Endpoint not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      WebhookEndpoint.exists(input.endpoint_id)
    }
  }

  behavior UpdateEndpoint {
    description: "Update endpoint settings"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID
      url: String?
      events: List<String>?
      description: String?
      disabled: Boolean?
      metadata: Map<String, String>?
    }

    output {
      success: WebhookEndpoint

      errors {
        NOT_FOUND {
          when: "Endpoint not found"
          retriable: false
        }
        INVALID_URL {
          when: "URL is invalid"
          retriable: true
        }
        INVALID_EVENTS {
          when: "Unknown event types"
          retriable: true
        }
      }
    }

    pre {
      WebhookEndpoint.exists(input.endpoint_id)
      input.url == null or input.url starts_with "https://"
    }

    post success {
      - input.disabled == true implies result.status == DISABLED
    }
  }

  behavior DeleteEndpoint {
    description: "Remove webhook endpoint"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Endpoint not found"
          retriable: false
        }
      }
    }

    pre {
      WebhookEndpoint.exists(input.endpoint_id)
    }

    post success {
      - not WebhookEndpoint.exists(input.endpoint_id)
    }
  }

  behavior RotateSecret {
    description: "Rotate endpoint secret"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID
    }

    output {
      success: {
        endpoint: WebhookEndpoint
        secret: String
      }

      errors {
        NOT_FOUND {
          when: "Endpoint not found"
          retriable: false
        }
      }
    }

    pre {
      WebhookEndpoint.exists(input.endpoint_id)
    }

    post success {
      - result.secret != old(WebhookEndpoint.lookup(input.endpoint_id).secret)
    }
  }

  behavior ListEndpoints {
    description: "List webhook endpoints"

    actors {
      User { must: authenticated }
    }

    input {
      status: EndpointStatus?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        endpoints: List<WebhookEndpoint>
        total_count: Int
        has_more: Boolean
      }
    }

    post success {
      - all(e in result.endpoints: e.owner_id == actor.id)
    }
  }

  scenarios CreateEndpoint {
    scenario "register endpoint" {
      when {
        result = CreateEndpoint(
          url: "https://example.com/webhooks",
          events: ["payment.completed", "payment.failed"],
          description: "Payment notifications"
        )
      }

      then {
        result is success
        result.endpoint.events.length == 2
        result.secret.length >= 32
      }
    }
  }
}
