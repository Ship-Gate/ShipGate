/**
 * HTTP Standard Library for ISL
 * 
 * HTTP/REST operations and server functionality.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface Headers {
  [key: string]: string;
}

export interface QueryParams {
  [key: string]: string | string[];
}

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  path: string;
  headers: Headers;
  query?: QueryParams;
  body?: unknown;
  pathParams?: Record<string, string>;
  contentType?: string;
  timestamp: Date;
  requestId: string;
}

export interface HttpResponse {
  status: number;
  headers: Headers;
  body?: unknown;
  requestId: string;
  durationMs: number;
  timestamp: Date;
}

export interface HttpError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
}

export interface ParamDef {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  default?: unknown;
  validation?: string;
}

export interface ResponseDef {
  status: number;
  description: string;
  contentType?: string;
  schema?: string;
}

export interface RateLimit {
  requests: number;
  windowSeconds: number;
  by: 'IP' | 'USER' | 'API_KEY' | 'ENDPOINT';
}

export interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;
  name: string;
  description?: string;
  pathParams?: ParamDef[];
  queryParams?: ParamDef[];
  headers?: ParamDef[];
  bodySchema?: string;
  responses: ResponseDef[];
  authRequired: boolean;
  permissions?: string[];
  rateLimit?: RateLimit;
  tags?: string[];
  deprecated: boolean;
  version?: string;
}

export interface Middleware {
  name: string;
  priority: number;
  handler: string;
  config?: Record<string, unknown>;
}

export type MiddlewarePhase = 'PRE_ROUTE' | 'PRE_HANDLER' | 'POST_HANDLER' | 'POST_RESPONSE' | 'ERROR';

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Client
// ─────────────────────────────────────────────────────────────────────────────

export interface RequestOptions {
  method?: HttpMethod;
  headers?: Headers;
  query?: QueryParams;
  body?: unknown;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  retryCount?: number;
  retryDelay?: number;
}

export type RequestResult = 
  | { success: true; response: HttpResponse }
  | { success: false; error: HttpError };

/**
 * Make an HTTP request
 */
export async function request(url: string, options: RequestOptions = {}): Promise<RequestResult> {
  const {
    method = 'GET',
    headers = {},
    query,
    body,
    timeout = 30000,
    followRedirects = true,
    maxRedirects = 5,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  const requestId = generateRequestId();
  const startTime = Date.now();

  // Build URL with query params
  let fullUrl = url;
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.append(key, value);
      }
    }
    fullUrl += (url.includes('?') ? '&' : '?') + params.toString();
  }

  // Prepare request init
  const init: RequestInit = {
    method,
    headers: {
      ...headers,
      'X-Request-ID': requestId,
    },
    redirect: followRedirects ? 'follow' : 'manual',
  };

  // Add body for non-GET requests
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (typeof body === 'string') {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      if (!headers['Content-Type']) {
        (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    }
  }

  // Execute with retries
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      init.signal = controller.signal;

      const response = await fetch(fullUrl, init);
      clearTimeout(timeoutId);

      // Parse response
      let responseBody: unknown;
      const contentType = response.headers.get('Content-Type') ?? '';
      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else if (contentType.includes('text/')) {
        responseBody = await response.text();
      } else {
        responseBody = await response.arrayBuffer();
      }

      const httpResponse: HttpResponse = {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
        requestId,
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };

      return { success: true, response: httpResponse };

    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on abort/timeout
      if (lastError.name === 'AbortError') {
        return {
          success: false,
          error: {
            status: 408,
            code: 'TIMEOUT',
            message: `Request timed out after ${timeout}ms`,
            traceId: requestId,
          },
        };
      }

      // Wait before retry
      if (attempt < retryCount) {
        await sleep(retryDelay * Math.pow(2, attempt));
      }
    }
  }

  return {
    success: false,
    error: {
      status: 0,
      code: 'CONNECTION_ERROR',
      message: lastError?.message ?? 'Connection failed',
      traceId: requestId,
    },
  };
}

/**
 * HTTP GET request
 */
export async function get(url: string, options?: Omit<RequestOptions, 'method'>): Promise<RequestResult> {
  return request(url, { ...options, method: 'GET' });
}

/**
 * HTTP POST request
 */
