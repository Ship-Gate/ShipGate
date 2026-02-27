# HTTP Middleware Module
# Provides standard middleware behavior patterns

module HTTPMiddleware version "1.0.0"

# ============================================
# Types
# ============================================

type LogLevel = enum {
  DEBUG
  INFO
  WARN
  ERROR
}

type CompressionAlgorithm = enum {
  GZIP
  BROTLI
  DEFLATE
  NONE
}

type RetryStrategy = enum {
  EXPONENTIAL_BACKOFF
  LINEAR_BACKOFF
  FIXED_DELAY
  NO_RETRY
}

# ============================================
# Entities
# ============================================

entity RequestLog {
  request_id: String
  method: String
  path: String
  status_code: Int
  latency_ms: Int { min: 0 }
  remote_addr: String?
  user_agent: String?
  content_length: Int? { min: 0 }
  timestamp: Timestamp [immutable]
  level: LogLevel

  invariants {
    latency_ms >= 0
    status_code >= 100 and status_code <= 599
  }
}

entity RetryConfig {
  max_retries: Int { min: 0, max: 10, default: 3 }
  strategy: RetryStrategy [default: EXPONENTIAL_BACKOFF]
  base_delay_ms: Int { min: 100, max: 60000, default: 1000 }
  max_delay_ms: Int { min: 1000, max: 300000, default: 30000 }
  retryable_status_codes: List<Int>

  invariants {
    max_delay_ms >= base_delay_ms
    retryable_status_codes.length > 0
  }
}

entity CircuitBreakerConfig {
  failure_threshold: Int { min: 1, max: 100, default: 5 }
  success_threshold: Int { min: 1, max: 100, default: 3 }
  timeout_ms: Int { min: 1000, max: 300000, default: 60000 }
  half_open_max_calls: Int { min: 1, max: 10, default: 1 }
}

# ============================================
# Behaviors
# ============================================

behavior LogRequest {
  description: "Log incoming HTTP request details"

  input {
    request_id: String
    method: String
    path: String
    remote_addr: String?
    user_agent: String?
  }

  output {
    success: RequestLog
  }

  post success {
    result.request_id == input.request_id
    result.method == input.method
    result.path == input.path
  }

  invariants {
    sensitive headers not logged
    request body not logged
    authorization header not logged
  }
}

behavior CompressResponse {
  description: "Compress HTTP response body"
  deterministic: true

  input {
    body: String
    accepted_encodings: List<CompressionAlgorithm>
    min_size_bytes: Int { min: 0, default: 1024 }
  }

  output {
    success: {
      compressed_body: String
      algorithm: CompressionAlgorithm
      original_size: Int
      compressed_size: Int
    }
  }

  pre {
    accepted_encodings.length > 0
    body.length > 0
  }

  post success {
    result.compressed_size <= result.original_size
    result.original_size == input.body.length
    result.algorithm in input.accepted_encodings
  }
}

behavior CalculateRetryDelay {
  description: "Calculate delay before next retry attempt"
  deterministic: true

  input {
    config: RetryConfig
    attempt: Int { min: 1 }
  }

  output {
    success: {
      delay_ms: Int
      should_retry: Boolean
    }

    errors {
      MAX_RETRIES_EXCEEDED {
        when: "Attempt exceeds max retries"
        retriable: false
      }
    }
  }

  pre {
    attempt >= 1
  }

  post success {
    result.delay_ms >= input.config.base_delay_ms
    result.delay_ms <= input.config.max_delay_ms
    input.attempt > input.config.max_retries implies result.should_retry == false
  }
}

behavior CheckCircuitBreaker {
  description: "Check if circuit breaker allows the request"

  input {
    service_name: String
    config: CircuitBreakerConfig
  }

  output {
    success: {
      allowed: Boolean
      state: String  # "closed", "open", "half-open"
      failure_count: Int
    }
  }

  post success {
    result.state in ["closed", "open", "half-open"]
    result.state == "open" implies result.allowed == false
    result.state == "closed" implies result.allowed == true
    result.failure_count >= 0
  }
}
