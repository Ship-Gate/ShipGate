// ============================================================================
// ISL Standard Library - REST Client Types
// @isl-lang/stdlib-api
// ============================================================================

import type { Result } from '@isl-lang/stdlib-core';
import type { HttpMethod, ApiResponse, Middleware } from '../types.js';
import type { ApiError } from '../errors.js';

export interface RestRequestParams {
  path?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

export interface RestClient {
  get<T = unknown>(url: string, params?: RestRequestParams): Promise<Result<ApiResponse<T>, ApiError>>;
  post<T = unknown>(url: string, params?: RestRequestParams): Promise<Result<ApiResponse<T>, ApiError>>;
  put<T = unknown>(url: string, params?: RestRequestParams): Promise<Result<ApiResponse<T>, ApiError>>;
  patch<T = unknown>(url: string, params?: RestRequestParams): Promise<Result<ApiResponse<T>, ApiError>>;
  delete<T = unknown>(url: string, params?: RestRequestParams): Promise<Result<ApiResponse<T>, ApiError>>;
  head(url: string, params?: RestRequestParams): Promise<Result<ApiResponse<void>, ApiError>>;
  options(url: string, params?: RestRequestParams): Promise<Result<ApiResponse<unknown>, ApiError>>;
  request<T = unknown>(method: HttpMethod, url: string, params?: RestRequestParams): Promise<Result<ApiResponse<T>, ApiError>>;
}

export interface RestClientBuilder {
  baseUrl(url: string): RestClientBuilder;
  header(name: string, value: string): RestClientBuilder;
  headers(headers: Record<string, string>): RestClientBuilder;
  timeout(ms: number): RestClientBuilder;
  middleware(mw: Middleware): RestClientBuilder;
  fetchFn(fn: typeof globalThis.fetch): RestClientBuilder;
  build(): RestClient;
}
