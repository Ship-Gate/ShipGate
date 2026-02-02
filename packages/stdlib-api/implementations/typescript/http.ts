// ============================================================================
// ISL Standard Library - HTTP Types
// @isl-lang/stdlib-api
// ============================================================================

/**
 * HTTP Methods with semantic properties
 */
export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
} as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

/**
 * HTTP method properties
 */
export const HTTP_METHOD_PROPERTIES: Record<
  HttpMethod,
  { idempotent: boolean; safe: boolean }
> = {
  GET: { idempotent: true, safe: true },
  POST: { idempotent: false, safe: false },
  PUT: { idempotent: true, safe: false },
  PATCH: { idempotent: false, safe: false },
  DELETE: { idempotent: true, safe: false },
  HEAD: { idempotent: true, safe: true },
  OPTIONS: { idempotent: true, safe: true },
};

/**
 * Check if an HTTP method is idempotent
 */
export function isIdempotent(method: HttpMethod): boolean {
  return HTTP_METHOD_PROPERTIES[method].idempotent;
}

/**
 * Check if an HTTP method is safe (read-only)
 */
export function isSafe(method: HttpMethod): boolean {
  return HTTP_METHOD_PROPERTIES[method].safe;
}

/**
 * HTTP Status Codes
 */
export const HttpStatus = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];

/**
 * Check if status code indicates success (2xx)
 */
export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * Check if status code indicates redirection (3xx)
 */
export function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

/**
 * Check if status code indicates client error (4xx)
 */
export function isClientErrorStatus(status: number): boolean {
  return status >= 400 && status < 500;
}

/**
 * Check if status code indicates server error (5xx)
 */
export function isServerErrorStatus(status: number): boolean {
  return status >= 500 && status < 600;
}

/**
 * API Versioning strategies
 */
export const VersionStrategy = {
  URL_PATH: 'URL_PATH',
  HEADER: 'HEADER',
  QUERY_PARAM: 'QUERY_PARAM',
  ACCEPT: 'ACCEPT',
} as const;

export type VersionStrategy =
  (typeof VersionStrategy)[keyof typeof VersionStrategy];

/**
 * API Version information
 */
export interface ApiVersion {
  major: number;
  minor: number;
  patch?: number;
  deprecated?: boolean;
  sunsetDate?: Date;
}

/**
 * Parse a version string (e.g., "1.2.3") into an ApiVersion object
 */
export function parseVersion(versionString: string): ApiVersion {
  const parts = versionString.split('.').map(Number);
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2],
  };
}

/**
 * Format an ApiVersion as a string
 */
export function formatVersion(version: ApiVersion): string {
  const base = `${version.major}.${version.minor}`;
  return version.patch !== undefined ? `${base}.${version.patch}` : base;
}

/**
 * Compare two versions. Returns -1, 0, or 1
 */
export function compareVersions(a: ApiVersion, b: ApiVersion): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  const aPatch = a.patch ?? 0;
  const bPatch = b.patch ?? 0;
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1;
  return 0;
}

/**
 * Request header definition
 */
export interface RequestHeader {
  name: string;
  value: string;
  required?: boolean;
}

/**
 * Query parameter definition
 */
export interface QueryParam {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
  validation?: Constraint[];
}

/**
 * Path parameter definition
 */
export interface PathParam {
  name: string;
  type: string;
  pattern?: RegExp;
  description?: string;
}

/**
 * Constraint for parameter validation
 */
export interface Constraint {
  type: string;
  value: unknown;
  message?: string;
}

/**
 * MIME type alias
 */
export type MimeType = string;

/**
 * Common MIME types
 */
export const MimeTypes = {
  JSON: 'application/json',
  XML: 'application/xml',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  MULTIPART_FORM: 'multipart/form-data',
  TEXT_PLAIN: 'text/plain',
  TEXT_HTML: 'text/html',
  OCTET_STREAM: 'application/octet-stream',
} as const;

/**
 * Request body definition
 */
export interface RequestBody {
  contentType?: MimeType;
  schema: string;
  required?: boolean;
  examples?: Record<string, unknown>;
}

/**
 * Response body definition
 */
export interface ResponseBody {
  status: HttpStatus;
  contentType?: MimeType;
  schema?: string;
  headers?: RequestHeader[];
  description?: string;
}

/**
 * Authentication types
 */
export const AuthType = {
  NONE: 'NONE',
  API_KEY: 'API_KEY',
  BEARER_TOKEN: 'BEARER_TOKEN',
  BASIC: 'BASIC',
  OAUTH2: 'OAUTH2',
  OIDC: 'OIDC',
  CUSTOM: 'CUSTOM',
} as const;

export type AuthType = (typeof AuthType)[keyof typeof AuthType];

/**
 * Authentication requirement
 */
export interface AuthRequirement {
  type: AuthType;
  scopes?: string[];
  optional?: boolean;
}

/**
 * Rate limit key types
 */
export const RateLimitKey = {
  IP: 'IP',
  USER: 'USER',
  API_KEY: 'API_KEY',
  CUSTOM: 'CUSTOM',
} as const;

export type RateLimitKey = (typeof RateLimitKey)[keyof typeof RateLimitKey];

/**
 * Rate limit configuration
 */
export interface RateLimit {
  requests: number;
  windowMs: number;
  by?: RateLimitKey;
  burst?: number;
}

/**
 * Cache policy configuration
 */
export interface CachePolicy {
  maxAge: number;
  private?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
  etag?: boolean;
  vary?: string[];
}

/**
 * Generate Cache-Control header value from policy
 */
export function generateCacheControlHeader(policy: CachePolicy): string {
  const directives: string[] = [];

  if (policy.noStore) {
    directives.push('no-store');
  } else {
    if (policy.private) {
      directives.push('private');
    } else {
      directives.push('public');
    }
    directives.push(`max-age=${policy.maxAge}`);
  }

  if (policy.mustRevalidate) {
    directives.push('must-revalidate');
  }

  return directives.join(', ');
}

/**
 * CORS policy configuration
 */
export interface CorsPolicy {
  allowedOrigins: string[];
  allowedMethods: HttpMethod[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  allowCredentials?: boolean;
}

/**
 * Server definition for API documentation
 */
export interface Server {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
}

/**
 * Server variable for templated URLs
 */
export interface ServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

/**
 * Security scheme definition
 */
export interface SecurityScheme {
  id: string;
  type: AuthType;
  name?: string;
  location?: 'HEADER' | 'QUERY' | 'COOKIE';
  scheme?: string;
  flows?: OAuthFlows;
}

/**
 * OAuth flows configuration
 */
export interface OAuthFlows {
  authorizationCode?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  implicit?: OAuthFlow;
  password?: OAuthFlow;
}

/**
 * OAuth flow configuration
 */
export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export default {
  HttpMethod,
  HttpStatus,
  VersionStrategy,
  AuthType,
  RateLimitKey,
  MimeTypes,
  HTTP_METHOD_PROPERTIES,
  isIdempotent,
  isSafe,
  isSuccessStatus,
  isRedirectStatus,
  isClientErrorStatus,
  isServerErrorStatus,
  parseVersion,
  formatVersion,
  compareVersions,
  generateCacheControlHeader,
};
