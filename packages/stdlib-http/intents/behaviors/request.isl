/**
 * HTTP Request Behavior
 * 
 * Make outbound HTTP requests.
 */

import { HttpMethod, Headers, QueryParams, HttpResponse, HttpError } from "../domain.isl"

behavior HttpRequest {
  description: "Make an HTTP request to a URL"
  
  input {
    method: HttpMethod
    url: URL
    headers: Headers?
    query: QueryParams?
    body: Any?
    
    // Options
    timeout_ms: Int { min: 0, max: 300000 }?
    follow_redirects: Boolean?
    max_redirects: Int { min: 0, max: 10 }?
    retry_count: Int { min: 0, max: 5 }?
    retry_delay_ms: Int { min: 0 }?
  }
  
  output {
    success: HttpResponse
    errors {
      TIMEOUT { when: "Request timed out" }
      CONNECTION_ERROR { when: "Failed to connect" }
      DNS_ERROR { when: "DNS resolution failed" }
      SSL_ERROR { when: "SSL/TLS handshake failed" }
      REDIRECT_LOOP { when: "Too many redirects" }
      INVALID_URL { when: "URL is malformed" }
    }
  }
  
  temporal {
    response within 30.seconds (p99)
    timeout: input.timeout_ms ?? 30000.ms
  }
  
  postconditions {
    success implies {
      result.status >= 100 and result.status < 600
      result.request_id != null
    }
  }
  
  scenarios HttpRequest {
    scenario "successful GET request" {
      when {
        result = HttpRequest(
          method: GET,
          url: "https://api.example.com/users"
        )
      }
      
      then {
        result is success
        result.response.status == 200
      }
    }
    
    scenario "POST with JSON body" {
      when {
        result = HttpRequest(
          method: POST,
          url: "https://api.example.com/users",
          headers: { "Content-Type": "application/json" },
          body: { "name": "John", "email": "john@example.com" }
        )
      }
      
      then {
        result is success
        result.response.status in [200, 201]
      }
    }
    
    scenario "request timeout" {
      when {
        result = HttpRequest(
          method: GET,
          url: "https://slow-api.example.com/data",
          timeout_ms: 100
        )
      }
      
      then {
        result is TIMEOUT
      }
    }
    
    scenario "retry on failure" {
      when {
        result = HttpRequest(
          method: GET,
          url: "https://flaky-api.example.com/data",
          retry_count: 3,
          retry_delay_ms: 1000
        )
      }
      
      then {
        // Either succeeds or fails after retries
        result is success or result is CONNECTION_ERROR
      }
    }
  }
}

behavior HttpGet {
  description: "Shorthand for GET request"
  
  input {
    url: URL
    headers: Headers?
    query: QueryParams?
    timeout_ms: Int?
  }
  
  output {
    success: HttpResponse
    errors {
      TIMEOUT { }
      CONNECTION_ERROR { }
      NOT_FOUND { when: "Resource not found (404)" }
    }
  }
  
  implementation {
    return HttpRequest(
      method: GET,
      url: input.url,
      headers: input.headers,
      query: input.query,
      timeout_ms: input.timeout_ms
    )
  }
}

behavior HttpPost {
  description: "Shorthand for POST request"
  
  input {
    url: URL
    body: Any
    headers: Headers?
    timeout_ms: Int?
  }
  
  output {
    success: HttpResponse
    errors {
      TIMEOUT { }
      CONNECTION_ERROR { }
      BAD_REQUEST { when: "Invalid request body (400)" }
      UNAUTHORIZED { when: "Authentication required (401)" }
    }
  }
  
  implementation {
    return HttpRequest(
      method: POST,
      url: input.url,
      body: input.body,
      headers: input.headers ?? { "Content-Type": "application/json" },
      timeout_ms: input.timeout_ms
    )
  }
}

behavior HttpPut {
  description: "Shorthand for PUT request"
  
  input {
    url: URL
    body: Any
    headers: Headers?
    timeout_ms: Int?
  }
  
  output {
    success: HttpResponse
    errors {
      TIMEOUT { }
      CONNECTION_ERROR { }
      NOT_FOUND { }
      CONFLICT { when: "Resource conflict (409)" }
    }
  }
}

behavior HttpDelete {
  description: "Shorthand for DELETE request"
  
  input {
    url: URL
    headers: Headers?
    timeout_ms: Int?
  }
  
  output {
    success: HttpResponse
    errors {
      TIMEOUT { }
      CONNECTION_ERROR { }
      NOT_FOUND { }
      FORBIDDEN { when: "Delete not allowed (403)" }
    }
  }
}
