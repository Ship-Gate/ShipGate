# API Definition Standard Library
# REST, GraphQL, and RPC patterns with automatic OpenAPI generation

domain API {
  version: "1.0.0"
  description: "Universal API definition with multiple protocol support"
  
  imports {
    core from "@intentos/stdlib-core"
    auth from "@intentos/stdlib-auth"
  }
  
  # ============================================
  # Core Types
  # ============================================
  
  type EndpointId = String
  type RoutePattern = String  # e.g., "/users/:id/posts"
  type MimeType = String      # e.g., "application/json"
  
  # ============================================
  # HTTP Methods & Status
  # ============================================
  
  enum HttpMethod {
    GET     { idempotent: true,  safe: true  }
    POST    { idempotent: false, safe: false }
    PUT     { idempotent: true,  safe: false }
    PATCH   { idempotent: false, safe: false }
    DELETE  { idempotent: true,  safe: false }
    HEAD    { idempotent: true,  safe: true  }
    OPTIONS { idempotent: true,  safe: true  }
  }
  
  enum HttpStatus {
    # Success
    OK                    = 200
    CREATED               = 201
    ACCEPTED              = 202
    NO_CONTENT            = 204
    
    # Redirection
    MOVED_PERMANENTLY     = 301
    FOUND                 = 302
    NOT_MODIFIED          = 304
    
    # Client Errors
    BAD_REQUEST           = 400
    UNAUTHORIZED          = 401
    FORBIDDEN             = 403
    NOT_FOUND             = 404
    METHOD_NOT_ALLOWED    = 405
    CONFLICT              = 409
    GONE                  = 410
    UNPROCESSABLE_ENTITY  = 422
    TOO_MANY_REQUESTS     = 429
    
    # Server Errors
    INTERNAL_SERVER_ERROR = 500
    NOT_IMPLEMENTED       = 501
    BAD_GATEWAY           = 502
    SERVICE_UNAVAILABLE   = 503
    GATEWAY_TIMEOUT       = 504
  }
  
  # ============================================
  # API Versioning
  # ============================================
  
  enum VersionStrategy {
    URL_PATH    { example: "/v1/users" }
    HEADER      { example: "X-API-Version: 1" }
    QUERY_PARAM { example: "?version=1" }
    ACCEPT      { example: "Accept: application/vnd.api.v1+json" }
  }
  
  type ApiVersion = {
    major: Int [min: 0]
    minor: Int [min: 0]
    patch: Int? [min: 0]
    deprecated: Boolean = false
    sunset_date: Date?
  }
  
  # ============================================
  # Request/Response Types
  # ============================================
  
  type RequestHeader = {
    name: String
    value: String
    required: Boolean = false
  }
  
  type QueryParam = {
    name: String
    type: TypeRef
    required: Boolean = false
    default: Any?
    description: String?
    validation: List<Constraint>?
  }
  
  type PathParam = {
    name: String
    type: TypeRef
    pattern: Regex?
    description: String?
  }
  
  type RequestBody = {
    content_type: MimeType = "application/json"
    schema: TypeRef
    required: Boolean = true
    examples: Map<String, Any>?
  }
  
  type ResponseBody = {
    status: HttpStatus
    content_type: MimeType = "application/json"
    schema: TypeRef?
    headers: List<RequestHeader>?
    description: String?
  }
  
  # ============================================
  # Endpoint Definition
  # ============================================
  
  entity Endpoint {
    id: EndpointId [immutable, unique]
    name: String
    description: String?
    
    # Routing
    method: HttpMethod
    path: RoutePattern
    
    # Parameters
    path_params: List<PathParam>?
    query_params: List<QueryParam>?
    headers: List<RequestHeader>?
    body: RequestBody?
    
    # Responses
    responses: List<ResponseBody>
    
    # Metadata
    tags: List<String>?
    deprecated: Boolean = false
    version: ApiVersion?
    
    # Security
    authentication: AuthRequirement?
    rate_limit: RateLimit?
    
    # Caching
    cache: CachePolicy?
    
    invariants {
      GET implies body == null
      DELETE implies body == null
      responses.exists(r => r.status.is_success)
      path_params.all(p => path.contains(":" + p.name))
    }
  }
  
  # ============================================
  # Security
  # ============================================
  
  enum AuthType {
    NONE
    API_KEY
    BEARER_TOKEN
    BASIC
    OAUTH2
    OIDC
    CUSTOM
  }
  
  type AuthRequirement = {
    type: AuthType
    scopes: List<String>?
    optional: Boolean = false
  }
  
  type RateLimit = {
    requests: Int
    window: Duration
    by: RateLimitKey = IP
    burst: Int?
  }
  
  enum RateLimitKey {
    IP
    USER
    API_KEY
    CUSTOM
  }
  
  # ============================================
  # Caching
  # ============================================
  
  type CachePolicy = {
    max_age: Duration
    private: Boolean = false
    no_store: Boolean = false
    must_revalidate: Boolean = false
    etag: Boolean = true
    vary: List<String>?
  }
  
  # ============================================
  # API Resource (RESTful)
  # ============================================
  
  entity Resource {
    name: String [unique]
    path: RoutePattern
    entity: TypeRef
    
    # Standard CRUD operations
    operations: {
      list: ResourceOperation?
      get: ResourceOperation?
      create: ResourceOperation?
      update: ResourceOperation?
      patch: ResourceOperation?
      delete: ResourceOperation?
    }
    
    # Nested resources
    children: List<Resource>?
    
    # Relationships
    relations: List<ResourceRelation>?
    
    derived {
      endpoints: List<Endpoint> = generate_crud_endpoints(this)
    }
  }
  
  type ResourceOperation = {
    enabled: Boolean = true
    authentication: AuthRequirement?
    rate_limit: RateLimit?
    custom_handler: String?
    hooks: {
      before: List<String>?
      after: List<String>?
    }?
  }
  
  type ResourceRelation = {
    name: String
    target: TypeRef
    type: RelationType
    eager: Boolean = false
  }
  
  enum RelationType {
    HAS_ONE
    HAS_MANY
    BELONGS_TO
    MANY_TO_MANY
  }
  
  # ============================================
  # API Definition
  # ============================================
  
  entity ApiDefinition {
    name: String
    version: ApiVersion
    base_path: String = "/"
    
    description: String?
    terms_of_service: URL?
    contact: {
      name: String?
      email: Email?
      url: URL?
    }?
    license: {
      name: String
      url: URL?
    }?
    
    # Configuration
    versioning: VersionStrategy = URL_PATH
    default_content_type: MimeType = "application/json"
    
    # Security
    security_schemes: List<SecurityScheme>?
    default_auth: AuthRequirement?
    cors: CorsPolicy?
    
    # Endpoints
    endpoints: List<Endpoint>
    resources: List<Resource>?
    
    # Documentation
    servers: List<Server>?
    external_docs: {
      description: String?
      url: URL
    }?
    
    derived {
      openapi_spec: OpenAPISpec = generate_openapi(this)
      graphql_schema: String? = generate_graphql(this)
    }
  }
  
  type SecurityScheme = {
    id: String
    type: AuthType
    name: String?
    location: SecurityLocation?
    scheme: String?
    flows: OAuthFlows?
  }
  
  enum SecurityLocation {
    HEADER
    QUERY
    COOKIE
  }
  
  type OAuthFlows = {
    authorization_code: OAuthFlow?
    client_credentials: OAuthFlow?
    implicit: OAuthFlow?
    password: OAuthFlow?
  }
  
  type OAuthFlow = {
    authorization_url: URL?
    token_url: URL?
    refresh_url: URL?
    scopes: Map<String, String>
  }
  
  type CorsPolicy = {
    allowed_origins: List<String>
    allowed_methods: List<HttpMethod>
    allowed_headers: List<String>?
    exposed_headers: List<String>?
    max_age: Duration?
    allow_credentials: Boolean = false
  }
  
  type Server = {
    url: URL
    description: String?
    variables: Map<String, ServerVariable>?
  }
  
  type ServerVariable = {
    default: String
    enum: List<String>?
    description: String?
  }
}
