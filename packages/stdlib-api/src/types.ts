// ============================================================================
// ISL Standard Library - API Client Types
// @isl-lang/stdlib-api
// ============================================================================

import type { Result } from '@isl-lang/stdlib-core';

// Re-export Result for convenience
export type { Result };

// ============================================================================
// HTTP Types
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RequestConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  ok: boolean;
}

// ============================================================================
// Middleware / Interceptor Types
// ============================================================================

export interface MiddlewareContext {
  request: RequestConfig;
  metadata: Record<string, unknown>;
}

export type NextFn = (ctx: MiddlewareContext) => Promise<Result<ApiResponse, import('./errors.js').ApiError>>;

export interface Middleware {
  name: string;
  execute: (ctx: MiddlewareContext, next: NextFn) => Promise<Result<ApiResponse, import('./errors.js').ApiError>>;
}

// ============================================================================
// Client Config
// ============================================================================

export interface ClientConfig {
  baseUrl: string;
  headers: Record<string, string>;
  timeout: number;
  middleware: Middleware[];
  fetchFn: typeof globalThis.fetch;
}
