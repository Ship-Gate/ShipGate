# HTTP Client Behaviors
# Make HTTP requests

import { HTTP } from "../domain.isl"

# ============================================
# Fetch
# ============================================

behavior Fetch<T> {
  description: "Make HTTP request and parse response"
  
  input {
    url: URL
    method: Method?  # Defaults to GET
    headers: Headers?
    query: QueryParams?
    body: Body?
    
    # Options
    timeout: Duration?
    retry: RetryConfig?
    cache: CacheConfig?
  }
  
  type RetryConfig = {
    max_attempts: Int { min: 1, max: 10 }
    delay: Duration
    backoff_multiplier: Float?
    retry_on: List<StatusCode>?  # Status codes to retry
  }
  
  type CacheConfig = {
    ttl: Duration
    key: String?
    revalidate: Boolean?
  }
  
  output {
    success: Response<T>
    
    errors {
      NETWORK_ERROR {
        when: "Network request failed"
        retriable: true
      }
      TIMEOUT {
        when: "Request timed out"
        retriable: true
      }
      DNS_ERROR {
        when: "DNS resolution failed"
        retriable: true
      }
      SSL_ERROR {
        when: "SSL/TLS error"
        retriable: false
      }
      HTTP_ERROR {
        when: "Server returned error status"
        data: { status: StatusCode, body: Any }
      }
      PARSE_ERROR {
        when: "Failed to parse response"
        retriable: false
      }
    }
  }
  
  preconditions {
    input.url != null
    input.url.is_valid_url
    
    # Body only allowed for certain methods
    input.body != null implies {
      input.method in [POST, PUT, PATCH, DELETE]
    }
  }
  
  postconditions {
    success implies {
      result.status >= 200 and result.status < 400
    }
  }
  
  temporal {
    - default timeout: 30.seconds
    - connect timeout: 10.seconds
  }
  
  invariants {
    - automatic retry for 5xx and network errors
    - exponential backoff between retries
    - request/response logging (debug mode)
  }
}

# ============================================
# Convenience Methods
# ============================================

behavior GET<T> {
  description: "HTTP GET request"
  
  input {
    url: URL
    headers: Headers?
    query: QueryParams?
    timeout: Duration?
  }
  
  output {
    success: Response<T>
    errors: Fetch.errors
  }
  
  implementation {
    Fetch<T>(url: input.url, method: GET, ...)
  }
}

behavior POST<T> {
  description: "HTTP POST request"
  
  input {
    url: URL
    body: Body
    headers: Headers?
    timeout: Duration?
  }
  
  output {
    success: Response<T>
    errors: Fetch.errors
  }
  
  implementation {
    Fetch<T>(url: input.url, method: POST, body: input.body, ...)
  }
}

behavior PUT<T> {
  description: "HTTP PUT request"
  
  input {
    url: URL
    body: Body
    headers: Headers?
    timeout: Duration?
  }
  
  output {
    success: Response<T>
    errors: Fetch.errors
  }
}

behavior PATCH<T> {
  description: "HTTP PATCH request"
  
  input {
    url: URL
    body: Body
    headers: Headers?
    timeout: Duration?
  }
  
  output {
    success: Response<T>
    errors: Fetch.errors
  }
}

behavior DELETE {
  description: "HTTP DELETE request"
  
  input {
    url: URL
    headers: Headers?
    timeout: Duration?
  }
  
  output {
    success: Response<void>
    errors: Fetch.errors
  }
}

# ============================================
# Streaming
# ============================================

behavior FetchStream {
  description: "Fetch with streaming response"
  
  input {
    url: URL
    method: Method?
    headers: Headers?
    body: Body?
  }
  
  output {
    success: {
      status: StatusCode
      headers: Headers
      body: Stream<Bytes>
    }
    errors: Fetch.errors
  }
  
  invariants {
    - response body is lazy stream
    - memory efficient for large responses
    - supports backpressure
  }
}

# ============================================
# Scenarios
# ============================================

scenarios Fetch {
  scenario "successful GET" {
    when {
      result = GET<User>(
        url: "https://api.example.com/users/123"
      )
    }
    
    then {
      result is success
      result.status == 200
      result.body.id == "123"
    }
  }
  
  scenario "POST with JSON body" {
    when {
      result = POST<User>(
        url: "https://api.example.com/users",
        body: { type: "json", data: { name: "John" } }
      )
    }
    
    then {
      result is success
      result.status == 201
    }
  }
  
  scenario "retry on 5xx" {
    given {
      server returns 503 twice, then 200
    }
    
    when {
      result = Fetch(
        url: "https://api.example.com/data",
        retry: { max_attempts: 3, delay: 100.ms }
      )
    }
    
    then {
      result is success  # Succeeded on third attempt
    }
  }
  
  scenario "timeout" {
    given {
      server takes 10 seconds to respond
    }
    
    when {
      result = Fetch(
        url: "https://slow.example.com",
        timeout: 5.seconds
      )
    }
    
    then {
      result is error TIMEOUT
    }
  }
}
