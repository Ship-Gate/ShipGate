# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isIdempotent, isSafe, isSuccessStatus, isRedirectStatus, isClientErrorStatus, isServerErrorStatus, parseVersion, formatVersion, compareVersions, generateCacheControlHeader, HttpMethod, HTTP_METHOD_PROPERTIES, HttpStatus, VersionStrategy, MimeTypes, AuthType, RateLimitKey, ApiVersion, RequestHeader, QueryParam, PathParam, Constraint, MimeType, RequestBody, ResponseBody, AuthRequirement, RateLimit, CachePolicy, CorsPolicy, Server, ServerVariable, SecurityScheme, OAuthFlows, OAuthFlow
# dependencies: 

domain Http {
  version: "1.0.0"

  type ApiVersion = String
  type RequestHeader = String
  type QueryParam = String
  type PathParam = String
  type Constraint = String
  type MimeType = String
  type RequestBody = String
  type ResponseBody = String
  type AuthRequirement = String
  type RateLimit = String
  type CachePolicy = String
  type CorsPolicy = String
  type Server = String
  type ServerVariable = String
  type SecurityScheme = String
  type OAuthFlows = String
  type OAuthFlow = String

  invariants exports_present {
    - true
  }
}
