// ============================================================================
// Web SDK Types
// ============================================================================

/**
 * HTTP methods supported
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Request configuration
 */
export interface RequestConfig {
  /** Base URL for API */
  baseUrl: string;
  
  /** Default headers */
  headers?: Record<string, string>;
  
  /** Request timeout in ms */
  timeout?: number;
  
  /** Retry configuration */
  retry?: RetryConfig;
  
  /** Authentication */
  auth?: AuthConfig;
  
  /** Request interceptors */
  interceptors?: Interceptors;
  
  /** Enable request caching */
  cache?: CacheConfig;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Max retry attempts */
  maxAttempts: number;
  
  /** Base delay between retries (ms) */
  baseDelay: number;
  
  /** Max delay (ms) */
  maxDelay: number;
  
  /** Status codes to retry */
  retryableStatusCodes: number[];
  
  /** Backoff strategy */
  backoff: 'linear' | 'exponential';
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  type: 'bearer' | 'api-key' | 'basic' | 'oauth2';
  token?: string | (() => string | Promise<string>);
  apiKey?: string;
  apiKeyHeader?: string;
  refreshToken?: () => Promise<string>;
  onUnauthorized?: () => void;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  storage: 'memory' | 'localStorage' | 'sessionStorage';
  maxSize?: number;
}

/**
 * Request/Response interceptors
 */
export interface Interceptors {
  request?: RequestInterceptor[];
  response?: ResponseInterceptor[];
}

export type RequestInterceptor = (config: RequestInit & { url: string }) => Promise<RequestInit & { url: string }>;
export type ResponseInterceptor = (response: Response, request: RequestInit) => Promise<Response>;

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  ok: boolean;
}

/**
 * API Error
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
    public headers: Headers
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Domain definition for SDK generation
 */
export interface Domain {
  name: string;
  baseUrl?: string;
  behaviors: Behavior[];
  entities?: Entity[];
}

export interface Behavior {
  name: string;
  method?: HttpMethod;
  path?: string;
  input?: Record<string, PropertyDef>;
  output?: Record<string, PropertyDef>;
  errors?: ErrorDef[];
}

export interface Entity {
  name: string;
  properties: Record<string, PropertyDef>;
}

export interface PropertyDef {
  type: string;
  required?: boolean;
}

export interface ErrorDef {
  name: string;
  status?: number;
  message?: string;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Required<RequestConfig> = {
  baseUrl: '',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    backoff: 'exponential',
  },
  auth: {
    type: 'bearer',
  },
  interceptors: {},
  cache: {
    enabled: false,
    ttl: 60000,
    storage: 'memory',
    maxSize: 100,
  },
};
