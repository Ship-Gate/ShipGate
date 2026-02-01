/**
 * ISL Configuration - Client configuration types.
 */

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  readonly maxRetries?: number;
  /** HTTP status codes to retry on */
  readonly retryOnStatus?: readonly number[];
  /** Base for exponential backoff */
  readonly exponentialBase?: number;
  /** Initial delay in ms */
  readonly initialDelay?: number;
  /** Maximum delay in ms */
  readonly maxDelay?: number;
}

/**
 * Verification configuration
 */
export interface VerificationConfig {
  /** Enable precondition checking */
  readonly enablePreconditions?: boolean;
  /** Enable postcondition checking */
  readonly enablePostconditions?: boolean;
  /** Throw on violation */
  readonly throwOnViolation?: boolean;
  /** Log violations */
  readonly logViolations?: boolean;
}

/**
 * Request interceptor
 */
export type RequestInterceptor = (request: Request) => Request | Promise<Request>;

/**
 * Response interceptor
 */
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

/**
 * Interceptors configuration
 */
export interface InterceptorsConfig {
  readonly request?: RequestInterceptor;
  readonly response?: ResponseInterceptor;
}

/**
 * ISL Client configuration
 */
export interface ISLClientConfig {
  /** Base URL of the API */
  readonly baseUrl: string;
  /** Authentication token */
  readonly authToken?: string;
  /** Request timeout in ms */
  readonly timeout?: number;
  /** Custom fetch implementation */
  readonly fetch?: typeof fetch;
  /** Retry configuration */
  readonly retry?: RetryConfig;
  /** Verification configuration */
  readonly verification?: VerificationConfig;
  /** Request/response interceptors */
  readonly interceptors?: InterceptorsConfig;
  /** Custom headers */
  readonly headers?: Record<string, string>;
}

/**
 * Default configuration values
 */
export const defaultConfig: Required<Omit<ISLClientConfig, 'authToken' | 'fetch' | 'interceptors' | 'headers'>> & {
  authToken: undefined;
  fetch: undefined;
  interceptors: undefined;
  headers: undefined;
} = {
  baseUrl: '',
  authToken: undefined,
  timeout: 30000,
  fetch: undefined,
  interceptors: undefined,
  headers: undefined,
  retry: {
    maxRetries: 3,
    retryOnStatus: [429, 500, 502, 503, 504],
    exponentialBase: 2,
    initialDelay: 1000,
    maxDelay: 30000,
  },
  verification: {
    enablePreconditions: true,
    enablePostconditions: true,
    throwOnViolation: true,
    logViolations: true,
  },
};
