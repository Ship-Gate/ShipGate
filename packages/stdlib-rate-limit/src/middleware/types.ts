/**
 * Types and interfaces for rate limiting middleware
 */

import { RateLimitAction, CheckResult, RateLimitKey, IdentifierType } from '../types';
import { MiddlewareContext, MiddlewareResult } from '../types';

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

export interface MiddlewareConfig {
  /**
   * Enable/disable rate limiting
   */
  enabled?: boolean;
  
  /**
   * Skip rate limiting for these paths
   */
  skipPaths?: string[];
  
  /**
   * Skip rate limiting for these HTTP methods
   */
  skipMethods?: string[];
  
  /**
   * Skip rate limiting when these conditions are met
   */
  skipConditions?: SkipCondition[];
  
  /**
   * Custom headers to include
   */
  headers?: {
    enabled?: boolean;
    prefix?: string;
    custom?: Record<string, string>;
  };
  
  /**
   * Response configuration
   */
  response?: {
    includeHeaders?: boolean;
    includeBody?: boolean;
    bodyTemplate?: string;
    statusCode?: Record<RateLimitAction, number>;
  };
  
  /**
   * Key extraction configuration
   */
  keyExtraction?: {
    primary?: KeyExtractorType;
    fallback?: KeyExtractorType[];
    customHeader?: string;
    customQuery?: string;
  };
  
  /**
   * Logging configuration
   */
  logging?: {
    enabled?: boolean;
    level?: 'debug' | 'info' | 'warn' | 'error';
    includeMetadata?: boolean;
  };
}

// ============================================================================
// KEY EXTRACTION TYPES
// ============================================================================

export type KeyExtractorType = 
  | 'ip'
  | 'user-id'
  | 'api-key'
  | 'session'
  | 'header'
  | 'query'
  | 'cookie'
  | 'custom';

export interface KeyExtractor {
  /**
   * Extract the rate limit key from the request
   */
  extract(context: MiddlewareContext): Promise<RateLimitKey | null>;
  
  /**
   * Get the identifier type for this extractor
   */
  getType(): IdentifierType;
  
  /**
   * Get the priority of this extractor (higher = more priority)
   */
  getPriority(): number;
}

export interface KeyExtractorConfig {
  /**
   * Header name for header-based extraction
   */
  headerName?: string;
  
  /**
   * Query parameter name for query-based extraction
   */
  queryName?: string;
  
  /**
   * Cookie name for cookie-based extraction
   */
  cookieName?: string;
  
  /**
   * Custom extraction function
   */
  customExtractor?: (context: MiddlewareContext) => Promise<RateLimitKey | null>;
  
  /**
   * IP extraction configuration
   */
  ip?: {
    trustProxy?: boolean;
    headerNames?: string[];
    fallbackToSocket?: boolean;
  };
}

// ============================================================================
// SKIP CONDITIONS
// ============================================================================

export interface SkipCondition {
  /**
   * Type of condition
   */
  type: 'path' | 'method' | 'header' | 'query' | 'ip' | 'custom';
  
  /**
   * Condition configuration
   */
  config: {
    /**
     * Path pattern (glob or regex)
     */
    pattern?: string;
    
    /**
     * HTTP method
     */
    method?: string;
    
    /**
     * Header name and value
     */
    header?: { name: string; value?: string };
    
    /**
     * Query parameter name and value
     */
    query?: { name: string; value?: string };
    
    /**
     * IP address or CIDR range
     */
    ip?: string | string[];
    
    /**
     * Custom condition function
     */
    custom?: (context: MiddlewareContext) => Promise<boolean>;
  };
}

// ============================================================================
// MIDDLEWARE CHAIN
// ============================================================================

export interface MiddlewareChain {
  /**
   * Add middleware to the chain
   */
  use(middleware: RateLimitMiddleware): void;
  
  /**
   * Execute the middleware chain
   */
  execute(context: MiddlewareContext): Promise<MiddlewareResult>;
  
  /**
   * Get all middleware in the chain
   */
  getMiddleware(): RateLimitMiddleware[];
}

export interface RateLimitMiddleware {
  /**
   * Middleware name
   */
  name: string;
  
  /**
   * Middleware priority (higher = executed first)
   */
  priority: number;
  
  /**
   * Execute the middleware
   */
  execute(context: MiddlewareContext, next: () => Promise<MiddlewareResult>): Promise<MiddlewareResult>;
}

// ============================================================================
// FRAMEWORK ADAPTERS
// ============================================================================

export interface FrameworkAdapter<TRequest = any, TResponse = any> {
  /**
   * Convert framework-specific request to middleware context
   */
  toContext(request: TRequest, response?: TResponse): MiddlewareContext;
  
  /**
   * Apply middleware result to framework-specific response
   */
  applyResult(result: MiddlewareResult, response: TResponse): void;
  
