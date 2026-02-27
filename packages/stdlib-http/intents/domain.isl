/**
 * HTTP Domain
 * 
 * Standard library for HTTP/REST operations in ISL.
 */

domain Http {
  version: "1.0.0"
  description: "HTTP operations for REST APIs and web services"
  
  // ─────────────────────────────────────────────────────────────────────────
  // Core Types
  // ─────────────────────────────────────────────────────────────────────────
  
  type HttpMethod = Enum {
    GET
    POST
    PUT
    PATCH
    DELETE
    HEAD
    OPTIONS
  }
  
  type StatusCode = Int { min: 100, max: 599 }
  
  type Headers = Map<String, String>
  
  type QueryParams = Map<String, String | List<String>>
  
  type UrlPath = String {
    pattern: /^\/[a-zA-Z0-9\-_\/{}:.*]*$/
    description: "URL path with optional path parameters"
  }
  
  type ContentType = String {
    examples: ["application/json", "text/html", "multipart/form-data"]
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Request/Response
  // ─────────────────────────────────────────────────────────────────────────
  
  entity HttpRequest {
    method: HttpMethod
    url: URL
    path: UrlPath
    headers: Headers
    query: QueryParams?
    body: Any?
    
    // Parsed data
    path_params: Map<String, String>?
    content_type: ContentType?
    
    // Metadata
    timestamp: Timestamp [immutable]
    request_id: UUID [immutable, unique]
  }
  
  entity HttpResponse {
    status: StatusCode
    headers: Headers
    body: Any?
    
    // Metadata
    request_id: UUID
    duration_ms: Int
    timestamp: Timestamp [immutable]
    
    invariants {
      status >= 100 and status < 600 as "Valid HTTP status code"
      duration_ms >= 0 as "Duration must be non-negative"
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // API Definition
  // ─────────────────────────────────────────────────────────────────────────
  
  entity Endpoint {
    id: UUID [immutable, unique]
    method: HttpMethod
    path: UrlPath
    name: String
    description: String?
    
    // Request schema
    path_params: List<ParamDef>?
    query_params: List<ParamDef>?
    headers: List<ParamDef>?
    body_schema: String?  // JSON Schema or ISL type reference
    
    // Response schema
    responses: List<ResponseDef>
    
    // Security
    auth_required: Boolean
    permissions: List<String>?
    rate_limit: RateLimit?
    
    // Metadata
    tags: List<String>?
    deprecated: Boolean
    version: String?
  }
  
  type ParamDef = {
    name: String
    type: String
    required: Boolean
    description: String?
    default: Any?
    validation: String?  // Regex or constraint expression
  }
  
  type ResponseDef = {
    status: StatusCode
    description: String
    content_type: ContentType?
    schema: String?
  }
  
  type RateLimit = {
    requests: Int { min: 1 }
    window_seconds: Int { min: 1 }
    by: RateLimitKey
  }
  
  enum RateLimitKey {
    IP
    USER
    API_KEY
    ENDPOINT
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Error Types
  // ─────────────────────────────────────────────────────────────────────────
  
  type HttpError = {
    status: StatusCode
    code: String
    message: String
    details: Map<String, Any>?
    trace_id: UUID?
  }
  
  enum StandardError {
    BAD_REQUEST          // 400
    UNAUTHORIZED         // 401
    FORBIDDEN            // 403
    NOT_FOUND            // 404
    METHOD_NOT_ALLOWED   // 405
    CONFLICT             // 409
    GONE                 // 410
    PAYLOAD_TOO_LARGE    // 413
    UNSUPPORTED_MEDIA    // 415
    UNPROCESSABLE        // 422
    TOO_MANY_REQUESTS    // 429
    INTERNAL_ERROR       // 500
    NOT_IMPLEMENTED      // 501
    BAD_GATEWAY          // 502
    SERVICE_UNAVAILABLE  // 503
    GATEWAY_TIMEOUT      // 504
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Middleware
  // ─────────────────────────────────────────────────────────────────────────
  
  type Middleware = {
    name: String
    priority: Int { min: 0, max: 1000 }
    handler: String  // Handler function reference
    config: Map<String, Any>?
  }
  
  enum MiddlewarePhase {
    PRE_ROUTE      // Before routing
    PRE_HANDLER    // After routing, before handler
    POST_HANDLER   // After handler, before response
    POST_RESPONSE  // After response sent
    ERROR          // On error
  }
}
