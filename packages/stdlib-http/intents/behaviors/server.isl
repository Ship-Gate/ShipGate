/**
 * HTTP Server Behaviors
 * 
 * Define and handle HTTP endpoints.
 */

import { Endpoint, HttpRequest, HttpResponse, HttpError, Middleware, MiddlewarePhase } from "../domain.isl"

behavior DefineEndpoint {
  description: "Define an HTTP endpoint"
  
  input {
    method: HttpMethod
    path: UrlPath
    name: String
    description: String?
    
    // Request validation
    path_params: List<ParamDef>?
    query_params: List<ParamDef>?
    headers: List<ParamDef>?
    body_schema: String?
    
    // Response definitions
    responses: List<ResponseDef>
    
    // Security
    auth_required: Boolean?
    permissions: List<String>?
    rate_limit: RateLimit?
    
    // Metadata
    tags: List<String>?
    version: String?
  }
  
  output {
    success: Endpoint
    errors {
      DUPLICATE_ENDPOINT { when: "Endpoint with same method and path exists" }
      INVALID_PATH { when: "Path pattern is invalid" }
      INVALID_SCHEMA { when: "Body schema is invalid" }
    }
  }
  
  preconditions {
    input.path.startsWith("/") as "Path must start with /"
    input.responses.length > 0 as "At least one response must be defined"
  }
  
  postconditions {
    success implies {
      Endpoint.exists(result.id)
      result.path == input.path
      result.method == input.method
    }
  }
}

behavior HandleRequest {
  description: "Handle an incoming HTTP request"
  
  input {
    request: HttpRequest
    handler: String  // Handler function name
    middleware: List<Middleware>?
  }
  
  output {
    success: HttpResponse
    errors {
      HANDLER_NOT_FOUND { when: "Handler function not registered" }
      HANDLER_ERROR { when: "Handler threw an exception" }
      VALIDATION_ERROR { when: "Request validation failed" }
      MIDDLEWARE_ERROR { when: "Middleware error" }
    }
  }
  
  temporal {
    response within 5.seconds (p95)
  }
  
  postconditions {
    success implies {
      result.request_id == input.request.request_id
      result.duration_ms >= 0
    }
  }
}

behavior ValidateRequest {
  description: "Validate request against endpoint schema"
  
  input {
    request: HttpRequest
    endpoint: Endpoint
  }
  
  output {
    success: {
      valid: Boolean
      path_params: Map<String, String>?
      query_params: Map<String, Any>?
      body: Any?
    }
    errors {
      MISSING_PATH_PARAM { param: String }
      INVALID_PATH_PARAM { param: String, reason: String }
      MISSING_QUERY_PARAM { param: String }
      INVALID_QUERY_PARAM { param: String, reason: String }
      MISSING_HEADER { header: String }
      INVALID_BODY { reason: String }
    }
  }
}

behavior Route {
  description: "Route request to appropriate endpoint"
  
  input {
    request: HttpRequest
    endpoints: List<Endpoint>
  }
  
  output {
    success: {
      endpoint: Endpoint
      path_params: Map<String, String>
    }
    errors {
      NOT_FOUND { when: "No matching endpoint" }
      METHOD_NOT_ALLOWED { 
        when: "Path matches but method doesn't"
        allowed_methods: List<HttpMethod>
      }
    }
  }
}

behavior SendResponse {
  description: "Send HTTP response"
  
  input {
    status: StatusCode
    headers: Headers?
    body: Any?
    content_type: ContentType?
    request_id: UUID
  }
  
  output {
    success: HttpResponse
    errors {
      SERIALIZATION_ERROR { when: "Failed to serialize body" }
      HEADERS_ALREADY_SENT { when: "Response already started" }
    }
  }
  
  postconditions {
    success implies {
      result.status == input.status
      result.request_id == input.request_id
    }
  }
}

behavior SendError {
  description: "Send error response"
  
  input {
    error: StandardError | HttpError
    request_id: UUID
    include_trace: Boolean?
  }
  
  output {
    success: HttpResponse
    errors {
      SERIALIZATION_ERROR { }
    }
  }
  
  implementation {
    status = match input.error {
      BAD_REQUEST => 400
      UNAUTHORIZED => 401
      FORBIDDEN => 403
      NOT_FOUND => 404
      METHOD_NOT_ALLOWED => 405
      CONFLICT => 409
      GONE => 410
      PAYLOAD_TOO_LARGE => 413
      UNSUPPORTED_MEDIA => 415
      UNPROCESSABLE => 422
      TOO_MANY_REQUESTS => 429
      INTERNAL_ERROR => 500
      NOT_IMPLEMENTED => 501
      BAD_GATEWAY => 502
      SERVICE_UNAVAILABLE => 503
      GATEWAY_TIMEOUT => 504
      _ => input.error.status
    }
    
    return SendResponse(
      status: status,
      body: {
        error: input.error.code ?? input.error,
        message: input.error.message ?? "An error occurred",
        trace_id: input.include_trace ? input.request_id : null
      },
      content_type: "application/json",
      request_id: input.request_id
    )
  }
}

behavior AddMiddleware {
  description: "Register middleware for request processing"
  
  input {
    name: String
    phase: MiddlewarePhase
    priority: Int { min: 0, max: 1000 }
    handler: String
    config: Map<String, Any>?
    paths: List<UrlPath>?  // Optional: apply only to specific paths
  }
  
  output {
    success: Middleware
    errors {
      DUPLICATE_NAME { when: "Middleware with this name exists" }
      INVALID_HANDLER { when: "Handler not found" }
    }
  }
}
