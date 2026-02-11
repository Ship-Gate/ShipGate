// ============================================================================
// ISL Standard Library - GraphQL Client Types
// @isl-lang/stdlib-api
// ============================================================================

import type { Result } from '@isl-lang/stdlib-core';
import type { ApiResponse, Middleware } from '../types.js';
import type { ApiError } from '../errors.js';

export interface GraphQLRequestOptions {
  variables?: Record<string, unknown>;
  operationName?: string;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

export interface GraphQLErrorItem {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLErrorItem[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLClient {
  query<T = unknown>(
    query: string,
    options?: GraphQLRequestOptions,
  ): Promise<Result<GraphQLResponse<T>, ApiError>>;

  mutation<T = unknown>(
    mutation: string,
    options?: GraphQLRequestOptions,
  ): Promise<Result<GraphQLResponse<T>, ApiError>>;
}

export interface GraphQLClientBuilder {
  url(endpoint: string): GraphQLClientBuilder;
  header(name: string, value: string): GraphQLClientBuilder;
  headers(headers: Record<string, string>): GraphQLClientBuilder;
  timeout(ms: number): GraphQLClientBuilder;
  middleware(mw: Middleware): GraphQLClientBuilder;
  fetchFn(fn: typeof globalThis.fetch): GraphQLClientBuilder;
  build(): GraphQLClient;
}