  /**
   * Get framework-specific middleware function
   */
  getMiddleware(config: MiddlewareConfig): (req: TRequest, res: TResponse, next?: any) => Promise<void>;
}

// ============================================================================
// HTTP MIDDLEWARE TYPES
// ============================================================================

export interface HttpMiddlewareConfig extends MiddlewareConfig {
  /**
   * HTTP-specific configuration
   */
  http?: {
    /**
     * Enable CORS headers
     */
    cors?: boolean;
    
    /**
     * Enable security headers
     */
    security?: boolean;
    
    /**
     * Custom status codes
     */
    statusCodes?: {
      [RateLimitAction.ALLOW]: number;
      [RateLimitAction.WARN]: number;
      [RateLimitAction.THROTTLE]: number;
      [RateLimitAction.DENY]: number;
      [RateLimitAction.CAPTCHA]: number;
    };
  };
}

export interface HttpHeaders {
  /**
   * Rate limit headers
   */
  'X-RateLimit-Limit'?: string;
  'X-RateLimit-Remaining'?: string;
  'X-RateLimit-Reset'?: string;
  'X-RateLimit-Retry-After'?: string;
  'X-RateLimit-Policy'?: string;
  
  /**
   * Custom headers
   */
  [key: string]: string | undefined;
}

// ============================================================================
// MIDDLEWARE EVENTS
// ============================================================================

export interface MiddlewareEvents {
  /**
   * Fired when a request is allowed
   */
  allowed?: (context: MiddlewareContext, result: CheckResult) => void;
  
  /**
   * Fired when a request is warned
   */
  warned?: (context: MiddlewareContext, result: CheckResult) => void;
  
  /**
   * Fired when a request is throttled
   */
  throttled?: (context: MiddlewareContext, result: CheckResult) => void;
  
  /**
   * Fired when a request is denied
   */
  denied?: (context: MiddlewareContext, result: CheckResult) => void;
  
  /**
   * Fired when a captcha is required
   */
  captcha?: (context: MiddlewareContext, result: CheckResult) => void;
  
  /**
   * Fired when an error occurs
   */
  error?: (context: MiddlewareContext, error: Error) => void;
  
  /**
   * Fired when rate limiting is skipped
   */
  skipped?: (context: MiddlewareContext, reason: string) => void;
}

// ============================================================================
// MIDDLEWARE METRICS
// ============================================================================

export interface MiddlewareMetrics {
  /**
   * Total requests processed
   */
  totalRequests: number;
  
  /**
   * Requests by action
   */
  requestsByAction: Record<RateLimitAction, number>;
  
  /**
   * Requests by status code
   */
  requestsByStatusCode: Record<number, number>;
  
  /**
   * Average processing time
   */
  averageProcessingTime: number;
  
  /**
   * Last request timestamp
   */
  lastRequestTime: Date;
  
  /**
   * Top rate limited keys
   */
  topLimitedKeys: Array<{
    key: RateLimitKey;
    count: number;
    lastSeen: Date;
  }>;
}

// ============================================================================
// MIDDLEWARE BUILDER
// ============================================================================

export interface MiddlewareBuilder {
  /**
   * Set the configuration
   */
  config(config: MiddlewareConfig): MiddlewareBuilder;
  
  /**
   * Add a key extractor
   */
  extractKey(type: KeyExtractorType, config?: KeyExtractorConfig): MiddlewareBuilder;
  
  /**
   * Add a skip condition
   */
  skip(condition: SkipCondition): MiddlewareBuilder;
  
  /**
   * Add custom middleware
   */
  use(middleware: RateLimitMiddleware): MiddlewareBuilder;
  
  /**
   * Add event handlers
   */
  on(events: Partial<MiddlewareEvents>): MiddlewareBuilder;
  
  /**
   * Build the middleware chain
   */
  build(): MiddlewareChain;
  
  /**
   * Build framework-specific middleware
   */
  buildFor<TRequest, TResponse>(adapter: FrameworkAdapter<TRequest, TResponse>): (req: TRequest, res: TResponse, next?: any) => Promise<void>;
}

// ============================================================================
// MIDDLEWARE UTILITIES
// ============================================================================

export interface MiddlewareUtils {
  /**
   * Check if a path matches a pattern
   */
  matchPath(path: string, pattern: string): boolean;
  
  /**
   * Parse IP address from request
   */
  parseIp(context: MiddlewareContext, trustProxy?: boolean, headerNames?: string[]): string | null;
  
  /**
   * Generate standard rate limit headers
   */
  generateHeaders(result: CheckResult, prefix?: string): HttpHeaders;
  
  /**
   * Calculate retry after value
   */
  calculateRetryAfter(result: CheckResult): number | null;
  
  /**
   * Sanitize headers for response
   */
  sanitizeHeaders(headers: Record<string, string>): Record<string, string>;
}
