# HTTP Request/Response Module
# Provides HTTP contract types for API specification
#
# Defines the standard HTTP request and response structures
# used across REST and GraphQL API specifications.

module HTTPRequestResponse version "1.0.0"

# ============================================
# Types
# ============================================

type HTTPMethod = enum {
  GET
  POST
  PUT
  PATCH
  DELETE
  HEAD
  OPTIONS
}

type HTTPStatusCode = enum {
  OK_200
  CREATED_201
  ACCEPTED_202
  NO_CONTENT_204
  MOVED_PERMANENTLY_301
  FOUND_302
  NOT_MODIFIED_304
  BAD_REQUEST_400
  UNAUTHORIZED_401
  FORBIDDEN_403
  NOT_FOUND_404
  METHOD_NOT_ALLOWED_405
  CONFLICT_409
  GONE_410
  UNPROCESSABLE_ENTITY_422
  TOO_MANY_REQUESTS_429
  INTERNAL_SERVER_ERROR_500
  BAD_GATEWAY_502
  SERVICE_UNAVAILABLE_503
  GATEWAY_TIMEOUT_504
}

type ContentType = enum {
  APPLICATION_JSON
  APPLICATION_XML
  APPLICATION_FORM_URLENCODED
  MULTIPART_FORM_DATA
  TEXT_PLAIN
  TEXT_HTML
  APPLICATION_OCTET_STREAM
}

type AuthScheme = enum {
  BEARER
  BASIC
  API_KEY
  OAUTH2
  DIGEST
}

type HeaderName = String {
  description: "HTTP header name (case-insensitive)"
  max_length: 256
}

type HeaderValue = String {
  description: "HTTP header value"
  max_length: 8192
}

type QueryParam = String {
  description: "URL query parameter value"
  max_length: 2048
}

type PathSegment = String {
  description: "URL path segment"
  pattern: "^[a-zA-Z0-9._~:@!$&'()*+,;=-]+$"
  max_length: 255
}

type BearerToken = String {
  description: "OAuth 2.0 bearer token"
  min_length: 1
  sensitive: true
}

type APIKey = String {
  description: "API key for authentication"
  min_length: 16
  sensitive: true
}

# ============================================
# Entities
# ============================================

entity HTTPRequest {
  method: HTTPMethod
  path: String { max_length: 2048 }
  headers: Map<HeaderName, HeaderValue>
  query_params: Map<String, QueryParam>?
  body: String?
  content_type: ContentType?
  authorization: String? [secret]
  remote_addr: String?
  request_id: String?
  timestamp: Timestamp [immutable]

  invariants {
    method in [GET, HEAD, OPTIONS, DELETE] implies body == null
    body != null implies content_type != null
    request_id != null implies request_id.length > 0
  }
}

entity HTTPResponse {
  status_code: HTTPStatusCode
  headers: Map<HeaderName, HeaderValue>
  body: String?
  content_type: ContentType?
  content_length: Int? { min: 0 }
  request_id: String?
  latency_ms: Int { min: 0 }

  invariants {
    status_code == NO_CONTENT_204 implies body == null
    body != null implies content_type != null
    content_length != null implies content_length >= 0
  }
}

entity HTTPError {
  status_code: HTTPStatusCode
  error_code: String { max_length: 64 }
  message: String { max_length: 1024 }
  details: Map<String, String>?
  request_id: String?
  timestamp: Timestamp

  invariants {
    # Error status codes are 4xx or 5xx
    status_code in [BAD_REQUEST_400, UNAUTHORIZED_401, FORBIDDEN_403,
                    NOT_FOUND_404, METHOD_NOT_ALLOWED_405, CONFLICT_409,
                    GONE_410, UNPROCESSABLE_ENTITY_422, TOO_MANY_REQUESTS_429,
                    INTERNAL_SERVER_ERROR_500, BAD_GATEWAY_502,
                    SERVICE_UNAVAILABLE_503, GATEWAY_TIMEOUT_504]
  }
}

entity CacheControl {
  max_age: Int? { min: 0 }
  s_maxage: Int? { min: 0 }
  no_cache: Boolean [default: false]
  no_store: Boolean [default: false]
  must_revalidate: Boolean [default: false]
  is_public: Boolean [default: false]
  is_private: Boolean [default: false]
  etag: String?

  invariants {
    not (is_public and is_private)
    no_store implies no_cache
  }
}

# ============================================
# Behaviors
# ============================================

behavior SendRequest {
  description: "Send an HTTP request and receive a response"

  input {
    method: HTTPMethod
    url: String { max_length: 2048 }
    headers: Map<HeaderName, HeaderValue>?
    body: String?
    content_type: ContentType?
    timeout_ms: Int { min: 100, max: 300000, default: 30000 }
  }

  output {
    success: HTTPResponse

    errors {
      TIMEOUT {
        when: "Request exceeded timeout"
        retriable: true
        retry_after: 1s
      }
      CONNECTION_REFUSED {
        when: "Target server refused connection"
        retriable: true
        retry_after: 5s
      }
      DNS_RESOLUTION_FAILED {
        when: "Could not resolve hostname"
        retriable: true
        retry_after: 10s
      }
      TLS_ERROR {
        when: "TLS handshake or certificate error"
        retriable: false
      }
    }
  }

  pre {
    url.starts_with("http://") or url.starts_with("https://")
    method in [POST, PUT, PATCH] or body == null
  }

  post success {
    result.latency_ms <= input.timeout_ms
    result.request_id != null
  }

  temporal {
    within 30s (p99): response returned
  }
}

behavior ParseRequest {
  description: "Parse an incoming HTTP request into structured form"
  deterministic: true

  input {
    raw_method: String
    raw_path: String
    raw_headers: Map<String, String>
    raw_body: String?
  }

  output {
    success: HTTPRequest

    errors {
      INVALID_METHOD {
        when: "HTTP method not recognized"
        retriable: false
      }
      INVALID_CONTENT_TYPE {
        when: "Content-Type header malformed"
        retriable: false
      }
      BODY_TOO_LARGE {
        when: "Request body exceeds size limit"
        retriable: false
      }
    }
  }

  post success {
    result.path == input.raw_path
  }
}

behavior BuildErrorResponse {
  description: "Build a standardized error response"
  deterministic: true

  input {
    status_code: HTTPStatusCode
    error_code: String
    message: String
    details: Map<String, String>?
    request_id: String?
  }

  output {
    success: HTTPResponse
  }

  post success {
    result.status_code == input.status_code
    result.content_type == APPLICATION_JSON
    result.request_id == input.request_id
  }
}

behavior ValidateContentType {
  description: "Validate Content-Type header against accepted types"
  deterministic: true

  input {
    content_type: String
    accepted: List<ContentType>
  }

  output {
    success: Boolean

    errors {
      UNSUPPORTED_MEDIA_TYPE {
        when: "Content-Type not in accepted list"
        retriable: false
      }
    }
  }

  pre {
    accepted.length > 0
    content_type.length > 0
  }
}