export async function post(url: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<RequestResult> {
  return request(url, { ...options, method: 'POST', body });
}

/**
 * HTTP PUT request
 */
export async function put(url: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<RequestResult> {
  return request(url, { ...options, method: 'PUT', body });
}

/**
 * HTTP PATCH request
 */
export async function patch(url: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<RequestResult> {
  return request(url, { ...options, method: 'PATCH', body });
}

/**
 * HTTP DELETE request
 */
export async function del(url: string, options?: Omit<RequestOptions, 'method'>): Promise<RequestResult> {
  return request(url, { ...options, method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Router
// ─────────────────────────────────────────────────────────────────────────────

export type RouteHandler = (req: HttpRequest) => Promise<HttpResponse | { status: number; body?: unknown; headers?: Headers }>;

interface Route {
  method: HttpMethod;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
  middleware: Middleware[];
}

/**
 * HTTP Router for handling requests
 */
export class Router {
  private routes: Route[] = [];
  private middleware: Map<MiddlewarePhase, Middleware[]> = new Map();

  /**
   * Add a route
   */
  route(method: HttpMethod, path: string, handler: RouteHandler): this {
    const { pattern, paramNames } = this.parsePath(path);
    this.routes.push({
      method,
      path,
      pattern,
      paramNames,
      handler,
      middleware: [],
    });
    return this;
  }

  /**
   * GET route
   */
  get(path: string, handler: RouteHandler): this {
    return this.route('GET', path, handler);
  }

  /**
   * POST route
   */
  post(path: string, handler: RouteHandler): this {
    return this.route('POST', path, handler);
  }

  /**
   * PUT route
   */
  put(path: string, handler: RouteHandler): this {
    return this.route('PUT', path, handler);
  }

  /**
   * PATCH route
   */
  patch(path: string, handler: RouteHandler): this {
    return this.route('PATCH', path, handler);
  }

  /**
   * DELETE route
   */
  delete(path: string, handler: RouteHandler): this {
    return this.route('DELETE', path, handler);
  }

  /**
   * Add middleware
   */
  use(phase: MiddlewarePhase, middleware: Middleware): this {
    if (!this.middleware.has(phase)) {
      this.middleware.set(phase, []);
    }
    this.middleware.get(phase)!.push(middleware);
    this.middleware.get(phase)!.sort((a, b) => a.priority - b.priority);
    return this;
  }

  /**
   * Handle a request
   */
  async handle(req: HttpRequest): Promise<HttpResponse> {
    const startTime = Date.now();

    try {
      // Find matching route
      const matched = this.match(req.method, req.path);
      
      if (!matched) {
        // Check if path exists with different method
        const pathExists = this.routes.some(r => r.pattern.test(req.path));
        if (pathExists) {
          return this.errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', req.requestId, startTime);
        }
        return this.errorResponse(404, 'NOT_FOUND', 'Route not found', req.requestId, startTime);
      }

      // Add path params to request
      req.pathParams = matched.params;

      // Execute handler
      const result = await matched.route.handler(req);

      // Build response
      return {
        status: result.status,
        headers: result.headers ?? {},
        body: result.body,
        requestId: req.requestId,
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return this.errorResponse(500, 'INTERNAL_ERROR', message, req.requestId, startTime);
    }
  }

  /**
   * Match request to route
   */
  private match(method: HttpMethod, path: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      
      const match = route.pattern.exec(path);
      if (match) {
        const params: Record<string, string> = {};
        for (let i = 0; i < route.paramNames.length; i++) {
          params[route.paramNames[i]] = match[i + 1];
        }
        return { route, params };
      }
    }
    return null;
  }

  /**
   * Parse path pattern
   */
  private parsePath(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    const regexPath = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    return {
      pattern: new RegExp(`^${regexPath}$`),
      paramNames,
    };
  }

  /**
   * Create error response
   */
  private errorResponse(status: number, code: string, message: string, requestId: string, startTime: number): HttpResponse {
    return {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: { error: code, message },
      requestId,
      durationMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/** Validation schemas for HTTP types */
export const schemas = {
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  statusCode: z.number().int().min(100).max(599),
  headers: z.record(z.string()),
  url: z.string().url(),
  path: z.string().regex(/^\/[a-zA-Z0-9\-_\/{}:.*]*$/),
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse query string
 */
export function parseQuery(queryString: string): QueryParams {
  const params = new URLSearchParams(queryString);
  const result: QueryParams = {};
  
  for (const [key, value] of params.entries()) {
    if (key in result) {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Build query string
 */
export function buildQuery(params: QueryParams): string {
  const searchParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach(v => searchParams.append(key, v));
    } else {
      searchParams.append(key, value);
    }
  }
  
  return searchParams.toString();
}

/**
 * Create standard error response
 */
export function createError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): HttpError {
  return { status, code, message, details };
}

/**
 * Standard HTTP errors
 */
export const errors = {
  badRequest: (message = 'Bad request', details?: Record<string, unknown>) => 
    createError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'Unauthorized') => 
    createError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Forbidden') => 
    createError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found') => 
    createError(404, 'NOT_FOUND', message),
  methodNotAllowed: (allowed: HttpMethod[]) => 
    createError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', { allowed }),
  conflict: (message = 'Conflict') => 
    createError(409, 'CONFLICT', message),
  tooManyRequests: (retryAfter?: number) => 
    createError(429, 'TOO_MANY_REQUESTS', 'Too many requests', retryAfter ? { retryAfter } : undefined),
  internal: (message = 'Internal server error') => 
    createError(500, 'INTERNAL_ERROR', message),
  notImplemented: () => 
    createError(501, 'NOT_IMPLEMENTED', 'Not implemented'),
  serviceUnavailable: (message = 'Service unavailable') => 
    createError(503, 'SERVICE_UNAVAILABLE', message),
};
