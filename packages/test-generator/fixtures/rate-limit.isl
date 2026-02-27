// API Gateway fixture: HandleRequest behavior with rate limiting
domain APIGateway {
  version: "1.0.0"

  entity RateLimitEntry {
    id: UUID [immutable]
    client_id: String
    endpoint: String
    request_count: Int
    window_start: Timestamp
  }

  behavior HandleRequest {
    description: "Handle an API request with rate limiting"

    input {
      client_id: String
      endpoint: String
      method: String
    }

    output {
      success: {
        allowed: Boolean
        remaining: Int
        reset_at: Timestamp
      }

      errors {
        RATE_LIMITED {
          when: "Client has exceeded the rate limit"
          retriable: true
        }
        INVALID_ENDPOINT {
          when: "Endpoint does not exist"
          retriable: false
        }
      }
    }

    preconditions {
      input.client_id.length > 0
      input.endpoint.length > 0
    }

    postconditions {
      success implies {
        result.allowed == true
        result.remaining >= 0
      }

      RATE_LIMITED implies {
        result.allowed == false
        result.remaining == 0
      }
    }

    security {
      rate_limit 100 per minute
    }

    temporal {
      completes_within 50ms
    }
  }
}
