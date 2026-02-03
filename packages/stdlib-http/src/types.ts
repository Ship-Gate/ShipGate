/**
 * HTTP Types
 */

// ============================================
// Core Types
// ============================================

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type StatusCode = number;

export type Headers = Record<string, string | string[]>;

export type QueryParams = Record<string, string | string[]>;

// ============================================
// Request Types
// ============================================

export interface RequestOptions {
  method?: Method;
  headers?: Headers;
  query?: QueryParams;
  body?: string | Blob | ArrayBuffer | FormData | URLSearchParams | ReadableStream<Uint8Array> | null;
  timeout?: number;
  retry?: RetryConfig;
  signal?: AbortSignal;
}

export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoffMultiplier?: number;
  retryOn?: StatusCode[];
}

export interface RequestInit extends RequestOptions {
  url: string;
}

// ============================================
// Response Types
// ============================================

export interface HTTPResponse<T = unknown> {
  ok: boolean;
  status: StatusCode;
  statusText: string;
  headers: Headers;
  body: T;
  url: string;
  redirected: boolean;
  timing?: ResponseTiming;
}

export interface ResponseTiming {
  dnsLookup?: number;
  tcpConnect?: number;
  tlsHandshake?: number;
  requestSent?: number;
  responseReceived?: number;
  total: number;
}

// ============================================
// Server Types
// ============================================

export interface ServerOptions {
  port: number;
  host?: string;
  https?: HTTPSOptions;
  cors?: CORSOptions;
  bodyLimit?: number;
  trustProxy?: boolean;
}

export interface HTTPSOptions {
  cert: string;
  key: string;
  ca?: string;
}

export interface CORSOptions {
  origins: string[] | '*';
  methods?: Method[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export interface ServerRequest {
  method: Method;
  path: string;
  url: string;
  headers: Headers;
  query: QueryParams;
  params: Record<string, string>;
  body: RequestBody;
  ip?: string;
  protocol: 'http' | 'https';
  context: Record<string, unknown>;
}

export interface RequestBody {
  json<T = unknown>(): Promise<T>;
  text(): Promise<string>;
  form(): Promise<Record<string, string>>;
  buffer(): Promise<Buffer>;
}

export interface ServerResponse {
  status(code: StatusCode): ServerResponse;
  header(name: string, value: string): ServerResponse;
  json(data: unknown): ServerResponse;
  text(data: string): ServerResponse;
  html(data: string): ServerResponse;
  redirect(url: string, status?: StatusCode): ServerResponse;
  send(): void;
}

export type RouteHandler = (
  request: ServerRequest,
  response: ServerResponse
) => void | Promise<void>;

export type Middleware = (
  request: ServerRequest,
  response: ServerResponse,
  next: () => Promise<void>
) => void | Promise<void>;

export interface Route {
  method: Method | Method[];
  path: string;
  handler: RouteHandler;
  middleware?: Middleware[];
}

// ============================================
// Error Types
// ============================================

export class HTTPError extends Error {
  constructor(
    public status: StatusCode,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'HTTPError';
  }
}

export type HTTPResult<T> = 
  | { ok: true; data: HTTPResponse<T> }
  | { ok: false; error: HTTPError };
